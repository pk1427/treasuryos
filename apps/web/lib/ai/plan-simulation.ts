import type { ExecutionPlan } from "@/lib/ai/plan-types";
import { getExecutionAdapterForStep } from "@/lib/execution/registry";
import type { TreasurySnapshot } from "@treasuryos/shared";

export type StepSimulationResult = {
  order: number;
  protocol: string;
  action: string;
  success: boolean;
  estimatedGas?: string;
  note?: string;
  error?: string;
};

export type PlanSimulationResult = {
  steps: StepSimulationResult[];
  overallSuccess: boolean;
  projectedFinalState?: Record<string, unknown>;
  warnings: string[];
  snapshotWarning?: string;
  simulationMode: "viem-user-context";
};

export async function simulatePlanSteps(
  plan: ExecutionPlan,
  _snapshot: TreasurySnapshot,
  connectedWallet?: string
): Promise<PlanSimulationResult> {
  const steps: StepSimulationResult[] = [];
  const warnings: string[] = [];

  for (const step of plan.steps) {
    const adapter = getExecutionAdapterForStep(step);
    if (!adapter) {
      steps.push({ order: step.order, protocol: step.protocol, action: step.action, success: false, error: "UNSUPPORTED_STEP_TYPE", note: "Simulation is not available for this step type." });
      continue;
    }
    if (!connectedWallet) {
      steps.push({ order: step.order, protocol: step.protocol, action: step.action, success: false, error: "MISSING_CONNECTED_WALLET", note: "Connect the treasury owner wallet to simulate this action." });
      continue;
    }

    const result = await adapter.simulate(step, connectedWallet as `0x${string}`);
    steps.push({ order: step.order, protocol: step.protocol, action: step.action, ...result });
    if (!result.success) warnings.push(`Step ${step.order}: Wallet simulation failed — ${result.error ?? "unknown error"}.`);
  }

  const overallSuccess = steps.every((step) => step.success);
  return {
    steps,
    overallSuccess,
    projectedFinalState: buildProjectedFinalState(plan, steps),
    warnings,
    simulationMode: "viem-user-context",
  };
}

function buildProjectedFinalState(plan: ExecutionPlan, steps: StepSimulationResult[]): Record<string, unknown> {
  const successful = steps.every((step) => step.success);
  const ethExposure = successful ? plan.expectedOutcome.ethExposureAfter : plan.expectedOutcome.ethExposureBefore;
  const stablecoinRatio = successful ? plan.expectedOutcome.stablecoinRatioAfter : plan.expectedOutcome.stablecoinRatioBefore;

  return {
    ethExposure: `${((ethExposure ?? 0) * 100).toFixed(1)}%`,
    stablecoinRatio: `${((stablecoinRatio ?? 0) * 100).toFixed(1)}%`,
    allStepsSuccessful: successful,
    failedSteps: steps.filter((step) => !step.success).map(({ order, action, error }) => ({ order, action, error })),
  };
}
