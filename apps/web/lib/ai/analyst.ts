import { scanTreasury } from "@treasuryos/indexer";
import { buildRiskReportV2 } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import { buildBriefingPrompt } from "./prompts";
import type { TreasuryBriefing } from "./prompts";
import { openAiBriefing } from "./providers/openai";
import { openRouterBriefing } from "./providers/openrouter";

export type AIProvider = "openai" | "openrouter";

export async function generateTreasuryBriefing(
  address: string,
  provider?: AIProvider
): Promise<TreasuryBriefing> {
  const selectedProvider =
    provider ?? (process.env.AI_PROVIDER as AIProvider) ?? "openrouter";

  const snapshot = await scanTreasury(address);
  const stressResults = runStressScenarios(snapshot);
  const riskV2 = buildRiskReportV2(snapshot, stressResults);
  const prompt = buildBriefingPrompt(snapshot, riskV2);

  try {
    switch (selectedProvider) {
      case "openai":
        return openAiBriefing(prompt);
      case "openrouter":
      default:
        return openRouterBriefing(prompt);
    }
  } catch (error) {
    console.error("AI briefing generation failed:", error);
    return {
      summary:
        error instanceof Error
          ? `Failed to generate treasury briefing: ${error.message}`
          : "Failed to generate treasury briefing. Please try again later.",
      keyRisks: [],
      recommendations: [],
      confidence: "low",
    };
  }
}
