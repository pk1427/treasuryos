import { createHash } from "node:crypto";
import { getNativeBalance, scanTreasury } from "@treasuryos/indexer";
import { buildRiskReportV2 } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import { formatEther, parseEther, type Address } from "viem";
import type { ExecutionPlan, PlanStep } from "./plan-types";
import type { TreasurySnapshot } from "@treasuryos/shared";
import { getExecutionAdapterForStep } from "@/lib/execution/registry";
import { summarizeSnapshot, tracePipeline } from "@/lib/debug/pipeline-trace";

const STABLE_COINS = new Set(["USDC", "USDT", "DAI"]);
const ETH_ASSETS = new Set(["ETH", "WETH"]);
const TARGET_ETH_RATIO = 0.7;
const MAX_ETH_SWAP_BPS = 9_500;
const QUOTE_SEARCH_ITERATIONS = 16;
const ZERO_WEI = BigInt(0);
const ONE_WEI = BigInt(1);
const TWO_WEI = BigInt(2);

function computeSnapshotHash(snapshot: TreasurySnapshot): string {
  const positions = snapshot.positions
    .map((p) => `${p.protocol}:${p.asset}:${p.amountUsd.toFixed(2)}`)
    .sort()
    .join("|");

  return `0x${createHash("sha256")
    .update(`${snapshot.address}:${snapshot.totalValueUsd.toFixed(2)}:${positions}`)
    .digest("hex")}`;
}

