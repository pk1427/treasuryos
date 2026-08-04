import type { Address } from "viem";
import type { TreasurySnapshot } from "@treasuryos/shared";
import type { PlanStep } from "@/lib/ai/plan-types";

export type PreparedTransaction = {
  to: Address;
  data: `0x${string}`;
  value: `0x${string}`;
  chainId: `0x${string}`;
};

export type ExecutionQuote = {
  adapterId: string;
  amountIn: string;
  amountOut: string;
  amountOutUsd: number;
  amountOutMinimum: string;
  slippageBps: number;
  route: string;
};

export type ExecutableAction = {
  adapterId: string;
  action: "swap";
  fromAsset: "ETH";
  toAsset: "USDC";
  availableUsd: number;
  label: string;
};

export type ExecutionAdapter = {
  id: string;
  discover(snapshot: TreasurySnapshot): Promise<ExecutableAction[]>;
  quote(step: PlanStep): Promise<ExecutionQuote>;
  buildTransaction(step: PlanStep, walletAddress: Address): PreparedTransaction;
  simulate(step: PlanStep, walletAddress: Address): Promise<{ success: boolean; estimatedGas?: string; note?: string; error?: string }>;
};
