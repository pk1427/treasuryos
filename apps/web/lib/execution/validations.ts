import { generateRiskReport } from "@/lib/v1-report";
import type { PlanStep } from "@/lib/ai/plan-types";

type ExecutionPlanRecord = {
  id: string;
  walletAddress: string;
  reportHash: string;
  planJson: string;
  status: string;
  simulationResult: unknown;
};

export type ValidatedExecutionPlan = {
  planId: string;
  walletAddress: string;
  reportHash: string;
  step: PlanStep;
  simulationResult: Record<string, unknown>;
};

export async function validateExecutionPreconditions(
  plan: ExecutionPlanRecord,
  connectedWallet: string
): Promise<ValidatedExecutionPlan> {
  if (plan.walletAddress.toLowerCase() !== connectedWallet.toLowerCase()) {
    throw new Error("Wallet ownership mismatch.");
  }

  if (plan.status !== "SIGNED") {
    throw new Error("Execution preconditions failed.");
  }

  const simulation = parseSimulation(plan.simulationResult);
  if (!simulation?.overallSuccess) {
    throw new Error("Cannot execute. Simulation has not passed.");
  }

  const { reportHash } = await generateRiskReport(plan.walletAddress);
  if (reportHash.toLowerCase() !== plan.reportHash.toLowerCase()) {
    throw new Error("Cannot execute. Plan became stale.");
  }

  const parsedPlan = JSON.parse(plan.planJson) as {
    steps?: PlanStep[];
  };
  const steps = parsedPlan.steps ?? [];

  if (steps.length !== 1) {
    throw new Error(`Cannot execute. Plan contains ${steps.length} executable steps.`);
  }

  const step = steps[0];
  if (
    step.protocol !== "uniswap-v3" ||
    step.action !== "swap" ||
    step.fromAsset !== "ETH" ||
    step.toAsset !== "USDC"
  ) {
    throw new Error("Cannot execute. Only ETH to USDC wallet swaps are supported.");
  }

  return {
    planId: plan.id,
    walletAddress: plan.walletAddress,
    reportHash: plan.reportHash,
    step,
    simulationResult: simulation,
  };
}

function parseSimulation(value: unknown): (Record<string, unknown> & { overallSuccess?: boolean }) | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown> & { overallSuccess?: boolean };
    } catch {
      return null;
    }
  }
  return value as Record<string, unknown> & { overallSuccess?: boolean };
}
