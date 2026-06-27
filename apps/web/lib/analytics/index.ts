import type {
  AnalyticsResult,
  RiskItem,
  RiskLevel,
  TokenBalance,
  TreasurySnapshot,
} from "@/types";

const RUNWAY_HIGH_THRESHOLD = 6;
const CONCENTRATION_THRESHOLD = 0.8;
const IDLE_CAPITAL_THRESHOLD = 0.3;
const LARGE_TX_THRESHOLD = 0.25;
const IDLE_DAYS_THRESHOLD = 30;

function scoreRunway(months: number | null): RiskLevel {
  if (months === null) return "medium";
  if (months < 3) return "critical";
  if (months < RUNWAY_HIGH_THRESHOLD) return "high";
  if (months < 12) return "medium";
  return "low";
}

function scoreConcentration(ratio: number): RiskLevel {
  if (ratio >= 0.9) return "critical";
  if (ratio >= CONCENTRATION_THRESHOLD) return "high";
  if (ratio >= 0.6) return "medium";
  return "low";
}

function scoreIdleCapital(ratio: number): RiskLevel {
  if (ratio >= 0.5) return "critical";
  if (ratio >= IDLE_CAPITAL_THRESHOLD) return "high";
  if (ratio >= 0.15) return "medium";
  return "low";
}

function aggregateRisk(...levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  return levels.reduce(
    (max, level) => (order.indexOf(level) > order.indexOf(max) ? level : max),
    "low" as RiskLevel
  );
}

export function calculateValue(assets: TokenBalance[]): number {
  return assets.reduce((sum, a) => sum + a.usdValue, 0);
}

export function calculateBurnRate(monthlyBurnUsd: number): number {
  return monthlyBurnUsd;
}

export function calculateRunway(
  totalValue: number,
  monthlyBurn: number
): number | null {
  if (monthlyBurn <= 0) return null;
  return totalValue / monthlyBurn;
}

export function calculateConcentration(assets: TokenBalance[]): {
  score: number;
  asset: string;
} {
  const total = calculateValue(assets);
  if (total === 0) return { score: 0, asset: "N/A" };

  const largest = assets.reduce(
    (max, a) => (a.usdValue > max.usdValue ? a : max),
    assets[0]
  );

  return {
    score: largest.usdValue / total,
    asset: largest.symbol,
  };
}

export function calculateIdleCapital(
  assets: TokenBalance[],
  idleDaysThreshold = IDLE_DAYS_THRESHOLD
): { usd: number; days: number } {
  const now = Date.now();
  let idleUsd = 0;
  let maxDays = 0;

  for (const asset of assets) {
    if (!asset.lastMovedAt) continue;
    const daysIdle = Math.floor(
      (now - asset.lastMovedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysIdle >= idleDaysThreshold) {
      idleUsd += asset.usdValue;
      maxDays = Math.max(maxDays, daysIdle);
    }
  }

  return { usd: idleUsd, days: maxDays };
}

export function detectLargeTransactions(
  totalValue: number,
  transactions: Array<{ value: string }>
): RiskItem | null {
  for (const tx of transactions) {
    const txValue = parseFloat(tx.value);
    if (txValue / totalValue > LARGE_TX_THRESHOLD) {
      return {
        type: "treasury_anomaly",
        severity: "high",
        title: "Large Transfer Alert",
        description: `Transaction of $${txValue.toLocaleString()} exceeds 25% of treasury value.`,
      };
    }
  }
  return null;
}

export function calculateRiskScore(
  runwayMonths: number | null,
  concentrationScore: number,
  idleRatio: number
): RiskLevel {
  return aggregateRisk(
    scoreRunway(runwayMonths),
    scoreConcentration(concentrationScore),
    scoreIdleCapital(idleRatio)
  );
}

export function analyzeTreasuryMetrics(
  snapshot: TreasurySnapshot,
  transactions: Array<{ value: string }> = []
): AnalyticsResult {
  const totalValue = calculateValue(snapshot.assets);
  const burnRate = calculateBurnRate(snapshot.monthlyBurnUsd);
  const runwayMonths = calculateRunway(totalValue, burnRate);
  const { score: concentrationScore, asset: concentrationAsset } =
    calculateConcentration(snapshot.assets);
  const { usd: idleCapitalUsd, days: idleCapitalDays } = calculateIdleCapital(
    snapshot.assets
  );
  const idleRatio = totalValue > 0 ? idleCapitalUsd / totalValue : 0;
  const riskScore = calculateRiskScore(
    runwayMonths,
    concentrationScore,
    idleRatio
  );

  const risks: RiskItem[] = [];

  if (concentrationScore >= CONCENTRATION_THRESHOLD) {
    risks.push({
      type: "concentration",
      severity: scoreConcentration(concentrationScore),
      title: "High Asset Concentration",
      description: `${concentrationAsset} represents ${(concentrationScore * 100).toFixed(0)}% of treasury value.`,
    });
  }

  if (runwayMonths !== null && runwayMonths < RUNWAY_HIGH_THRESHOLD) {
    risks.push({
      type: "runway",
      severity: scoreRunway(runwayMonths),
      title: "Low Runway",
      description: `Treasury runway is ${runwayMonths.toFixed(1)} months at current burn rate.`,
    });
  }

  if (idleRatio >= IDLE_CAPITAL_THRESHOLD) {
    risks.push({
      type: "idle_capital",
      severity: scoreIdleCapital(idleRatio),
      title: "Idle Capital",
      description: `$${idleCapitalUsd.toLocaleString()} unused for ${idleCapitalDays} days.`,
    });
  }

  const largeTxRisk = detectLargeTransactions(totalValue, transactions);
  if (largeTxRisk) risks.push(largeTxRisk);

  return {
    totalValue,
    burnRate,
    runwayMonths,
    concentrationScore,
    concentrationAsset,
    idleCapitalUsd,
    idleCapitalDays,
    riskScore,
    risks,
  };
}
