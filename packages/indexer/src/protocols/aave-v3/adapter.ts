import type { TreasuryPosition } from "@treasuryos/shared";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../client";
import { getTokenPrice } from "../../prices";
import type { TreasuryProtocolAdapter } from "../adapter";
import {
  aaveIncentivesControllerAbi,
  aaveOracleAbi,
  aavePoolAbi,
  aavePoolAddressesProviderAbi,
  aavePoolReserveDataAbi,
  aaveRewardsControllerAbi,
  erc20BalanceAbi,
  erc20MetadataAbi,
} from "./abi";
import { AAVE_V3, type AaveV3Reserve } from "./addresses";

const ZERO_BALANCE = BigInt(0);
const BASIS_POINTS_DIVISOR = 100; // Aave returns ltv/liquidationThreshold in bps (e.g. 8000 = 80.00%)
const RAY = 10 ** 27; // Aave interest rates are fixed-point, base 1e27 ("ray")
const SECONDS_PER_YEAR = 31_536_000;

export type AaveAccountSummary = {
  healthFactor: number | null; // null = no debt (infinite health factor)
  currentLtvPercent: number;
  liquidationThresholdPercent: number;
  availableBorrowUsd: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  collateralStatus: "No Debt" | "Healthy" | "At Risk" | "Liquidatable";
  rewardsUsd: number;
  rewardsSource: "live" | "not-supported";
};

export const aaveV3Adapter: TreasuryProtocolAdapter = {
  id: "aave-v3",
  name: "Aave V3",
  async scan(address) {
    const rewardsController = await discoverRewardsController();

    const [reservePositions, accountSummary] = await Promise.all([
      Promise.all(
        AAVE_V3.sepolia.reserves.map((reserve) => scanReserve(address, reserve))
      ),
      getAccountSummary(address, rewardsController),
    ]);

    const positions = reservePositions.flat();

    if (!accountSummary || positions.length === 0) return positions;

    return positions.map((position) => ({
      ...position,
      metadata: {
        ...position.metadata,
        accountSummary,
      },
    }));
  },
};

async function discoverRewardsController(): Promise<Address | null> {
  for (const reserve of AAVE_V3.sepolia.reserves) {
    try {
      const controller = await publicClient.readContract({
        address: reserve.aToken,
        abi: aaveIncentivesControllerAbi,
        functionName: "getIncentivesController",
      });

      if (controller && controller !== "0x0000000000000000000000000000000000000000") {
        return controller;
      }
    } catch {
      // Try next reserve
    }
  }

  return null;
}

async function scanReserve(
  address: Address,
  reserve: AaveV3Reserve
): Promise<TreasuryPosition[]> {
  try {
    const [suppliedBalance, borrowedBalance, rates] = await Promise.all([
      readBalance(reserve.aToken, address),
      readBalance(reserve.variableDebtToken, address),
      getReserveRates(reserve.underlying),
    ]);

    const positions: TreasuryPosition[] = [];

    if (suppliedBalance > ZERO_BALANCE) {
      const position = await buildAaveSupplyPosition({
        reserve,
        balance: suppliedBalance,
        supplyApyPercent: rates?.supplyApyPercent ?? null,
      });
      if (position.amountUsd > 0) positions.push(position);
    }

    if (borrowedBalance > ZERO_BALANCE) {
      const position = await buildAaveDebtPosition({
        reserve,
        balance: borrowedBalance,
        borrowApyPercent: rates?.borrowApyPercent ?? null,
      });
      if (position.amountUsd < 0) positions.push(position);
    }

    return positions;
  } catch {
    return [];
  }
}

async function readBalance(token: Address, account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [account],
  });
}

// Real supply/borrow rates read from the Pool's reserve data — never
// hardcoded. Aave's currentLiquidityRate/currentVariableBorrowRate are a
// nominal per-second-compounding rate expressed in ray (1e27); converting
// that to the conventional compounded APY uses Aave's own published
// formula (matches @aave/math-utils' apr-to-apy conversion):
//   APY = (1 + APR/secondsPerYear)^secondsPerYear − 1
async function getReserveRates(
  underlying: Address
): Promise<{ supplyApyPercent: number; borrowApyPercent: number } | null> {
  try {
    const reserveData = await publicClient.readContract({
      address: AAVE_V3.sepolia.pool,
      abi: aavePoolReserveDataAbi,
      functionName: "getReserveData",
      args: [underlying],
    });

    return {
      supplyApyPercent: rayRateToApyPercent(reserveData.currentLiquidityRate),
      borrowApyPercent: rayRateToApyPercent(reserveData.currentVariableBorrowRate),
    };
  } catch {
    return null;
  }
}

