import type { TreasuryBriefing } from "./prompts";

export function safeParseBriefingJson(content: string): TreasuryBriefing {
  const trimmed = content.trim();

  if (trimmed.startsWith("```json")) {
    const match = trimmed.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as TreasuryBriefing;
      } catch {
        // fall through
      }
    }
  }

  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as TreasuryBriefing;
      } catch {
        // fall through
      }
    }
  }

  try {
    return JSON.parse(trimmed) as TreasuryBriefing;
  } catch {
    return {
      summary: trimmed.slice(0, 500),
      keyRisks: [],
      recommendations: [],
      confidence: "medium",
    };
  }
}
