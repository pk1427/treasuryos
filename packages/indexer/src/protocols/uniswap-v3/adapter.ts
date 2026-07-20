import type { TreasuryPosition } from "@treasuryos/shared";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../client";
import { getTokenPrice } from "../../prices";
import { getSupportedToken } from "../../tokens";
import type { TreasuryProtocolAdapter } from "../adapter";
import {
  erc20MetadataAbi,
  nonfungiblePositionManagerAbi,
  uniswapV3FactoryAbi,
  uniswapV3PoolAbi,
} from "./abi";
import { UNISWAP_V3 } from "./addresses";

const ZERO_BALANCE = BigInt(0);
const MAX_POSITIONS_PER_SCAN = 25;
const NFT_BALANCE_TIMEOUT_MS = 6_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const Q32 = BigInt("0x100000000");
const Q96 = BigInt("0x1000000000000000000000000");
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);
const TICK_RATIO_CONSTANTS = [
  BigInt("0xfffcb933bd6fad37aa2d162d1a594001"),
  BigInt("0xfff97272373d413259a46990580e213a"),
  BigInt("0xfff2e50f5f656932ef12357cf3c7fdcc"),
  BigInt("0xffe5caca7e10e4e61c3624eaa0941cd0"),
  BigInt("0xffcb9843d60f6159c9db58835c926644"),
  BigInt("0xff973b41fa98c081472e6896dfb254c0"),
  BigInt("0xff2ea16466c96a3843ec78b326b52861"),
  BigInt("0xfe5dee046a99a2a811c461f1969c3053"),
  BigInt("0xfcbe86c7900a88aedcffc83b479aa3a4"),
  BigInt("0xf987a7253ac413176f2b074cf7815e54"),
  BigInt("0xf3392b0822b70005940c7a398e4b70f3"),
  BigInt("0xe7159475a2c29b7443b29c7fa6e889d9"),
  BigInt("0xd097f3bdfd2022b8845ad8f792aa5825"),
  BigInt("0xa9f746462d870fdf8a65dc1f90e061e5"),
  BigInt("0x70d869a156d2a1b890bb3df62baf32f7"),
  BigInt("0x31be135f97d08fd981231505542fcfa6"),
  BigInt("0x9aa508b5b7a84e1c677de54f3e99bc9"),
  BigInt("0x5d6af8dedb81196699c329225ee604"),
  BigInt("0x2216e584f5fa1ea926041bedfe98"),
  BigInt("0x48a170391f7dc42444e8fa2"),
];

export const uniswapV3Adapter: TreasuryProtocolAdapter = {
  id: "uniswap-v3",
  name: "Uniswap V3",
  async scan(address) {
    try {
      const balance = await withTimeout(
        publicClient.readContract({
          address: UNISWAP_V3.sepolia.nonfungiblePositionManager,
          abi: nonfungiblePositionManagerAbi,
          functionName: "balanceOf",
          args: [address],
        }),
        NFT_BALANCE_TIMEOUT_MS
      );

      if (balance === ZERO_BALANCE) return [];

      const count = Number(balance);
      if (!Number.isSafeInteger(count) || count <= 0) return [];

      const tokenIds = await Promise.all(
        Array.from(
          { length: Math.min(count, MAX_POSITIONS_PER_SCAN) },
          (_, index) =>
            publicClient.readContract({
              address: UNISWAP_V3.sepolia.nonfungiblePositionManager,
              abi: nonfungiblePositionManagerAbi,
              functionName: "tokenOfOwnerByIndex",
              args: [address, BigInt(index)],
            })
        )
      );

      const positions = await Promise.all(tokenIds.map(readPosition));

      return positions.filter(
        (position): position is TreasuryPosition => position !== null
      );
    } catch {
      return [];
    }
  },
};

