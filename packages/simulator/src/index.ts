import type {
  StressResult,
  StressScenario,
  TreasuryPosition,
  TreasurySnapshot,
} from "@treasuryos/shared";

const MONTHLY_BURN_USD = 120_000;

export function runStressScenarios(snapshot: TreasurySnapshot): StressResult[] {
  return [
    stress(snapshot, "ETH_-50"),
    stress(snapshot, "STABLE_DEPEG_-10"),
    stress(snapshot, "PROTOCOL_FAILURE"),
  ];
}

function stress(
  snapshot: TreasurySnapshot,
  scenario: StressScenario
): StressResult {
  const stressedValueUsd = roundUsd(
    snapshot.positions.reduce(
      (sum, position) => sum + stressedPositionValue(position, scenario),
      0
    )
  );

  return {
    scenario,
    currentValueUsd: snapshot.totalValueUsd,
    stressedValueUsd,
    runwayMonthsBefore: roundMonths(snapshot.totalValueUsd / MONTHLY_BURN_USD),
    runwayMonthsAfter: roundMonths(stressedValueUsd / MONTHLY_BURN_USD),
  };
}

function stressedPositionValue(
  position: TreasuryPosition,
  scenario: StressScenario
): number {
  if (scenario === "ETH_-50" && position.asset.includes("ETH")) {
    return position.amountUsd * 0.5;
  }

  if (
    scenario === "STABLE_DEPEG_-10" &&
    ["USDC", "USDT", "DAI"].includes(position.asset)
  ) {
    return position.amountUsd * 0.9;
  }

  if (scenario === "PROTOCOL_FAILURE" && position.protocol !== "Wallet") {
    return 0;
  }

  return position.amountUsd;
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMonths(value: number): number {
  return Math.round(value * 10) / 10;
}
