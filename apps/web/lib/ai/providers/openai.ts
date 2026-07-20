import type { TreasuryBriefing } from "../prompts";
import { safeParseBriefingJson } from "../utils";

export async function openAiBriefing(
  prompt: string,
  model = "gpt-4o-mini"
): Promise<TreasuryBriefing> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { ChatOpenAI } = await import("@langchain/openai");
  const langchainModel = new ChatOpenAI({
    model,
    temperature: 0.2,
    apiKey,
  });

  const response = await langchainModel.invoke([
    {
      role: "system",
      content:
        "You are a senior treasury analyst. Always respond with valid JSON only. Do not include markdown fences.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  const content = typeof response.content === "string" ? response.content : "";

  const parsed = safeParseBriefingJson(content);

  return {
    summary: parsed.summary ?? "Treasury briefing generated.",
    keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [],
    confidence: parsed.confidence ?? "medium",
  };
}
