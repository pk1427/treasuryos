import type { TreasuryPosition, TreasurySnapshot } from "@treasuryos/shared";

const DEMO_POSITIONS: TreasuryPosition[] = [
  { protocol: "Wallet", asset: "USDC", amountUsd: 620_000 },
  { protocol: "Wallet", asset: "ETH", amountUsd: 210_000 },
  { protocol: "Aave", asset: "USDC", amountUsd: 115_000 },
  { protocol: "Uniswap", asset: "ETH/USDC LP", amountUsd: 55_000 },
];

export async function scanTreasury(address: string): Promise<TreasurySnapshot> {
  const normalizedAddress = normalizeAddress(address);
  const positions = applyAddressVariation(DEMO_POSITIONS, normalizedAddress);
  const totalValueUsd = roundUsd(
    positions.reduce((sum, position) => sum + position.amountUsd, 0)
  );

  return {
    address: normalizedAddress,
    positions,
    totalValueUsd,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeAddress(address: string): string {
  const trimmed = address.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error("Expected an EVM address in 0x format.");
  }

  return `0x${trimmed.slice(2).toLowerCase()}`;
}

function applyAddressVariation(
  positions: TreasuryPosition[],
  address: string
): TreasuryPosition[] {
  const seed = parseInt(address.slice(-4), 16);
  const variation = 0.92 + (seed % 17) / 100;

  return positions.map((position, index) => ({
    ...position,
    amountUsd: roundUsd(position.amountUsd * (variation + index * 0.015)),
  }));
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