export async function generateExecutionPlan(
  address: string,
  reportHash?: string
): Promise<ExecutionPlan> {
  const snapshot = await scanTreasury(address);
  const stressResults = runStressScenarios(snapshot);
  const riskV2 = buildRiskReportV2(snapshot, stressResults);

  tracePipeline("planner-input", {
    requestedReportHash: reportHash ?? null,
    snapshot: summarizeSnapshot(snapshot),
    recommendations: riskV2.recommendations.map((recommendation) => recommendation.action),
  });

  const steps: PlanStep[] = [];
  const warnings: string[] = [];
  let order = 0;

  const walletPositions = snapshot.positions.filter((p) => p.protocol === "Wallet");

  const ethExposureUsd =
    walletPositions
      .filter((p) => ETH_ASSETS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0) +
    0;

  const stableExposureUsd =
    walletPositions
      .filter((p) => STABLE_COINS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0) +
    0;

  const totalValue = snapshot.totalValueUsd;
  const ethRatio = totalValue > 0 ? ethExposureUsd / totalValue : 0;
  const rebalanceRecommendation = riskV2.recommendations.find((recommendation) => {
    const action = recommendation.action.toLowerCase();
    return action.includes("reduce eth exposure") || action.includes("stablecoin");
  });

  for (const rec of riskV2.recommendations) {
    const action = rec.action.toLowerCase();
    if (action.includes("treasury runway") || action.includes("increase treasury reserves")) {
      warnings.push(
        "Runway improvement requires capital injection or burn reduction — not addressable by onchain swaps alone."
      );
    }
  }

  if (totalValue > 0 && ethRatio > TARGET_ETH_RATIO) {
    const reason = rebalanceRecommendation?.reason ?? `ETH exposure is ${(ethRatio * 100).toFixed(0)}%, above the ${(TARGET_ETH_RATIO * 100).toFixed(0)}% target.`;
    const step = await sizeEthRebalanceWithQuotes({
      address,
      snapshot,
      ethExposureUsd,
      totalValue,
      order: order + 1,
      reason,
    });

    if (step) {
      order += 1;
      steps.push(step);
    } else {
      warnings.push("No executable ETH → USDC quote can reach the configured allocation target while preserving transaction gas.");
    }
  }

  const dedupedSteps = deduplicateSteps(steps);

  const balanceValidation = validatePlanBalances(snapshot, dedupedSteps);
  const finalSteps = balanceValidation.valid ? dedupedSteps : [];
  const balanceWarnings = balanceValidation.valid
    ? []
    : [
        `Plan rejected: total swap amounts exceed available balances. ${balanceValidation.reason}`,
      ];

  const ethExposureAfterUsd = calculatePostPlanExposure(ethExposureUsd, finalSteps, "fromAsset", "ETH");
  const totalValueAfterUsd = calculatePostPlanValue(totalValue, finalSteps);
  const stableRatioAfter = calculatePostPlanStableRatio(stableExposureUsd, totalValueAfterUsd, finalSteps, "toAsset", "USDC");

  const plan: ExecutionPlan = {
    planId: `plan_${Date.now()}_${address.slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    basedOnReportHash: reportHash ?? computeSnapshotHash(snapshot),
    steps: finalSteps,
    expectedOutcome: {
      healthFactorBefore: null,
      healthFactorAfter: null,
      ethExposureBefore: totalValue > 0 ? ethExposureUsd / totalValue : 0,
      ethExposureAfter: totalValueAfterUsd > 0 ? ethExposureAfterUsd / totalValueAfterUsd : 0,
      stablecoinRatioBefore: totalValue > 0 ? stableExposureUsd / totalValue : 0,
      stablecoinRatioAfter: stableRatioAfter,
    },
    status: "PLANNED",
    requiresApproval: true,
    warnings: [...warnings, ...balanceWarnings],
  };

  tracePipeline("planner-output", {
    basedOnReportHash: plan.basedOnReportHash,
    steps: plan.steps.map((step) => ({
      action: step.action,
      fromAsset: step.fromAsset,
      toAsset: step.toAsset,
      amountUsd: step.amountUsd,
      amountToken: step.amountToken,
      quoteAmountOutUsd: step.quote?.amountOutUsd,
      reason: step.reason,
    })),
    warnings: plan.warnings,
  });

  return plan;
}

async function sizeEthRebalanceWithQuotes({
  address,
  snapshot,
  ethExposureUsd,
  totalValue,
  order,
  reason,
}: {
  address: string;
  snapshot: TreasurySnapshot;
  ethExposureUsd: number;
  totalValue: number;
  order: number;
  reason: string;
}): Promise<PlanStep | null> {
  const nativeBalance = await getNativeBalance(address as Address);
  if (!nativeBalance) return null;

  const nativeBalanceWei = parseEther(nativeBalance.amount);
  const maximumInputWei = nativeBalanceWei * BigInt(MAX_ETH_SWAP_BPS) / BigInt(10_000);
  if (maximumInputWei <= ZERO_WEI) return null;

  const makeCandidate = (amountInWei: bigint): PlanStep => ({
    order,
    protocol: "uniswap-v3",
    action: "swap",
    fromAsset: "ETH",
    toAsset: "USDC",
    amountUsd: ethExposureUsd * Number(amountInWei) / Number(nativeBalanceWei),
    amountToken: `${formatEther(amountInWei)} ETH`,
    reason,
    traceId: "eth-concentration-wallet-swap",
  });
  const adapter = getExecutionAdapterForStep(makeCandidate(maximumInputWei));
  if (!adapter || (await adapter.discover(snapshot)).length === 0) return null;

  const reachesTarget = async (amountInWei: bigint) => {
    const candidate = makeCandidate(amountInWei);
    const quote = await adapter.quote(candidate);
    const remainingEthUsd = ethExposureUsd * Number(nativeBalanceWei - amountInWei) / Number(nativeBalanceWei);
    const quotedTotalUsd = totalValue - (ethExposureUsd - remainingEthUsd) + quote.amountOutUsd;
    return {
      candidate,
      quote,
      ethRatioAfter: quotedTotalUsd > 0 ? remainingEthUsd / quotedTotalUsd : 0,
    };
  };

  let upperResult;
  try {
    upperResult = await reachesTarget(maximumInputWei);
  } catch (error) {
    tracePipeline("planner-quote-sizing-failed", { address, reason: error instanceof Error ? error.message : "QUOTE_FAILED" });
    return null;
  }
  if (upperResult.ethRatioAfter > TARGET_ETH_RATIO) return null;

  let lowerWei = ONE_WEI;
  let upperWei = maximumInputWei;
  let best = upperResult;
  for (let iteration = 0; iteration < QUOTE_SEARCH_ITERATIONS && lowerWei <= upperWei; iteration += 1) {
    const middleWei = (lowerWei + upperWei) / TWO_WEI;
    const result = await reachesTarget(middleWei);
    if (result.ethRatioAfter <= TARGET_ETH_RATIO) {
      best = result;
      upperWei = middleWei - ONE_WEI;
    } else {
      lowerWei = middleWei + ONE_WEI;
    }
  }

  best.candidate.quote = best.quote;
  tracePipeline("planner-quote-sizing", {
    address,
    targetEthRatio: TARGET_ETH_RATIO,
    inputEth: best.candidate.amountToken,
    inputUsd: best.candidate.amountUsd,
    quotedOutputUsd: best.quote.amountOutUsd,
    predictedEthRatio: best.ethRatioAfter,
    quoteAdapter: adapter.id,
  });
  return best.candidate;
}

function deduplicateSteps(steps: PlanStep[]): PlanStep[] {
  const swapStepMap = new Map<string, PlanStep>();
  const protectedSteps: PlanStep[] = [];

  for (const step of steps) {
    if (step.action === "swap") {
      const key = `${step.protocol}:${step.action}:${step.fromAsset}:${step.toAsset}`;

      if (swapStepMap.has(key)) {
        const existing = swapStepMap.get(key)!;
        const mergedReason = existing.reason && step.reason && existing.reason !== step.reason
          ? `${existing.reason} | ${step.reason}`
          : existing.reason || step.reason;
        const mergedTraceId = existing.traceId && step.traceId && existing.traceId !== step.traceId
          ? `${existing.traceId},${step.traceId}`
          : existing.traceId || step.traceId;

        const maxUsd = Math.max(existing.amountUsd || 0, step.amountUsd || 0);
        const keepExisting = (existing.amountUsd || 0) >= (step.amountUsd || 0);

        swapStepMap.set(key, {
          ...existing,
          amountUsd: maxUsd,
          amountToken: keepExisting ? existing.amountToken : step.amountToken,
          reason: mergedReason,
          traceId: mergedTraceId,
        });
      } else {
        swapStepMap.set(key, { ...step });
      }
    } else {
      protectedSteps.push({ ...step });
    }
  }

  const dedupedSwaps = Array.from(swapStepMap.values());
  let order = 0;
  const allSteps = [...protectedSteps, ...dedupedSwaps];
  for (const step of allSteps) {
    order += 1;
    step.order = order;
  }

  return allSteps;
}

function validatePlanBalances(
  snapshot: TreasurySnapshot,
  steps: PlanStep[]
): { valid: boolean; reason?: string } {
  const walletPositions = snapshot.positions.filter((p) => p.protocol === "Wallet");

  const balances = new Map<string, number>();
  for (const position of walletPositions) {
    balances.set(position.asset, position.amountUsd);
  }

  for (const step of steps) {
    if (step.action === "swap" && step.fromAsset && step.toAsset) {
      const required = step.amountUsd || 0;
      const available = balances.get(step.fromAsset) || 0;
      if (required > available) {
        return {
          valid: false,
          reason: `Step ${step.order} requires ${required.toFixed(2)} ${step.fromAsset}, but wallet only has ${available.toFixed(2)} ${step.fromAsset} available at that point in the plan.`,
        };
      }
      balances.set(step.fromAsset, available - required);
      const toAssetBalance = balances.get(step.toAsset) || 0;
      balances.set(step.toAsset, toAssetBalance + required);
    } else if (step.action === "repay" && step.asset) {
      const required = step.amountUsd || 0;
      const available = balances.get(step.asset) || 0;
      if (required > available) {
        return {
          valid: false,
          reason: `Step ${step.order} requires ${required.toFixed(2)} ${step.asset}, but wallet only has ${available.toFixed(2)} ${step.asset} available at that point in the plan.`,
        };
      }
      balances.set(step.asset, available - required);
    } else if (step.action === "collect-fees") {
      const collected = step.amountUsd || 0;
      const currentUsdc = balances.get("USDC") || 0;
      balances.set("USDC", currentUsdc + collected);
    }
  }

  return { valid: true };
}

function calculatePostPlanExposure(
  currentExposure: number,
  steps: PlanStep[],
  fromField: "fromAsset" | "asset",
  assetName: string
): number {
  let exposure = currentExposure;
  for (const step of steps) {
    if (step.action === "swap") {
      if (step.fromAsset === assetName) {
        exposure -= step.amountUsd || 0;
      } else if (step.toAsset === assetName) {
        exposure += step.amountUsd || 0;
      }
    }
  }
  return Math.max(0, exposure);
}

function calculatePostPlanStableRatio(
  currentStable: number,
  totalValue: number,
  steps: PlanStep[],
  toField: "toAsset" | "asset",
  assetName: string
): number {
  let stable = currentStable;
  for (const step of steps) {
    if (step.action === "repay" && step.asset === assetName) {
      stable -= step.amountUsd || 0;
    } else if (step[toField] === assetName && step.amountUsd) {
      stable += step.quote?.amountOutUsd ?? step.amountUsd;
    }
  }
  return totalValue > 0 ? Math.max(0, stable) / totalValue : 0;
}

function calculatePostPlanValue(currentValue: number, steps: PlanStep[]): number {
  return steps.reduce((value, step) => {
    if (step.action !== "swap") return value;
    return value - (step.amountUsd ?? 0) + (step.quote?.amountOutUsd ?? step.amountUsd ?? 0);
  }, currentValue);
}
