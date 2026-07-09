import {
  getBalances,
  getDemoTreasuryConfig,
  getTransactions,
} from "@/lib/blockchain";
import { analyzeTreasuryMetrics } from "@/lib/analytics";
import {
  generateRecommendations,
  generateAiExplanation,
} from "@/lib/ai/cfo-agent";
import { simulate, execute } from "@/lib/keeperhub";
import { db } from "@/lib/db";
import {
  treasuryRepo,
  analysisRepo,
  decisionRepo,
  executionRepo,
} from "@/server/repositories";
import type {
  AnalyticsResult,
  DashboardData,
  DashboardDecision,
  Recommendation,
  TokenBalance,
} from "@/types";

// In-memory store when DB is unavailable.
const memoryStore = {
  treasuries: new Map<string, DemoTreasuryState>(),
};

interface DemoTreasuryState {
  walletAddress: string;
  protocolName: string;
  chainId: number;
  reserveWalletAddress: string;
  monthlyBurnUsd: number;
  assets: TokenBalance[];
  analytics: AnalyticsResult | null;
  recommendations: Recommendation[];
  decisions: DashboardDecision[];
  executions: Array<{
    id: string;
    decisionId: string;
    txHash?: string;
    status: string;
    gasUsed?: string;
    timestamp: Date;
  }>;
}

function getOrCreateDemoState(walletAddress: string): DemoTreasuryState {
  const key = walletAddress.toLowerCase();
  if (!memoryStore.treasuries.has(key)) {
    const config = getDemoTreasuryConfig();
    memoryStore.treasuries.set(key, {
      ...config,
      assets: [],
      analytics: null,
      recommendations: [],
      decisions: [],
      executions: [],
    });
  }
  return memoryStore.treasuries.get(key)!;
}

export class TreasuryService {
  async connectTreasury(walletAddress: string, protocolName?: string) {
    const config = getDemoTreasuryConfig();
    const isDemo =
      walletAddress.toLowerCase() === config.walletAddress.toLowerCase();

    const treasuryData = {
      protocolName: protocolName ?? (isDemo ? config.protocolName : "Protocol"),
      walletAddress: walletAddress.toLowerCase(),
      chainId: config.chainId,
      reserveWalletAddress: config.reserveWalletAddress,
      monthlyBurnUsd: config.monthlyBurnUsd,
    };

    if (db) {
      let treasury = await treasuryRepo.findByWallet(walletAddress);
      if (!treasury) {
        treasury = await treasuryRepo.create(treasuryData);
      }
      return treasury;
    }

    return getOrCreateDemoState(walletAddress);
  }

  async fetchAndAnalyze(walletAddress: string): Promise<DashboardData> {
    const config = getDemoTreasuryConfig();
    const balances = await getBalances(walletAddress);
    const transactions = await getTransactions();

    const isDemo =
      walletAddress.toLowerCase() === config.walletAddress.toLowerCase();
    const protocolName = isDemo ? config.protocolName : "Protocol";

    const monthlyBurn = isDemo ? config.monthlyBurnUsd : 120_000;

    const snapshot = {
      walletAddress,
      chainId: config.chainId,
      totalValueUsd: balances.reduce((s, b) => s + b.usdValue, 0),
      assets: balances,
      monthlyBurnUsd: monthlyBurn,
    };

    const analytics = analyzeTreasuryMetrics(snapshot, transactions);

    const recommendations = generateRecommendations(
      analytics,
      walletAddress,
      config.reserveWalletAddress,
      config.chainId
    );

    for (const rec of recommendations) {
      rec.explanation = await generateAiExplanation(analytics, rec);
    }

    if (db) {
      const treasury = await this.connectTreasury(walletAddress);

      if ("id" in treasury) {
        await treasuryRepo.upsertAssets(treasury.id, balances);
        await analysisRepo.create(treasury.id, {
          totalValue: analytics.totalValue,
          runwayMonths: analytics.runwayMonths,
          concentrationScore: analytics.concentrationScore,
          idleCapitalUsd: analytics.idleCapitalUsd,
          idleCapitalDays: analytics.idleCapitalDays,
          riskScore: analytics.riskScore,
        });

        for (const rec of recommendations) {
          await decisionRepo.create(treasury.id, {
            type: rec.type,
            severity: rec.severity,
            explanation: rec.explanation,
            recommendation: rec.recommendation,
            actionPlan: JSON.stringify(rec.actionPlan),
          });
        }
      }

      const dashboardDecisions: DashboardDecision[] = recommendations.map(
        (r, i) => ({ ...r, id: `dec-${i}`, status: "pending" })
      );

      return {
        treasuryId: "id" in treasury ? treasury.id : walletAddress,
        protocolName: "protocolName" in treasury ? treasury.protocolName : protocolName,
        walletAddress: walletAddress.toLowerCase(),
        reserveWalletAddress: config.reserveWalletAddress,
        analytics,
        assets: balances,
        recommendations: dashboardDecisions,
        decisions: dashboardDecisions,
        executions: [],
      };
    }

    const state = getOrCreateDemoState(walletAddress);
    state.assets = balances;
    state.analytics = analytics;
    state.recommendations = recommendations;
    state.protocolName = protocolName;
    const dashboardDecisions: DashboardDecision[] = recommendations.map(
      (r, i) => ({
        ...r,
        id: `dec-${i}`,
        status: "pending",
      })
    );
    state.decisions = dashboardDecisions;

    return {
      treasuryId: walletAddress,
      protocolName,
      walletAddress: walletAddress.toLowerCase(),
      reserveWalletAddress: config.reserveWalletAddress,
      analytics,
      assets: balances,
      recommendations: dashboardDecisions,
      decisions: dashboardDecisions,
      executions: state.executions,
    };
  }

