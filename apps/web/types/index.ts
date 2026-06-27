export type RiskLevel = "low" | "medium" | "high" | "critical";

export type DecisionStatus = "pending" | "approved" | "rejected" | "executed";

export type ExecutionStatus =
  | "simulating"
  | "pending"
  | "confirmed"
  | "failed";

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  amount: string;
  decimals: number;
  usdValue: number;
  lastMovedAt?: Date;
}

export interface TreasurySnapshot {
  walletAddress: string;
  chainId: number;
  totalValueUsd: number;
  assets: TokenBalance[];
  monthlyBurnUsd: number;
}

export interface AnalyticsResult {
  totalValue: number;
  burnRate: number;
  runwayMonths: number | null;
  concentrationScore: number;
  concentrationAsset: string;
  idleCapitalUsd: number;
  idleCapitalDays: number;
  riskScore: RiskLevel;
  risks: RiskItem[];
}

export interface RiskItem {
  type: string;
  severity: RiskLevel;
  title: string;
  description: string;
}

export interface Recommendation {
  type: string;
  severity: RiskLevel;
  explanation: string;
  recommendation: string;
  actionPlan: ActionPlan;
}

export interface ActionPlan {
  action: "transfer";
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  amountUsd: number;
  from: string;
  to: string;
  chainId: number;
}

export interface SimulationResult {
  success: boolean;
  gasEstimate: bigint;
  gasCostUsd: number;
  message: string;
}

export interface ExecutionResult {
  txHash: string;
  status: ExecutionStatus;
  gasUsed?: bigint;
}

export interface AuditEntry {
  risk: string;
  reason: string;
  action: string;
  txHash?: string;
  status: ExecutionStatus;
  timestamp: Date;
}

export interface DashboardDecision extends Recommendation {
  id: string;
  status?: string;
}

export interface DashboardExecution {
  id?: string;
  decisionId?: string;
  txHash?: string | null;
  status?: string;
  gasUsed?: string | null;
  timestamp?: Date | string;
  decision?: {
    type?: string;
    explanation?: string;
    recommendation?: string;
  };
  execution?: DashboardExecution;
}

export interface DashboardData {
  treasuryId: string;
  protocolName: string;
  walletAddress: string;
  reserveWalletAddress?: string | null;
  analytics: AnalyticsResult | null;
  assets: TokenBalance[];
  recommendations: DashboardDecision[];
  decisions: DashboardDecision[];
  executions: DashboardExecution[];
}
