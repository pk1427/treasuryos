import type { TreasuryBriefing } from "../prompts";
import { safeParseBriefingJson } from "../utils";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function openRouterBriefing(
  prompt: string,
  model = "deepseek/deepseek-chat-v3"
): Promise<TreasuryBriefing> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior treasury analyst. Always respond with valid JSON only. Do not include markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content ?? "";

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
