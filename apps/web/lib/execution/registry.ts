import type { PlanStep } from "@/lib/ai/plan-types";
import { uniswapV3ExecutionAdapter } from "./adapters/uniswap-v3";
import type { ExecutionAdapter } from "./types";

const adapters: ExecutionAdapter[] = [uniswapV3ExecutionAdapter];

export function getExecutionAdapter(id: string) {
  return adapters.find((adapter) => adapter.id === id) ?? null;
}

export function getExecutionAdapterForStep(step: PlanStep) {
  return step.protocol === "uniswap-v3" && step.action === "swap" ? uniswapV3ExecutionAdapter : null;
}

export const EXECUTION_ADAPTERS = adapters;