function rayRateToApyPercent(rateRay: bigint): number {
  const apr = Number(rateRay) / RAY;
  const apy = (1 + apr / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1;
  return apy * 100;
}

async function buildAaveSupplyPosition({
  reserve,
  balance,
  supplyApyPercent,
}: {
  reserve: AaveV3Reserve;
  balance: bigint;
  supplyApyPercent: number | null;
}): Promise<TreasuryPosition> {
  const amount = Number(formatUnits(balance, reserve.decimals));
  const { price } = await getTokenPrice(reserve.symbol);
  const amountUsd = amount * price;

  return {
    protocol: "Aave",
    asset: reserve.symbol,
    amountUsd,
    type: "lending",
    tokens: [
      {
        address: reserve.underlying,
        symbol: reserve.symbol,
        amount,
        amountUsd,
      },
    ],
    metadata: {
      market: "Aave V3 Sepolia",
      positionType: "supplied",
      underlying: reserve.underlying,
      aToken: reserve.aToken,
      variableDebtToken: reserve.variableDebtToken,
      apyPercent: supplyApyPercent,
    },
  };
}

// Debt is represented as a distinct position with a negative amountUsd, so
// the existing unified-snapshot total (a plain sum of amountUsd across
// positions) nets automatically to Supplied − Borrowed with no changes
// required elsewhere in the pipeline.
async function buildAaveDebtPosition({
  reserve,
  balance,
  borrowApyPercent,
}: {
  reserve: AaveV3Reserve;
  balance: bigint;
  borrowApyPercent: number | null;
}): Promise<TreasuryPosition> {
  const amount = Number(formatUnits(balance, reserve.decimals));
  const { price } = await getTokenPrice(reserve.symbol);
  const amountUsd = -(amount * price);

  return {
    protocol: "Aave",
    asset: reserve.symbol,
    amountUsd,
    type: "lending",
    tokens: [
      {
        address: reserve.underlying,
        symbol: reserve.symbol,
        amount,
        amountUsd,
      },
    ],
    metadata: {
      market: "Aave V3 Sepolia",
      positionType: "borrowed",
      underlying: reserve.underlying,
      variableDebtToken: reserve.variableDebtToken,
      apyPercent: borrowApyPercent,
    },
  };
}

// Health factor, LTV, liquidation threshold, and available borrow all come
// directly from Aave's own Pool and Oracle contracts — not recomputed or
// approximated from our own per-reserve price reads, since Aave's risk
// engine (per-reserve weighting, its own oracle) is the source of truth for
// these numbers.
async function getAccountSummary(
  address: Address,
  rewardsController: Address | null
): Promise<AaveAccountSummary | null> {
  try {
    const [accountData, oracleAddress, rewardsUsd] = await Promise.all([
      publicClient.readContract({
        address: AAVE_V3.sepolia.pool,
        abi: aavePoolAbi,
        functionName: "getUserAccountData",
        args: [address],
      }),
      publicClient.readContract({
        address: AAVE_V3.sepolia.poolAddressesProvider,
        abi: aavePoolAddressesProviderAbi,
        functionName: "getPriceOracle",
      }),
      getRewardsSummary(address, rewardsController),
    ]);

    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ,
      healthFactor,
    ] = accountData;

    const baseCurrencyUnit = await publicClient.readContract({
      address: oracleAddress,
      abi: aaveOracleAbi,
      functionName: "BASE_CURRENCY_UNIT",
    });

    const unit = Number(baseCurrencyUnit);
    if (!Number.isFinite(unit) || unit <= 0) return null;

    const totalCollateralUsd = Number(totalCollateralBase) / unit;
    const totalDebtUsd = Number(totalDebtBase) / unit;
    const resolvedHealthFactor =
      totalDebtBase === ZERO_BALANCE ? null : Number(formatUnits(healthFactor, 18));

    return {
      healthFactor: resolvedHealthFactor,
      currentLtvPercent:
        totalCollateralBase === ZERO_BALANCE
          ? 0
          : (totalDebtUsd / totalCollateralUsd) * 100,
      liquidationThresholdPercent:
        Number(currentLiquidationThreshold) / BASIS_POINTS_DIVISOR,
      availableBorrowUsd: Number(availableBorrowsBase) / unit,
      totalCollateralUsd,
      totalDebtUsd,
      // Aave doesn't expose a single "collateral status" field on-chain;
      // this is our own classification layered on top of the real
      // healthFactor value above, using the same risk bands Aave's own
      // frontend uses (liquidatable below 1.0, "at risk" warning below 1.5).
      collateralStatus: classifyCollateralStatus(resolvedHealthFactor),
      rewardsUsd: rewardsUsd.totalUsd,
      rewardsSource: rewardsUsd.source,
    };
  } catch {
    return null;
  }
}

function classifyCollateralStatus(
  healthFactor: number | null
): AaveAccountSummary["collateralStatus"] {
  if (healthFactor === null) return "No Debt";
  if (healthFactor < 1) return "Liquidatable";
  if (healthFactor < 1.5) return "At Risk";
  return "Healthy";
}

// Rewards plumbing is generic and protocol-native (Aave's real
// IRewardsController.getAllUserRewards call). The incentives controller is
// auto-discovered from aToken.getIncentivesController() across reserves
// before scanning begins. If none is found, rewards are returned as $0
// with source "not-supported" rather than fabricating a figure.
async function getRewardsSummary(
  address: Address,
  rewardsController: Address | null
): Promise<{ totalUsd: number; source: "live" | "not-supported" }> {
  if (!rewardsController) {
    return { totalUsd: 0, source: "not-supported" };
  }

  try {
    const assets = AAVE_V3.sepolia.reserves.flatMap((reserve) => [
      reserve.aToken,
      reserve.variableDebtToken,
    ]);

    const [rewardsList, unclaimedAmounts] = await publicClient.readContract({
      address: rewardsController,
      abi: aaveRewardsControllerAbi,
      functionName: "getAllUserRewards",
      args: [assets, address],
    });

    const valuedRewards = await Promise.all(
      rewardsList.map(async (rewardToken, index) => {
        const rawAmount = unclaimedAmounts[index];
        if (!rawAmount || rawAmount === ZERO_BALANCE) return 0;

        const [symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: rewardToken,
            abi: erc20MetadataAbi,
            functionName: "symbol",
          }),
          publicClient.readContract({
            address: rewardToken,
            abi: erc20MetadataAbi,
            functionName: "decimals",
          }),
        ]);

        const amount = Number(formatUnits(rawAmount, decimals));
        const { price } = await getTokenPrice(symbol);
        return amount * price;
      })
    );

    return {
      totalUsd: valuedRewards.reduce((sum, value) => sum + value, 0),
      source: "live",
    };
  } catch {
    return { totalUsd: 0, source: "not-supported" };
  }
}