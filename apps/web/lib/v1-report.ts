import { hashRiskReport } from "@treasuryos/attestation";
import { scanTreasury } from "@treasuryos/indexer";
import { scoreTreasuryRisk } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import type { RiskReport } from "@treasuryos/shared";

export async function generateRiskReport(address: string): Promise<{
  report: RiskReport;
  reportHash: `0x${string}`;
}> {
  const snapshot = await scanTreasury(address);
  const score = scoreTreasuryRisk(snapshot);
  const stressResults = runStressScenarios(snapshot);
  const report: RiskReport = {
    address: snapshot.address,
    snapshot,
    score,
    stressResults,
    generatedAt: new Date().toISOString(),
  };

  return {
    report,
    reportHash: hashRiskReport(report),
  };
}
