export type PlanStepAction =
  | "swap"
  | "repay"
  | "supply"
  | "withdraw"
  | "collect-fees"
  | "rebalance";

export type PlanStepProtocol = "wallet" | "uniswap" | "aave";

export type PlanStep = {
  order: number;
  protocol: PlanStepProtocol;
  action: PlanStepAction;
  reason: string;
  traceId: string;
  asset?: string;
  fromAsset?: string;
  toAsset?: string;
  amountUsd?: number;
  amountToken?: string;
  tokenId?: string;
};

export type ExpectedOutcome = {
  healthFactorBefore?: number | null;
  healthFactorAfter?: number | null;
  ethExposureBefore?: number;
  ethExposureAfter?: number;
  stablecoinRatioBefore?: number;
  stablecoinRatioAfter?: number;
  runwayBefore?: number;
  runwayAfter?: number;
};

export type ExecutionPlan = {
  planId: string;
  generatedAt: string;
  basedOnReportHash: string;
  steps: PlanStep[];
  expectedOutcome: ExpectedOutcome;
  status: "PLANNED";
  requiresApproval: true;
  warnings: string[];
};
