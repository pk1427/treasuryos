import type { TreasuryPosition, TreasurySnapshot } from "@treasuryos/shared";
import { getNativeBalance, getTokenBalances, normalizeAddress } from "./balances";
import { getTokenPrice } from "./prices";
import { scanProtocolPositions } from "./protocols";

export async function scanTreasury(address: string): Promise<TreasurySnapshot> {
  const normalizedAddress = normalizeAddress(address);
  const [nativeBalance, tokenBalances, protocolPositions] = await Promise.all([
    getNativeBalance(normalizedAddress),
    getTokenBalances(normalizedAddress),
    scanProtocolPositions(normalizedAddress),
  ]);

  const discoveredBalances = [
    ...(nativeBalance ? [nativeBalance] : []),
    ...tokenBalances,
  ];

  const walletPositions = discoveredBalances
    .map<TreasuryPosition>((balance) => ({
      protocol: "Wallet",
      asset: balance.symbol,
      type: "wallet",
      amountUsd: roundUsd(Number.parseFloat(balance.amount) * getTokenPrice(balance.symbol)),
    }))
    .filter((position) => position.amountUsd > 0);
  const positions = [...walletPositions, ...protocolPositions];

  return {
    address: normalizedAddress,
    positions,
    totalValueUsd: roundUsd(
      positions.reduce((sum, position) => sum + position.amountUsd, 0)
    ),
    fetchedAt: new Date().toISOString(),
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
