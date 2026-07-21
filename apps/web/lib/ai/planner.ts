import { createHash } from "node:crypto";
import { scanTreasury } from "@treasuryos/indexer";
import { buildRiskReportV2 } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import { getTokenPrice } from "@treasuryos/indexer";
import type { ExecutionPlan, PlanStep } from "./plan-types";
import type { AaveAccountSummary, TreasurySnapshot } from "@treasuryos/shared";

const STABLE_COINS = new Set(["USDC", "USDT", "DAI"]);
const ETH_ASSETS = new Set(["ETH", "WETH"]);

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

  const steps: PlanStep[] = [];
  const warnings: string[] = [];
  let order = 0;

  const walletPositions = snapshot.positions.filter((p) => p.protocol === "Wallet");
  const aavePositions = snapshot.positions.filter((p) => p.protocol === "Aave");
  const uniswapPositions = snapshot.positions.filter((p) => p.protocol === "Uniswap");

  const accountSummary = aavePositions[0]?.metadata?.accountSummary as
    | AaveAccountSummary
    | undefined;

  const ethExposureUsd =
    walletPositions
      .filter((p) => ETH_ASSETS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0) +
    aavePositions
      .filter((p) => ETH_ASSETS.has(p.asset) && p.metadata?.positionType === "supplied")
      .reduce((sum, p) => sum + p.amountUsd, 0);

  const stableExposureUsd =
    walletPositions
      .filter((p) => STABLE_COINS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0) +
    aavePositions
      .filter((p) => STABLE_COINS.has(p.asset) && p.metadata?.positionType === "supplied")
      .reduce((sum, p) => sum + p.amountUsd, 0);

  const totalValue = snapshot.totalValueUsd;

  for (const rec of riskV2.recommendations) {
    const action = rec.action.toLowerCase();

    if (
      action.includes("repay") &&
      accountSummary &&
      accountSummary.healthFactor !== null &&
      accountSummary.healthFactor < 1.5
    ) {
      const positionDebtUsd = Math.abs(
        aavePositions
          .filter((p) => p.metadata?.positionType === "borrowed")
          .reduce((sum, p) => sum + p.amountUsd, 0)
      );

      const totalDebtUsd = accountSummary.totalDebtUsd > 0
        ? accountSummary.totalDebtUsd
        : positionDebtUsd;

      if (totalDebtUsd > 0) {
        const targetRepay = Math.min(totalDebtUsd, stableExposureUsd);
        const repayAsset =
          walletPositions
            .filter((p) => STABLE_COINS.has(p.asset))
            .sort((a, b) => b.amountUsd - a.amountUsd)[0]?.asset ?? "USDC";

        if (targetRepay > 0) {
          order += 1;
          steps.push({
            order,
            protocol: "aave",
            action: "repay",
            asset: repayAsset,
            amountUsd: targetRepay,
            amountToken: `${targetRepay.toFixed(2)} ${repayAsset}`,
            reason: rec.reason,
            traceId: rec.reason.slice(0, 40),
          });
        }
      }
    }

    if (action.includes("reduce eth exposure") && ethExposureUsd > 0) {
      const ethRatio = ethExposureUsd / totalValue;
      const targetEthRatio = 0.7;
      const excessEthUsd = totalValue * (ethRatio - targetEthRatio);
      const swapUsd = Math.min(excessEthUsd, ethExposureUsd * 0.3);
      const availableStableUsd = stableExposureUsd;

      if (swapUsd > 100 && availableStableUsd < totalValue * 0.2) {
        const priceResult = await getTokenPrice("ETH");
        const ethPrice = priceResult.price;
        const nativeAmount = ethPrice > 0 ? swapUsd / ethPrice : 0;

        order += 1;
        steps.push({
          order,
          protocol: "wallet",
          action: "swap",
          fromAsset: "ETH",
          toAsset: "USDC",
          amountUsd: swapUsd,
          amountToken: `${nativeAmount.toFixed(6)} ETH`,
          reason: rec.reason,
          traceId: rec.reason.slice(0, 40),
        });
      }
    }

    if (action.includes("stablecoin") && stableExposureUsd < totalValue * 0.2 && totalValue > 5000) {
      const targetStableUsd = totalValue * 0.2;
      const neededStableUsd = targetStableUsd - stableExposureUsd;
      const availableEthUsd = ethExposureUsd;

      if (neededStableUsd > 100 && availableEthUsd > neededStableUsd) {
        const priceResult = await getTokenPrice("ETH");
        const ethPrice = priceResult.price;
        const nativeAmount = ethPrice > 0 ? neededStableUsd / ethPrice : 0;

        order += 1;
        steps.push({
          order,
          protocol: "wallet",
          action: "swap",
          fromAsset: "ETH",
          toAsset: "USDC",
          amountUsd: neededStableUsd,
          amountToken: `${nativeAmount.toFixed(6)} ETH`,
          reason: rec.reason,
          traceId: rec.reason.slice(0, 40),
        });
      }
    }

    if (action.includes("treasury runway") || action.includes("increase treasury reserves")) {
      warnings.push(
        "Runway improvement requires capital injection or burn reduction — not addressable by onchain swaps alone."
      );
    }
  }

  const dedupedSteps = deduplicateSteps(steps);

  const uniswapFeesUsd = uniswapPositions.reduce(
    (sum, p) => sum + ((p.metadata as { unclaimedFees?: { totalUsd?: number } })?.unclaimedFees?.totalUsd ?? 0),
    0
  );

  if (uniswapFeesUsd > 10) {
    order += 1;
    dedupedSteps.push({
      order,
      protocol: "uniswap",
      action: "collect-fees",
      amountUsd: uniswapFeesUsd,
      reason: "Collect unclaimed Uniswap fees to realize yield.",
      traceId: "uniswap-unclaimed-fees",
    });
  }

  const balanceValidation = validatePlanBalances(snapshot, dedupedSteps);
  const finalSteps = balanceValidation.valid ? dedupedSteps : [];
  const balanceWarnings = balanceValidation.valid
    ? []
    : [
        `Plan rejected: total swap amounts exceed available balances. ${balanceValidation.reason}`,
      ];

  const ethExposureAfterUsd = calculatePostPlanExposure(ethExposureUsd, finalSteps, "fromAsset", "ETH");
  const stableRatioAfter = calculatePostPlanStableRatio(stableExposureUsd, totalValue, finalSteps, "toAsset", "USDC");
  const projectedHF = computeProjectedHealthFactor(accountSummary, finalSteps);

  const plan: ExecutionPlan = {
    planId: `plan_${Date.now()}_${address.slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    basedOnReportHash: reportHash ?? computeSnapshotHash(snapshot),
    steps: finalSteps,
    expectedOutcome: {
      healthFactorBefore: accountSummary?.healthFactor ?? null,
      healthFactorAfter: projectedHF,
      ethExposureBefore: totalValue > 0 ? ethExposureUsd / totalValue : 0,
      ethExposureAfter: totalValue > 0 ? ethExposureAfterUsd / totalValue : 0,
      stablecoinRatioBefore: totalValue > 0 ? stableExposureUsd / totalValue : 0,
      stablecoinRatioAfter: stableRatioAfter,
    },
    status: "PLANNED",
    requiresApproval: true,
    warnings: [...warnings, ...balanceWarnings],
  };

  return plan;
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

function computeProjectedHealthFactor(
  accountSummary: AaveAccountSummary | undefined,
  steps: PlanStep[]
): number | null {
  if (!accountSummary || accountSummary.healthFactor === null) {
    return null;
  }

  const hasAaveAction = steps.some(
    (step) =>
      step.protocol === "aave" &&
      ["repay", "borrow", "supply", "withdraw"].includes(step.action)
  );

  if (!hasAaveAction) {
    return accountSummary.healthFactor;
  }

  const repayStep = steps.find(
    (step) => step.protocol === "aave" && step.action === "repay"
  );

  if (repayStep && accountSummary.totalDebtUsd > 0) {
    const repayAmount = repayStep.amountUsd ?? 0;
    const remainingDebt = Math.max(0, accountSummary.totalDebtUsd - repayAmount);

    if (remainingDebt <= 0.01) {
      return null;
    }

    const newDebt = Math.max(0.01, remainingDebt);
    return Math.min(
      accountSummary.healthFactor * (accountSummary.totalDebtUsd / newDebt),
      2.0
    );
  }

  return Math.min(accountSummary.healthFactor + 0.5, 2.0);
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
      stable += step.amountUsd;
    }
  }
  return totalValue > 0 ? Math.max(0, stable) / totalValue : 0;
}
