import type { RiskReportV2, TreasurySnapshot } from "@treasuryos/shared";

export type TreasuryBriefing = {
  summary: string;
  keyRisks: Array<{
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    explanation: string;
  }>;
  recommendations: Array<{
    priority: "low" | "medium" | "high" | "critical";
    action: string;
    reason: string;
  }>;
  confidence: "high" | "medium" | "low";
};

export function buildBriefingPrompt(
  snapshot: TreasurySnapshot,
  riskV2: RiskReportV2
): string {
  const lines: string[] = [
    "You are a senior treasury analyst. Generate a concise, factual treasury briefing based ONLY on the provided data.",
    "Do not invent balances, prices, or recommendations. Do not execute any actions.",
    "",
    "=== TREASURY DATA ===",
    `Address: ${snapshot.address}`,
    `Total Value: $${snapshot.totalValueUsd.toLocaleString()}`,
    `Positions: ${snapshot.positions.length}`,
    "",
  ];

  if (snapshot.positions.length > 0) {
    lines.push("Positions:");
    for (const position of snapshot.positions) {
      const sign = position.amountUsd < 0 ? "-" : "";
      lines.push(
        `- ${position.protocol} / ${position.asset}: ${sign}$${Math.abs(position.amountUsd).toLocaleString()}`
      );
    }
    lines.push("");
  }

  if (riskV2.walletRisk.factors.length > 0) {
    lines.push("=== WALLET RISK ===");
    for (const factor of riskV2.walletRisk.factors) {
      lines.push(`- [${factor.severity.toUpperCase()}] ${factor.title}: ${factor.description}`);
    }
    lines.push("");
  }

  if (riskV2.aaveRisk.factors.length > 0) {
    lines.push("=== AAVE RISK ===");
    for (const factor of riskV2.aaveRisk.factors) {
      lines.push(`- [${factor.severity.toUpperCase()}] ${factor.title}: ${factor.description}`);
      if (factor.metric) {
        lines.push(`  Metric: ${factor.metric}`);
      }
    }
    lines.push("");
  }

  if (riskV2.uniswapRisk.factors.length > 0) {
    lines.push("=== UNISWAP RISK ===");
    for (const factor of riskV2.uniswapRisk.factors) {
      lines.push(`- [${factor.severity.toUpperCase()}] ${factor.title}: ${factor.description}`);
    }
    lines.push("");
  }

  if (riskV2.treasuryRisk.factors.length > 0) {
    lines.push("=== TREASURY RISK ===");
    for (const factor of riskV2.treasuryRisk.factors) {
      lines.push(`- [${factor.severity.toUpperCase()}] ${factor.title}: ${factor.description}`);
      if (factor.metric) {
        lines.push(`  Metric: ${factor.metric}`);
      }
    }
    lines.push("");
  }

  if (riskV2.stressRisk.factors.length > 0) {
    lines.push("=== STRESS RISK ===");
    for (const factor of riskV2.stressRisk.factors) {
      lines.push(
        `- [${factor.severity.toUpperCase()}] ${factor.title}: ${factor.description}`
      );
      lines.push(
        `  Projected value: $${factor.projectedValueUsd.toLocaleString()} (${factor.lossPercent.toFixed(1)}% loss)`
      );
      if (factor.liquidationProjection) {
        const lp = factor.liquidationProjection;
        lines.push(
          `  Liquidation Projection: Current HF ${lp.currentHealthFactor.toFixed(2)} → Projected HF ${lp.projectedHealthFactor.toFixed(2)} (${lp.status})`
        );
      }
    }
    lines.push("");
  }

  if (riskV2.recommendations.length > 0) {
    lines.push("=== RECOMMENDATIONS ===");
    for (let i = 0; i < riskV2.recommendations.length; i++) {
      const rec = riskV2.recommendations[i];
      lines.push(
        `${i + 1}. [${rec.priority.toUpperCase()}] ${rec.action} — ${rec.reason}`
      );
    }
    lines.push("");
  }

  lines.push("=== COMPOSITE RISK ===");
  lines.push(
    `Rating: ${riskV2.compositeRisk.rating} (${riskV2.compositeRisk.score}/100)`
  );
  lines.push("");

  lines.push("=== OUTPUT FORMAT ===");
  lines.push("Return JSON with this exact shape:");
  lines.push(`{
  "summary": "2-4 sentences summarizing the treasury state.",
  "keyRisks": [
    { "title": "Risk title", "severity": "critical", "explanation": "Why it matters." }
  ],
  "recommendations": [
    { "priority": "critical", "action": "What to do.", "reason": "Why." }
  ],
  "confidence": "high"
}`);

  return lines.join("\n");
}
