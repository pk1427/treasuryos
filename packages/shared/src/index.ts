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
  metadata?: Record<string, unknown>;
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

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskFactor = {
  id: string;
  category: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  metric?: string;
  recommendation?: string;
};

export type WalletRisk = {
  factors: RiskFactor[];
};

export type AaveRisk = {
  factors: RiskFactor[];
};

export type UniswapRisk = {
  factors: RiskFactor[];
};

export type TreasuryRisk = {
  factors: RiskFactor[];
};

export type Recommendation = {
  priority: RiskSeverity;
  action: string;
  reason: string;
};

export type CompositeRisk = {
  rating: RiskRating;
  score: number;
  factors: Array<RiskFactor | StressRiskFactor>;
};

export type RiskReportV2 = {
  address: string;
  snapshot: TreasurySnapshot;
  walletRisk: WalletRisk;
  aaveRisk: AaveRisk;
  uniswapRisk: UniswapRisk;
  treasuryRisk: TreasuryRisk;
  stressRisk: StressRisk;
  compositeRisk: CompositeRisk;
  recommendations: Recommendation[];
  generatedAt: string;
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

export type LiquidationProjection = {
  currentHealthFactor: number;
  projectedHealthFactor: number;
  status: "healthy" | "at-risk" | "liquidatable";
};

export type StressRiskFactor = {
  id: string;
  category: string;
  scenario: StressScenario;
  severity: RiskSeverity;
  title: string;
  description: string;
  recommendation?: string;
  lossPercent: number;
  projectedValueUsd: number;
  currentValueUsd: number;
  liquidationProjection?: LiquidationProjection;
};

export type StressRisk = {
  factors: StressRiskFactor[];
};

export type RiskReport = {
  address: string;
  snapshot: TreasurySnapshot;
  score: RiskScore;
  stressResults: StressResult[];
  generatedAt: string;
  riskV2?: RiskReportV2;
};

export type AaveAccountSummary = {
  healthFactor: number | null;
  currentLtvPercent: number;
  liquidationThresholdPercent: number;
  availableBorrowUsd: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  collateralStatus: "No Debt" | "Healthy" | "At Risk" | "Liquidatable";
  rewardsUsd: number;
  rewardsSource: "live" | "not-supported";
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

export type UniswapPositionMetadata = {
  positionType: string;
  tokenId: string;
  pool: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  fee: number;
  feeTierPercent: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  sqrtPriceX96: string;
  liquidity: string;
  inRange: boolean;
  unclaimedFees: {
    [key: string]: number;
    totalUsd: number;
  };
  positionEfficiency: number | null;
  impermanentLoss: { value: number | null; reason?: string };
  feeApr: { value: number | null; reason?: string };
};
