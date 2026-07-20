import type {
  AaveAccountSummary,
  LiquidationProjection,
  Recommendation,
  RiskFactor,
  RiskRating,
  RiskReportV2,
  RiskSeverity,
  StressResult,
  StressRisk,
  StressRiskFactor,
  StressScenario,
  TreasuryPosition,
  TreasurySnapshot,
  UniswapPositionMetadata,
} from "@treasuryos/shared";

const STABLE_COINS = new Set(["USDC", "USDT", "DAI"]);
const ETH_ASSETS = new Set(["ETH", "WETH"]);
const MONTHLY_BURN_USD = 120_000;

export function buildRiskReportV2(
  snapshot: TreasurySnapshot,
  stressResults: StressResult[] = []
): RiskReportV2 {
  const walletPositions = snapshot.positions.filter((p) => p.protocol === "Wallet");
  const aavePositions = snapshot.positions.filter((p) => p.protocol === "Aave");
  const uniswapPositions = snapshot.positions.filter((p) => p.protocol === "Uniswap");

  const walletRisk = scoreWalletRisk(walletPositions, snapshot.totalValueUsd);
  const aaveRisk = scoreAaveRisk(aavePositions);
  const uniswapRisk = scoreUniswapRisk(uniswapPositions);
  const treasuryRisk = scoreTreasuryRisk(snapshot);
  const stressRisk = scoreStressRisk(snapshot, stressResults, aavePositions);

  const allFactors = [
    ...walletRisk.factors,
    ...aaveRisk.factors,
    ...uniswapRisk.factors,
    ...treasuryRisk.factors,
    ...stressRisk.factors,
  ];

  const compositeRisk = computeCompositeRisk(allFactors, snapshot);
  const recommendations = generateRecommendations(allFactors, snapshot);

  return {
    address: snapshot.address,
    snapshot,
    walletRisk,
    aaveRisk,
    uniswapRisk,
    treasuryRisk,
    stressRisk,
    compositeRisk,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export function scoreWalletRisk(
  positions: TreasuryPosition[],
  totalValueUsd: number
) {
  const factors: RiskFactor[] = [];

  if (totalValueUsd === 0) {
    return { factors };
  }

  const ethPositions = positions.filter((p) => ETH_ASSETS.has(p.asset));
  const stablePositions = positions.filter((p) => STABLE_COINS.has(p.asset));
  const idlePositions = positions.filter((p) => p.amountUsd > 0 && !STABLE_COINS.has(p.asset) && !ETH_ASSETS.has(p.asset));

  const ethExposure = ethPositions.reduce((sum, p) => sum + p.amountUsd, 0);
  const ethRatio = ethExposure / totalValueUsd;

  if (ethRatio > 0.7) {
    factors.push({
      id: "wallet-eth-concentration",
      category: "Wallet",
      severity: ethRatio > 0.9 ? "critical" : "high",
      title: "High ETH concentration",
      description: `ETH represents ${percent(ethRatio)} of wallet holdings.`,
      metric: `${percent(ethRatio)} ETH`,
      recommendation: "Reduce ETH exposure below 70% of wallet holdings.",
    });
  }

  const stableExposure = stablePositions.reduce((sum, p) => sum + p.amountUsd, 0);
  const stableRatio = stableExposure / totalValueUsd;

  if (stableRatio < 0.1 && totalValueUsd > 1000) {
    factors.push({
      id: "wallet-low-stablecoins",
      category: "Wallet",
      severity: "medium",
      title: "Low stablecoin allocation",
      description: `Stablecoins represent only ${percent(stableRatio)} of wallet holdings.`,
      metric: `${percent(stableRatio)} stablecoins`,
      recommendation: "Increase stablecoin reserves to at least 10% of holdings.",
    });
  }

  const idleExposure = idlePositions.reduce((sum, p) => sum + p.amountUsd, 0);

  if (idleExposure > 100) {
    factors.push({
      id: "wallet-idle-capital",
      category: "Wallet",
      severity: "low",
      title: "Idle capital detected",
      description: `${usd(idleExposure)} in non-stable, non-ETH assets is idle in wallet.`,
      metric: usd(idleExposure),
      recommendation: "Consider deploying idle capital into yield-generating protocols.",
    });
  }

  if (factors.length === 0) {
    factors.push({
      id: "wallet-healthy",
      category: "Wallet",
      severity: "low",
      title: "Wallet risk is low",
      description: "No significant wallet concentration or idle capital issues detected.",
    });
  }

  return { factors };
}

export function scoreAaveRisk(positions: TreasuryPosition[]) {
  const factors: RiskFactor[] = [];

  if (positions.length === 0) {
    return { factors };
  }

  const supplied = positions.filter((p) => p.metadata?.positionType === "supplied");
  const borrowed = positions.filter((p) => p.metadata?.positionType === "borrowed");

  const accountSummary = positions[0]?.metadata?.accountSummary as
    | AaveAccountSummary
    | undefined;

  if (!accountSummary) {
    return { factors };
  }

  if (accountSummary.healthFactor !== null) {
    if (accountSummary.healthFactor < 1) {
      factors.push({
        id: "aave-liquidation-risk",
        category: "Aave",
        severity: "critical",
        title: "Liquidatable position",
        description: `Health factor is ${accountSummary.healthFactor.toFixed(2)}. Position is at risk of liquidation.`,
        metric: `HF: ${accountSummary.healthFactor.toFixed(2)}`,
        recommendation: "Repay debt or add collateral immediately to avoid liquidation.",
      });
    } else if (accountSummary.healthFactor < 1.5) {
      factors.push({
        id: "aave-at-risk",
        category: "Aave",
        severity: "high",
        title: "Health factor below safe threshold",
        description: `Health factor is ${accountSummary.healthFactor.toFixed(2)}. Aave's own frontend warns below 1.5.`,
        metric: `HF: ${accountSummary.healthFactor.toFixed(2)}`,
        recommendation: "Repay part of the loan or add collateral to raise health factor above 1.5.",
      });
    }
  }

  const totalBorrowedUsd = Math.abs(
    borrowed.reduce((sum, p) => sum + p.amountUsd, 0)
  );

  if (totalBorrowedUsd > 0) {
    factors.push({
      id: "aave-borrow-exposure",
      category: "Aave",
      severity: totalBorrowedUsd > 10000 ? "high" : "medium",
      title: "Active borrow exposure",
      description: `${usd(totalBorrowedUsd)} is borrowed against Aave collateral.`,
      metric: usd(totalBorrowedUsd),
      recommendation: "Monitor borrow exposure relative to collateral to avoid liquidation.",
    });
  }

  if (accountSummary.liquidationThresholdPercent < 70) {
    factors.push({
      id: "aave-low-liquidation-threshold",
      category: "Aave",
      severity: "medium",
      title: "Low liquidation threshold collateral",
      description: `Collateral liquidation threshold is ${accountSummary.liquidationThresholdPercent.toFixed(1)}%.`,
      metric: `${accountSummary.liquidationThresholdPercent.toFixed(1)}%`,
      recommendation: "Consider replacing low-LTV collateral with higher-LTV assets.",
    });
  }

  if (accountSummary.availableBorrowUsd <= 0 && accountSummary.healthFactor !== null) {
    factors.push({
      id: "aave-no-available-borrow",
      category: "Aave",
      severity: "low",
      title: "No available borrowing capacity",
      description: "All borrowing capacity is used.",
      metric: "$0 available",
      recommendation: "Repay debt or add collateral to restore borrowing capacity.",
    });
  }

  if (factors.length === 0) {
    factors.push({
      id: "aave-healthy",
      category: "Aave",
      severity: "low",
      title: "Aave risk is low",
      description: "No significant Aave risk factors detected.",
    });
  }

  return { factors };
}

export function scoreUniswapRisk(positions: TreasuryPosition[]) {
  const factors: RiskFactor[] = [];

  if (positions.length === 0) {
    return { factors };
  }

  const totalUniswapValue = positions.reduce((sum, p) => sum + p.amountUsd, 0);

  for (const position of positions) {
    const metadata = position.metadata as UniswapPositionMetadata | undefined;

    if (!metadata) continue;

    if (metadata.inRange === false) {
      factors.push({
        id: `uniswap-out-of-range-${metadata.tokenId ?? position.asset}`,
        category: "Uniswap",
        severity: "medium",
        title: `Position out of range: ${position.asset}`,
        description: "Position is not currently collecting fees.",
        metric: position.asset,
        recommendation: "Rebalance position to bring it back within the active price range.",
      });
    }

    const efficiency = metadata.positionEfficiency;

    if (efficiency !== null && efficiency < 1.5) {
      factors.push({
        id: `uniswap-low-efficiency-${metadata.tokenId ?? position.asset}`,
        category: "Uniswap",
        severity: "low",
        title: `Low capital efficiency: ${position.asset}`,
        description: `Position efficiency is ${efficiency.toFixed(1)}x vs full-range.`,
        metric: `${efficiency.toFixed(1)}x`,
        recommendation: "Consider tightening range to improve capital efficiency.",
      });
    }

    const unclaimedUsd = metadata.unclaimedFees?.totalUsd ?? 0;

    if (unclaimedUsd > 10) {
      factors.push({
        id: `uniswap-unclaimed-fees-${metadata.tokenId ?? position.asset}`,
        category: "Uniswap",
        severity: "low",
        title: `Unclaimed fees available: ${position.asset}`,
        description: `${usd(unclaimedUsd)} in fees has not been collected.`,
        metric: usd(unclaimedUsd),
        recommendation: "Collect fees to realize yield.",
      });
    }
  }

  if (factors.length === 0) {
    factors.push({
      id: "uniswap-healthy",
      category: "Uniswap",
      severity: "low",
      title: "Uniswap risk is low",
      description: "All positions are in range and efficiently positioned.",
    });
  }

  return { factors };
}

export function scoreTreasuryRisk(snapshot: TreasurySnapshot) {
  const factors: RiskFactor[] = [];

  if (snapshot.totalValueUsd === 0) {
    return { factors };
  }

  const protocolExposure = new Map<string, number>();
  const assetExposure = new Map<string, number>();

  for (const position of snapshot.positions) {
    protocolExposure.set(
      position.protocol,
      (protocolExposure.get(position.protocol) ?? 0) + position.amountUsd
    );
    assetExposure.set(
      position.asset,
      (assetExposure.get(position.asset) ?? 0) + position.amountUsd
    );
  }

  const nonWalletProtocols = [...protocolExposure.entries()].filter(
    ([protocol]) => protocol !== "Wallet"
  );

  if (nonWalletProtocols.length === 1) {
    const [protocol, exposure] = nonWalletProtocols[0];
    const ratio = exposure / snapshot.totalValueUsd;

    if (ratio > 0.5) {
      factors.push({
        id: "treasury-protocol-concentration",
        category: "Treasury",
        severity: ratio > 0.8 ? "high" : "medium",
        title: "Protocol concentration risk",
        description: `${percent(ratio)} of treasury value is in ${protocol}.`,
        metric: `${protocol} ${percent(ratio)}`,
        recommendation: "Diversify exposure across multiple protocols.",
      });
    }
  }

  const sortedAssets = [...assetExposure.entries()].sort((a, b) => b[1] - a[1]);

  if (sortedAssets.length > 0) {
    const [topAsset, topExposure] = sortedAssets[0];
    const topRatio = topExposure / snapshot.totalValueUsd;

    if (topRatio > 0.7) {
      factors.push({
        id: "treasury-asset-concentration",
        category: "Treasury",
        severity: topRatio > 0.9 ? "critical" : "high",
        title: "Asset concentration risk",
        description: `${topAsset} represents ${percent(topRatio)} of total treasury value.`,
        metric: `${topAsset} ${percent(topRatio)}`,
        recommendation: `Reduce ${topAsset} exposure below 70% of total value.`,
      });
    }
  }

  const stableExposure = [...assetExposure.entries()]
    .filter(([asset]) => STABLE_COINS.has(asset))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const stableRatio = stableExposure / snapshot.totalValueUsd;

  if (stableRatio < 0.2 && snapshot.totalValueUsd > 5000) {
    factors.push({
      id: "treasury-low-stablecoins",
      category: "Treasury",
      severity: "medium",
      title: "Low stablecoin allocation",
      description: `Only ${percent(stableRatio)} of treasury is in stablecoins.`,
      metric: `${percent(stableRatio)} stablecoins`,
      recommendation: "Increase stablecoin allocation to at least 20% for operational runway.",
    });
  }

  const runwayMonths = snapshot.totalValueUsd / MONTHLY_BURN_USD;

  if (runwayMonths < 3 && snapshot.totalValueUsd > 0) {
    factors.push({
      id: "treasury-low-runway",
      category: "Treasury",
      severity: runwayMonths < 1 ? "critical" : "high",
      title: "Low treasury runway",
      description: `At current burn, treasury runway is ${runwayMonths.toFixed(1)} months.`,
      metric: `${runwayMonths.toFixed(1)} mo`,
      recommendation: "Increase treasury reserves or reduce burn rate to extend runway above 3 months.",
    });
  }

  if (factors.length === 0) {
    factors.push({
      id: "treasury-healthy",
      category: "Treasury",
      severity: "low",
      title: "Treasury risk is low",
      description: "No significant treasury-level risk factors detected.",
    });
  }

  return { factors };
}

export function scoreStressRisk(
  snapshot: TreasurySnapshot,
  stressResults: StressResult[],
  aavePositions: TreasuryPosition[]
): StressRisk {
  const factors: StressRiskFactor[] = [];

  if (snapshot.totalValueUsd === 0 || stressResults.length === 0) {
    return { factors };
  }

  const scenarioLabels: Record<StressScenario, string> = {
    "ETH_-50": "ETH -50%",
    "STABLE_DEPEG_-10": "Stablecoin depeg -10%",
    PROTOCOL_FAILURE: "Protocol failure",
  };

  const scenarioDescriptions: Record<StressScenario, (loss: number) => string> = {
    "ETH_-50": (loss) =>
      `A 50% ETH market decline would reduce treasury value by ${loss.toFixed(0)}%.`,
    "STABLE_DEPEG_-10": (loss) =>
      `A 10% stablecoin depeg would reduce treasury value by ${loss.toFixed(0)}%.`,
    PROTOCOL_FAILURE: (loss) =>
      loss > 0
        ? `A protocol failure would reduce treasury value by ${loss.toFixed(0)}%.`
        : "A protocol failure would have limited net impact on this treasury.",
  };

  const aaveAccountSummary = aavePositions[0]?.metadata?.accountSummary as
    | AaveAccountSummary
    | undefined;

  for (const result of stressResults) {
    const lossPercent =
      ((result.currentValueUsd - result.stressedValueUsd) / result.currentValueUsd) *
      100;

    const severity = lossPercentToSeverity(lossPercent);

    const description = scenarioDescriptions[result.scenario](lossPercent);

    const factor: StressRiskFactor = {
      id: `stress-${result.scenario.toLowerCase()}`,
      category: "Stress",
      scenario: result.scenario,
      severity,
      title: `${scenarioLabels[result.scenario]} Sensitivity`,
      description,
      recommendation: severity === "critical" || severity === "high"
        ? `Reduce exposure to ${scenarioLabels[result.scenario]} stress.`
        : undefined,
      lossPercent,
      projectedValueUsd: result.stressedValueUsd,
      currentValueUsd: result.currentValueUsd,
    };

    if (
      aaveAccountSummary &&
      aaveAccountSummary.healthFactor !== null &&
      aaveAccountSummary.totalCollateralUsd > 0
    ) {
      const projection = projectLiquidationUnderStress(
        aaveAccountSummary,
        result.scenario,
        snapshot
      );

      if (projection) {
        factor.liquidationProjection = projection;
      }
    }

    factors.push(factor);
  }

  return { factors };
}

export function computeCompositeRisk(
  factors: Array<RiskFactor | StressRiskFactor>,
  snapshot: TreasurySnapshot
): { rating: RiskRating; score: number; factors: Array<RiskFactor | StressRiskFactor> } {
  if (snapshot.totalValueUsd === 0) {
    return { rating: "N/A", score: 0, factors: [] };
  }

  const severityScores: Record<RiskSeverity, number> = {
    low: 10,
    medium: 30,
    high: 60,
    critical: 90,
  };

  let weightedSum = 0;
  let weightTotal = 0;

  for (const factor of factors) {
    const severityScore = severityScores[factor.severity];
    const categoryWeight = categoryWeightFor(factor.category);
    weightedSum += severityScore * categoryWeight;
    weightTotal += categoryWeight;
  }

  const score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  const rating = ratingForScore(score);

  return {
    rating,
    score,
    factors,
  };
}

export function generateRecommendations(
  factors: Array<RiskFactor | StressRiskFactor>,
  _snapshot: TreasurySnapshot
) {
  const recommendations: Recommendation[] = [];

  for (const factor of factors) {
    if (factor.recommendation && factor.severity !== "low") {
      recommendations.push({
        priority: factor.severity,
        action: factor.recommendation,
        reason: factor.description,
      });
    }
  }

  recommendations.sort((a, b) => {
    const order: Record<RiskSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return order[a.priority] - order[b.priority];
  });

  return recommendations.slice(0, 10);
}

function categoryWeightFor(category: string): number {
  switch (category) {
    case "Aave":
      return 3;
    case "Uniswap":
      return 2;
    case "Wallet":
      return 2;
    case "Treasury":
      return 3;
    case "Stress":
      return 3;
    default:
      return 1;
  }
}

function ratingForScore(score: number): RiskRating {
  if (score <= 20) return "A";
  if (score <= 40) return "B";
  if (score <= 60) return "C";
  if (score <= 80) return "D";
  return "F";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function lossPercentToSeverity(lossPercent: number): RiskSeverity {
  const clampedLoss = Math.max(0, lossPercent);
  if (clampedLoss >= 50) return "critical";
  if (clampedLoss >= 30) return "high";
  if (clampedLoss >= 15) return "medium";
  return "low";
}

function projectLiquidationUnderStress(
  accountSummary: AaveAccountSummary,
  scenario: StressScenario,
  snapshot: TreasurySnapshot
): LiquidationProjection | undefined {
  const currentHF = accountSummary.healthFactor;
  const totalCollateral = accountSummary.totalCollateralUsd;

  if (currentHF === null || totalCollateral <= 0) return undefined;

  const aavePositions = snapshot.positions.filter((p) => p.protocol === "Aave");
  let stressedCollateral = totalCollateral;

  if (scenario === "ETH_-50") {
    const ethCollateral = aavePositions
      .filter((p) => p.metadata?.positionType === "supplied" && ETH_ASSETS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0);
    stressedCollateral = totalCollateral - ethCollateral * 0.5;
  } else if (scenario === "STABLE_DEPEG_-10") {
    const stableCollateral = aavePositions
      .filter((p) => p.metadata?.positionType === "supplied" && STABLE_COINS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0);
    stressedCollateral = totalCollateral - stableCollateral * 0.1;
  } else if (scenario === "PROTOCOL_FAILURE") {
    stressedCollateral = 0;
  }

  const projectedHF =
    stressedCollateral > 0
      ? currentHF * (stressedCollateral / totalCollateral)
      : 0;

  let status: "healthy" | "at-risk" | "liquidatable";

  if (projectedHF < 1) {
    status = "liquidatable";
  } else if (projectedHF < 1.5) {
    status = "at-risk";
  } else {
    status = "healthy";
  }

  return {
    currentHealthFactor: currentHF,
    projectedHealthFactor: projectedHF,
    status,
  };
}
