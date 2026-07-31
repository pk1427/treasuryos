import type { PlanStep } from "@/lib/ai/plan-types";
import { getExecutionAdapterForStep } from "./registry";
import type { PreparedTransaction } from "./types";

export type PreparedSwapTransaction = PreparedTransaction;

export function buildEthToUsdcSwapTransaction(
  step: PlanStep,
  walletAddress: string
): PreparedSwapTransaction {
  const adapter = getExecutionAdapterForStep(step);
  if (!adapter) throw new Error("No execution adapter is registered for this plan step.");
  return adapter.buildTransaction(step, walletAddress as `0x${string}`);
}