  async getDashboardData(walletAddress: string): Promise<DashboardData> {
    const config = getDemoTreasuryConfig();
    const isDemo =
      walletAddress.toLowerCase() === config.walletAddress.toLowerCase();

    if (isDemo || !db) {
      const state = getOrCreateDemoState(
        isDemo ? config.walletAddress : walletAddress
      );
      if (!state.analytics) {
        return this.fetchAndAnalyze(
          isDemo ? config.walletAddress : walletAddress
        );
      }
      return {
        treasuryId: state.walletAddress,
        protocolName: state.protocolName,
        walletAddress: state.walletAddress,
        reserveWalletAddress: state.reserveWalletAddress,
        analytics: state.analytics,
        assets: state.assets,
        recommendations: state.decisions,
        decisions: state.decisions,
        executions: state.executions,
      };
    }

    const treasury = await treasuryRepo.findByWallet(walletAddress);
    if (!treasury) {
      return this.fetchAndAnalyze(walletAddress);
    }

    const assets = await treasuryRepo.getAssets(treasury.id);
    const analysis = await analysisRepo.getLatest(treasury.id);
    const decisions = await decisionRepo.getByTreasury(treasury.id);
    const auditTrail = await executionRepo.getAuditTrail(treasury.id);

    const dashboardDecisions: DashboardDecision[] = decisions.map((d) => ({
      id: d.id,
      type: d.type,
      severity: d.severity,
      explanation: d.explanation,
      recommendation: d.recommendation,
      actionPlan: d.actionPlan ? JSON.parse(d.actionPlan) : {
        action: "transfer" as const,
        tokenSymbol: "USDC",
        tokenAddress: "",
        amount: "0",
        amountUsd: 0,
        from: walletAddress,
        to: "",
        chainId: 8453,
      },
      status: d.status,
    }));

    return {
      treasuryId: treasury.id,
      protocolName: treasury.protocolName,
      walletAddress: treasury.walletAddress,
      reserveWalletAddress: treasury.reserveWalletAddress,
      assets: assets.map((a) => ({
        tokenAddress: a.tokenAddress,
        symbol: a.symbol,
        amount: a.amount,
        decimals: 18,
        usdValue: parseFloat(a.usdValue),
        lastMovedAt: a.lastMovedAt ?? undefined,
      })),
      analytics: analysis
        ? {
            totalValue: parseFloat(analysis.totalValue),
            burnRate: parseFloat(treasury.monthlyBurnUsd ?? "120000"),
            runwayMonths: analysis.runwayMonths
              ? parseFloat(analysis.runwayMonths)
              : null,
            concentrationScore: parseFloat(analysis.concentrationScore),
            concentrationAsset: "USDC",
            idleCapitalUsd: parseFloat(analysis.idleCapitalUsd ?? "0"),
            idleCapitalDays: analysis.idleCapitalDays ?? 0,
            riskScore: analysis.riskScore,
            risks: [],
          }
        : null,
      recommendations: dashboardDecisions,
      decisions: dashboardDecisions,
      executions: auditTrail.map(({ decision, execution }) => ({
        id: execution.id,
        decisionId: execution.decisionId,
        txHash: execution.txHash,
        status: execution.status,
        gasUsed: execution.gasUsed,
        timestamp: execution.timestamp,
        decision: {
          type: decision.type,
          explanation: decision.explanation,
          recommendation: decision.recommendation,
        },
      })),
    };
  }

  async executeDecision(decisionId: string, walletAddress: string) {
    if (!db) {
      const state = getOrCreateDemoState(walletAddress);
      const decision = state.decisions.find((d) => d.id === decisionId);
      if (!decision) throw new Error("Decision not found");

      const simulation = await simulate(decision.actionPlan);
      const result = await execute(decision.actionPlan);

      const execution = {
        id: `exec-${Date.now()}`,
        decisionId,
        txHash: result.txHash,
        status: result.status,
        gasUsed: result.gasUsed?.toString(),
        timestamp: new Date(),
        decision: {
          type: decision.type,
          explanation: decision.explanation,
          recommendation: decision.recommendation,
        },
      };

      state.executions.push(execution);
      decision.status = "executed";

      return { simulation, execution: result, decision };
    }

    const decision = await decisionRepo.getById(decisionId);
    if (!decision) throw new Error("Decision not found");

    const actionPlan = JSON.parse(decision.actionPlan ?? "{}");
    const simulation = await simulate(actionPlan);

    const execRecord = await executionRepo.create(decisionId, {
      simulationResult: JSON.stringify(simulation),
    });

    const result = await execute(actionPlan);

    await executionRepo.update(execRecord.id, {
      txHash: result.txHash,
      status: result.status,
      gasUsed: result.gasUsed?.toString(),
      gasEstimate: simulation.gasEstimate.toString(),
    });

    await decisionRepo.updateStatus(decisionId, "executed");

    return { simulation, execution: result, decision };
  }
}

export const treasuryService = new TreasuryService();
