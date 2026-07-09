export type TreasuryPosition = {
  protocol: string;
  asset: string;
  amountUsd: number;
  type?: "wallet" | "lending" | "borrowing" | "lp" | "staking" | "vault";
  tokens?: {
    address: string;
    symbol: string;
    amount: number;
    amountUsd: number;
  }[];
  metadata?: Record<string, string | number | boolean>;
};

export type TreasurySnapshot = {
  address: string;
  positions: TreasuryPosition[];
  totalValueUsd: number;
  fetchedAt: string;
};

export type RiskRating = "A" | "B" | "C" | "D" | "F" | "N/A";

export type RiskScore = {
  concentration: number;
  counterparty: number;
  liquidity: number;
  composite: number;
  rating: RiskRating;
};

export type StressScenario =
  | "ETH_-50"
  | "STABLE_DEPEG_-10"
  | "PROTOCOL_FAILURE";

export type StressResult = {
  scenario: StressScenario;
  currentValueUsd: number;
  stressedValueUsd: number;
  runwayMonthsBefore: number;
  runwayMonthsAfter: number;
};

export type RiskReport = {
  address: string;
  snapshot: TreasurySnapshot;
  score: RiskScore;
  stressResults: StressResult[];
  generatedAt: string;
};

export type AttestationSimulation = {
  ok: boolean;
  status: string;
  executionId?: string;
  message?: string;
  gasEstimate?: string;
};

export type AttestationResult = {
  executionId: string;
  status: string;
  transactionHash?: string;
  transactionLink?: string;
};
