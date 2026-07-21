import { scanTreasury } from "@treasuryos/indexer";
import { buildRiskReportV2 } from "@treasuryos/risk-engine";
import { runStressScenarios } from "@treasuryos/simulator";
import type { ExecutionPlan, PlanStep } from "./plan-types";
import type { AaveAccountSummary } from "@treasuryos/shared";

const STABLE_COINS = new Set(["USDC", "USDT", "DAI"]);
const ETH_ASSETS = new Set(["ETH", "WETH"]);

export async function generateExecutionPlan(address: string): Promise<ExecutionPlan> {
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

  const ethExposure =
    walletPositions
      .filter((p) => ETH_ASSETS.has(p.asset))
      .reduce((sum, p) => sum + p.amountUsd, 0) +
    aavePositions
      .filter((p) => ETH_ASSETS.has(p.asset) && p.metadata?.positionType === "supplied")
      .reduce((sum, p) => sum + p.amountUsd, 0);

  const stableExposure =
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
      const totalDebtUsd = Math.abs(
        aavePositions
          .filter((p) => p.metadata?.positionType === "borrowed")
          .reduce((sum, p) => sum + p.amountUsd, 0)
      );

      if (totalDebtUsd > 0) {
        const targetRepay = Math.min(totalDebtUsd, stableExposure);
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

    if (action.includes("reduce eth exposure") && ethExposure > 0) {
      const ethRatio = ethExposure / totalValue;
      const targetEthRatio = 0.7;
      const excessEthUsd = totalValue * (ethRatio - targetEthRatio);
      const swapAmount = Math.min(excessEthUsd, ethExposure * 0.3);
      const availableStable = stableExposure;

      if (swapAmount > 100 && availableStable < totalValue * 0.2) {
        order += 1;
        steps.push({
          order,
          protocol: "wallet",
          action: "swap",
          fromAsset: "ETH",
          toAsset: "USDC",
          amountUsd: swapAmount,
          amountToken: `${swapAmount.toFixed(4)} ETH`,
          reason: rec.reason,
          traceId: rec.reason.slice(0, 40),
        });
      }
    }

    if (action.includes("stablecoin") && stableExposure < totalValue * 0.2 && totalValue > 5000) {
      const targetStableUsd = totalValue * 0.2;
      const neededStableUsd = targetStableUsd - stableExposure;
      const availableEth = ethExposure;

      if (neededStableUsd > 100 && availableEth > neededStableUsd) {
        order += 1;
        steps.push({
          order,
          protocol: "wallet",
          action: "swap",
          fromAsset: "ETH",
          toAsset: "USDC",
          amountUsd: neededStableUsd,
          amountToken: `${(neededStableUsd / 2000).toFixed(4)} ETH`,
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

  const uniswapFeesUsd = uniswapPositions.reduce(
    (sum, p) => sum + ((p.metadata as { unclaimedFees?: { totalUsd?: number } })?.unclaimedFees?.totalUsd ?? 0),
    0
  );

  if (uniswapFeesUsd > 10) {
    order += 1;
    steps.push({
      order,
      protocol: "uniswap",
      action: "collect-fees",
      amountUsd: uniswapFeesUsd,
      reason: "Collect unclaimed Uniswap fees to realize yield.",
      traceId: "uniswap-unclaimed-fees",
    });
  }

  const ethExposureAfter = calculatePostPlanExposure(ethExposure, steps, "fromAsset", "ETH");
  const stableRatioAfter = calculatePostPlanStableRatio(stableExposure, totalValue, steps, "toAsset", "USDC");
  const projectedHF = accountSummary && accountSummary.healthFactor !== null
    ? Math.min(accountSummary.healthFactor + 0.5, 2.0)
    : null;

  const plan: ExecutionPlan = {
    planId: `plan_${Date.now()}_${address.slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    basedOnReportHash: riskV2.compositeRisk.rating,
    steps,
    expectedOutcome: {
      healthFactorBefore: accountSummary?.healthFactor ?? null,
      healthFactorAfter: projectedHF,
      ethExposureBefore: totalValue > 0 ? ethExposure / totalValue : 0,
      ethExposureAfter: totalValue > 0 ? ethExposureAfter / totalValue : 0,
      stablecoinRatioBefore: totalValue > 0 ? stableExposure / totalValue : 0,
      stablecoinRatioAfter: stableRatioAfter,
    },
    status: "PLANNED",
    requiresApproval: true,
    warnings,
  };

  return plan;
}

function calculatePostPlanExposure(
  currentExposure: number,
  steps: PlanStep[],
  fromField: "fromAsset" | "asset",
  assetName: string
): number {
  let exposure = currentExposure;
  for (const step of steps) {
    if (step[fromField] === assetName && step.amountUsd) {
      exposure -= step.amountUsd;
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
    if (step[toField] === assetName && step.amountUsd) {
      stable += step.amountUsd;
    }
  }
  return totalValue > 0 ? stable / totalValue : 0;
}
