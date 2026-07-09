import type { TreasuryPosition } from "@treasuryos/shared";
import { formatUnits, type Address } from "viem";
import { publicClient } from "../../client";
import { getTokenPrice } from "../../prices";
import type { TreasuryProtocolAdapter } from "../adapter";
import { erc20BalanceAbi } from "./abi";
import { AAVE_V3, type AaveV3Reserve } from "./addresses";

const ZERO_BALANCE = BigInt(0);

export const aaveV3Adapter: TreasuryProtocolAdapter = {
  id: "aave-v3",
  name: "Aave V3",
  async scan(address) {
    const positions = await Promise.all(
      AAVE_V3.sepolia.reserves.map((reserve) => scanReserve(address, reserve))
    );

    return positions.flat();
  },
};

async function scanReserve(
  address: Address,
  reserve: AaveV3Reserve
): Promise<TreasuryPosition[]> {
  try {
    const suppliedBalance = await readBalance(reserve.aToken, address);

    if (suppliedBalance > ZERO_BALANCE) {
      const position = buildAavePosition({
        reserve,
        balance: suppliedBalance,
      });

      return position.amountUsd > 0 ? [position] : [];
    }

    return [];
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

function buildAavePosition({
  reserve,
  balance,
}: {
  reserve: AaveV3Reserve;
  balance: bigint;
}): TreasuryPosition {
  const amount = Number(formatUnits(balance, reserve.decimals));
  const amountUsd = amount * getTokenPrice(reserve.symbol);

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
    },
  };
}