async function readPosition(tokenId: bigint): Promise<TreasuryPosition | null> {
  try {
    const position = await publicClient.readContract({
      address: UNISWAP_V3.sepolia.nonfungiblePositionManager,
      abi: nonfungiblePositionManagerAbi,
      functionName: "positions",
      args: [tokenId],
    });

    const [
      ,
      ,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      ,
      ,
      tokensOwed0,
      tokensOwed1,
    ] = position;

    if (liquidity === ZERO_BALANCE) return null;

    const [pool, metadata0, metadata1] = await Promise.all([
      getPoolAddress(token0, token1, fee),
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);

    if (pool === ZERO_ADDRESS) return null;

    const [sqrtPriceX96, currentTick] = await getPoolState(pool);
    const amounts = getAmountsForLiquidity({
      sqrtPriceX96,
      tickLower,
      tickUpper,
      liquidity,
    });
    const amount0 = Number(formatUnits(amounts.amount0, metadata0.decimals));
    const amount1 = Number(formatUnits(amounts.amount1, metadata1.decimals));
    const [price0, price1] = await Promise.all([
      getTokenPrice(metadata0.symbol),
      getTokenPrice(metadata1.symbol),
    ]);
    const amount0Usd = amount0 * price0.price;
    const amount1Usd = amount1 * price1.price;
    const amountUsd = amount0Usd + amount1Usd;

    // tokensOwed0/1 are the position's own unclaimed-fee accounting, read
    // directly from the NonfungiblePositionManager. Note this reflects fees
    // as of the last time the position was touched (mint/increase/decrease/
    // collect), not a live per-second accrual — see feeAprUnavailableReason
    // below for why we don't try to extrapolate a rate from a single read.
    const unclaimedFee0 = Number(formatUnits(tokensOwed0, metadata0.decimals));
    const unclaimedFee1 = Number(formatUnits(tokensOwed1, metadata1.decimals));
    const unclaimedFee0Usd = unclaimedFee0 * price0.price;
    const unclaimedFee1Usd = unclaimedFee1 * price1.price;

    const feeTierPercent = fee / 10_000;
    const inRange = currentTick >= tickLower && currentTick < tickUpper;

    return {
      protocol: "Uniswap",
      asset: `${metadata0.symbol}/${metadata1.symbol}`,
      amountUsd,
      type: "lp",
      tokens: [
        {
          address: token0,
          symbol: metadata0.symbol,
          amount: amount0,
          amountUsd: amount0Usd,
        },
        {
          address: token1,
          symbol: metadata1.symbol,
          amount: amount1,
          amountUsd: amount1Usd,
        },
      ],
      metadata: {
        positionType: "concentrated-liquidity",
        tokenId: tokenId.toString(),
        pool,
        token0,
        token1,
        symbol0: metadata0.symbol,
        symbol1: metadata1.symbol,
        fee,
        feeTierPercent,
        tickLower,
        tickUpper,
        currentTick,
        sqrtPriceX96: sqrtPriceX96.toString(),
        liquidity: liquidity.toString(),
        inRange,
        unclaimedFees: {
          [metadata0.symbol]: unclaimedFee0Usd,
          [metadata1.symbol]: unclaimedFee1Usd,
          totalUsd: unclaimedFee0Usd + unclaimedFee1Usd,
        },
        positionEfficiency: getCapitalEfficiencyMultiplier(tickLower, tickUpper),
        impermanentLoss: {
          value: null,
          reason:
            "Requires the position's entry price/amounts (from its Mint or " +
            "IncreaseLiquidity event); not tracked by this scanner yet.",
        },
        feeApr: {
          value: null,
          reason:
            "Requires two time-stamped fee readings (or indexed Collect " +
            "events) to compute a real rate; a single snapshot has no " +
            "elapsed-time baseline to annualize.",
        },
      },
    };
  } catch {
    return null;
  }
}

async function getPoolAddress(
  token0: Address,
  token1: Address,
  fee: number
): Promise<Address> {
  const knownPool = UNISWAP_V3.sepolia.pools.find(
    (pool) =>
      pool.token0.toLowerCase() === token0.toLowerCase() &&
      pool.token1.toLowerCase() === token1.toLowerCase() &&
      pool.fee === fee
  );

  if (knownPool) return knownPool.pool;

  return publicClient.readContract({
    address: UNISWAP_V3.sepolia.factory,
    abi: uniswapV3FactoryAbi,
    functionName: "getPool",
    args: [token0, token1, fee],
  });
}

async function getPoolState(pool: Address): Promise<[bigint, number]> {
  const [sqrtPriceX96, tick] = await publicClient.readContract({
    address: pool,
    abi: uniswapV3PoolAbi,
    functionName: "slot0",
  });

  return [sqrtPriceX96, tick];
}

async function getTokenMetadata(
  address: Address
): Promise<{ symbol: string; decimals: number }> {
  const supportedToken = getSupportedToken(address);
  if (supportedToken) {
    return {
      symbol: supportedToken.symbol,
      decimals: supportedToken.decimals,
    };
  }

  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address,
        abi: erc20MetadataAbi,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address,
        abi: erc20MetadataAbi,
        functionName: "decimals",
      }),
    ]);

    return { symbol, decimals };
  } catch {
    return { symbol: address.slice(0, 6), decimals: 18 };
  }
}

