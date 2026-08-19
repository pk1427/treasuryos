import { createHash } from "node:crypto";
import { scanTreasury } from "@treasuryos/indexer";
import { scoreTreasuryRisk } from "@treasuryos/risk-engine";
import { buildRiskReportV2 } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import type { RiskReport, RiskReportV2 } from "@treasuryos/shared";

export async function generateRiskReport(address: string): Promise<{
  report: RiskReport;
  reportHash: `0x${string}`;
  riskV2: RiskReportV2;
}> {
  const snapshot = await scanTreasury(address);
  const score = scoreTreasuryRisk(snapshot);
  const stressResults = runStressScenarios(snapshot);
  const riskV2 = buildRiskReportV2(snapshot, stressResults);

  const report: RiskReport = {
    address: snapshot.address,
    snapshot,
    score: {
      concentration: score.concentration,
      counterparty: score.counterparty,
      liquidity: score.liquidity,
      composite: riskV2.compositeRisk.score,
      rating: riskV2.compositeRisk.rating,
    },
    stressResults,
    generatedAt: new Date().toISOString(),
    riskV2,
  };

  const reportForHash = stripTimestamps(report);

  return {
    report,
    reportHash: hashRiskReport(reportForHash),
    riskV2,
  };
}

function hashRiskReport(report: unknown): `0x${string}` {
  return `0x${createHash("sha256")
    .update(stableStringify(report))
    .digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stripTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripTimestamps);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, child]) => {
      if (key === "generatedAt" || key === "fetchedAt") {
        return [key, "deterministic"];
      }
      return [key, stripTimestamps(child)];
    });

    return Object.fromEntries(entries);
  }

  return value;
}
