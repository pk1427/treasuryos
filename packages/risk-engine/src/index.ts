import type { RiskRating, RiskScore, TreasurySnapshot } from "@treasuryos/shared";

const LIQUID_ASSETS = new Set(["USDC", "USDT", "DAI", "ETH", "WETH"]);

export function scoreTreasuryRisk(snapshot: TreasurySnapshot): RiskScore {
  if (snapshot.totalValueUsd === 0) {
    return {
      rating: "N/A",
      concentration: 0,
      counterparty: 0,
      liquidity: 0,
      composite: 0,
    };
  }

  const concentration = scoreConcentration(snapshot);
  const counterparty = scoreCounterparty(snapshot);
  const liquidity = scoreLiquidity(snapshot);
  const composite = Math.round(
    concentration * 0.4 + counterparty * 0.3 + liquidity * 0.3
  );

  return {
    concentration,
    counterparty,
    liquidity,
    composite,
    rating: ratingForScore(composite),
  };
}

function scoreConcentration(snapshot: TreasurySnapshot): number {
  if (snapshot.totalValueUsd <= 0) return 100;

  const largestPosition = Math.max(
    ...snapshot.positions.map((position) => position.amountUsd)
  );
  const largestRatio = largestPosition / snapshot.totalValueUsd;

  return clampScore(Math.round(largestRatio * 100));
}

function scoreCounterparty(snapshot: TreasurySnapshot): number {
  if (snapshot.totalValueUsd <= 0) return 100;

  const protocolExposure = new Map<string, number>();
  for (const position of snapshot.positions) {
    protocolExposure.set(
      position.protocol,
      (protocolExposure.get(position.protocol) ?? 0) + position.amountUsd
    );
  }

  const nonWalletExposure = [...protocolExposure.entries()]
    .filter(([protocol]) => protocol !== "Wallet")
    .reduce((sum, [, amountUsd]) => sum + amountUsd, 0);
  const distinctProtocols = [...protocolExposure.keys()].filter(
    (protocol) => protocol !== "Wallet"
  ).length;
  const exposureRatio = nonWalletExposure / snapshot.totalValueUsd;
  const diversificationCredit = Math.min(distinctProtocols * 6, 18);

  return clampScore(Math.round(exposureRatio * 100 - diversificationCredit + 20));
}

function scoreLiquidity(snapshot: TreasurySnapshot): number {
  if (snapshot.totalValueUsd <= 0) return 100;

  const illiquidExposure = snapshot.positions
    .filter((position) => !LIQUID_ASSETS.has(position.asset))
    .reduce((sum, position) => sum + position.amountUsd, 0);

  return clampScore(Math.round((illiquidExposure / snapshot.totalValueUsd) * 100));
}

function ratingForScore(score: number): RiskRating {
  if (score <= 20) return "A";
  if (score <= 40) return "B";
  if (score <= 60) return "C";
  if (score <= 80) return "D";
  return "F";
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