function getAmountsForLiquidity({
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
}: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}): { amount0: bigint; amount1: bigint } {
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);

  if (sqrtPriceX96 <= sqrtRatioA) {
    return {
      amount0: getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity),
      amount1: ZERO_BALANCE,
    };
  }

  if (sqrtPriceX96 < sqrtRatioB) {
    return {
      amount0: getAmount0ForLiquidity(sqrtPriceX96, sqrtRatioB, liquidity),
      amount1: getAmount1ForLiquidity(sqrtRatioA, sqrtPriceX96, liquidity),
    };
  }

  return {
    amount0: ZERO_BALANCE,
    amount1: getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity),
  };
}

function getAmount0ForLiquidity(
  sqrtRatioA: bigint,
  sqrtRatioB: bigint,
  liquidity: bigint
): bigint {
  const [lower, upper] = sortSqrtRatios(sqrtRatioA, sqrtRatioB);

  return (((liquidity * Q96) * (upper - lower)) / upper) / lower;
}

function getAmount1ForLiquidity(
  sqrtRatioA: bigint,
  sqrtRatioB: bigint,
  liquidity: bigint
): bigint {
  const [lower, upper] = sortSqrtRatios(sqrtRatioA, sqrtRatioB);

  return (liquidity * (upper - lower)) / Q96;
}

function sortSqrtRatios(a: bigint, b: bigint): [bigint, bigint] {
  return a < b ? [a, b] : [b, a];
}

// Capital efficiency vs. an equivalent full-range (Uniswap v2-style)
// position at the same liquidity, following the standard Uniswap V3
// concentrated-liquidity formula: multiplier = 1 / (1 - sqrt(Pa/Pb)).
// sqrtRatioAtTick already encodes sqrt(price) in Q64.96 fixed point, so
// sqrt(Pa/Pb) is simply the ratio of the two — no extra squaring/rooting
// needed. This is a widely-used derived metric, not a value any contract
// exposes directly; treat it as an analytical estimate.
function getCapitalEfficiencyMultiplier(
  tickLower: number,
  tickUpper: number
): number | null {
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);

  if (sqrtRatioB === ZERO_BALANCE) return null;

  const ratio = Number(sqrtRatioA) / Number(sqrtRatioB);
  if (!Number.isFinite(ratio) || ratio >= 1) return null;

  return 1 / (1 - ratio);
}

function getSqrtRatioAtTick(tick: number): bigint {
  const absoluteTick = Math.abs(tick);

  if (absoluteTick > 887272) {
    throw new Error(`Uniswap V3 tick out of range: ${tick}`);
  }

  let ratio =
    (absoluteTick & 1) !== 0
      ? TICK_RATIO_CONSTANTS[0]
      : BigInt("0x100000000000000000000000000000000");

  for (let index = 1; index < TICK_RATIO_CONSTANTS.length; index += 1) {
    if ((absoluteTick & (1 << index)) !== 0) {
      ratio = (ratio * TICK_RATIO_CONSTANTS[index]) >> BigInt(128);
    }
  }

  if (tick > 0) {
    ratio = MAX_UINT256 / ratio;
  }

  const shifted = ratio >> BigInt(32);
  return ratio % Q32 === ZERO_BALANCE ? shifted : shifted + BigInt(1);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Uniswap V3 read timed out.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}