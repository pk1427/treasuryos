import type { ActionPlan, AnalyticsResult, Recommendation } from "@/types";
import { USDC_ADDRESS } from "@/lib/blockchain/constants";

export function generateRecommendations(
  analytics: AnalyticsResult,
  walletAddress: string,
  reserveWalletAddress: string,
  chainId: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (analytics.concentrationScore >= 0.8) {
    const transferAmount = Math.min(
      100_000,
      analytics.totalValue * 0.1
    );
    const actionPlan: ActionPlan = {
      action: "transfer",
      tokenSymbol: analytics.concentrationAsset,
      tokenAddress: USDC_ADDRESS,
      amount: transferAmount.toString(),
      amountUsd: transferAmount,
      from: walletAddress,
      to: reserveWalletAddress,
      chainId,
    };

    recommendations.push({
      type: "concentration",
      severity: analytics.concentrationScore >= 0.9 ? "critical" : "high",
      explanation: `Treasury is heavily concentrated in ${analytics.concentrationAsset} at ${(analytics.concentrationScore * 100).toFixed(0)}%. Single-asset exposure increases depeg and liquidity risk.`,
      recommendation: `Move $${transferAmount.toLocaleString()} ${analytics.concentrationAsset} to reserve treasury wallet to diversify holdings.`,
      actionPlan,
    });
  }

  if (
    analytics.runwayMonths !== null &&
    analytics.runwayMonths < 6
  ) {
    recommendations.push({
      type: "runway",
      severity: analytics.runwayMonths < 3 ? "critical" : "high",
      explanation: `Treasury runway is ${analytics.runwayMonths.toFixed(1)} months at $${analytics.burnRate.toLocaleString()}/month burn rate.`,
      recommendation:
        "Reduce monthly burn, increase revenue, or raise additional capital to extend runway beyond 6 months.",
      actionPlan: {
        action: "transfer",
        tokenSymbol: "USDC",
        tokenAddress: USDC_ADDRESS,
        amount: "0",
        amountUsd: 0,
        from: walletAddress,
        to: reserveWalletAddress,
        chainId,
      },
    });
  }

  if (analytics.idleCapitalUsd > analytics.totalValue * 0.3) {
    recommendations.push({
      type: "idle_capital",
      severity: "medium",
      explanation: `$${analytics.idleCapitalUsd.toLocaleString()} has been idle for ${analytics.idleCapitalDays} days, representing capital inefficiency.`,
      recommendation:
        "Deploy idle capital to yield strategies or move to operational reserve wallet.",
      actionPlan: {
        action: "transfer",
        tokenSymbol: "USDC",
        tokenAddress: USDC_ADDRESS,
        amount: Math.min(50_000, analytics.idleCapitalUsd * 0.1).toString(),
        amountUsd: Math.min(50_000, analytics.idleCapitalUsd * 0.1),
        from: walletAddress,
        to: reserveWalletAddress,
        chainId,
      },
    });
  }

  return recommendations;
}

export async function generateAiExplanation(
  analytics: AnalyticsResult,
  recommendation: Recommendation
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return recommendation.explanation;
  }

  try {
    const { ChatOpenAI } = await import("@langchain/openai");
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
      apiKey,
    });

    const response = await model.invoke([
      {
        role: "system",
        content:
          "You are an AI CFO for onchain protocol treasuries. Provide concise, actionable treasury advice in 2-3 sentences.",
      },
      {
        role: "user",
        content: `Treasury value: $${analytics.totalValue.toLocaleString()}. Runway: ${analytics.runwayMonths?.toFixed(1) ?? "N/A"} months. Concentration: ${(analytics.concentrationScore * 100).toFixed(0)}% in ${analytics.concentrationAsset}. Risk: ${analytics.riskScore}. Recommendation type: ${recommendation.type}. Draft a CFO-style explanation.`,
      },
    ]);

    const content = response.content;
    return typeof content === "string" ? content : recommendation.explanation;
  } catch {
    return recommendation.explanation;
  }
}

export function createActionPlan(
  recommendation: Recommendation
): ActionPlan {
  return recommendation.actionPlan;
}
