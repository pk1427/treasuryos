import { and, desc, eq, ne, or, type SQL } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import type { RiskLevel, DecisionStatus, ExecutionStatus } from "@/types";

export class TreasuryRepository {
  async findByWallet(walletAddress: string) {
    const db = requireDb();
    const [treasury] = await db
      .select()
      .from(schema.treasuries)
      .where(eq(schema.treasuries.walletAddress, walletAddress.toLowerCase()));
    return treasury ?? null;
  }

  async findById(id: string) {
    const db = requireDb();
    const [treasury] = await db
      .select()
      .from(schema.treasuries)
      .where(eq(schema.treasuries.id, id));
    return treasury ?? null;
  }

  async create(data: {
    protocolName: string;
    walletAddress: string;
    chainId: number;
    reserveWalletAddress?: string;
    monthlyBurnUsd?: number;
  }) {
    const db = requireDb();
    const [treasury] = await db
      .insert(schema.treasuries)
      .values({
        protocolName: data.protocolName,
        walletAddress: data.walletAddress.toLowerCase(),
        chainId: data.chainId,
        reserveWalletAddress: data.reserveWalletAddress,
        monthlyBurnUsd: data.monthlyBurnUsd?.toString(),
      })
      .returning();
    return treasury;
  }

  async upsertAssets(
    treasuryId: string,
    assets: Array<{
      tokenAddress: string;
      symbol: string;
      amount: string;
      usdValue: number;
      lastMovedAt?: Date;
    }>
  ) {
    const db = requireDb();
    await db
      .delete(schema.assets)
      .where(eq(schema.assets.treasuryId, treasuryId));

    if (assets.length === 0) return [];

    return db.insert(schema.assets).values(
      assets.map((a) => ({
        treasuryId,
        tokenAddress: a.tokenAddress.toLowerCase(),
        symbol: a.symbol,
        amount: a.amount,
        usdValue: a.usdValue.toString(),
        lastMovedAt: a.lastMovedAt,
      }))
    ).returning();
  }

  async getAssets(treasuryId: string) {
    const db = requireDb();
    return db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.treasuryId, treasuryId));
  }
}

export class AnalysisRepository {
  async create(
    treasuryId: string,
    data: {
      totalValue: number;
      runwayMonths: number | null;
      concentrationScore: number;
      idleCapitalUsd: number;
      idleCapitalDays: number;
      riskScore: RiskLevel;
    }
  ) {
    const db = requireDb();
    const [analysis] = await db
      .insert(schema.analyses)
      .values({
        treasuryId,
        totalValue: data.totalValue.toString(),
        runwayMonths: data.runwayMonths?.toString() ?? null,
        concentrationScore: data.concentrationScore.toString(),
        idleCapitalUsd: data.idleCapitalUsd.toString(),
        idleCapitalDays: data.idleCapitalDays,
        riskScore: data.riskScore,
      })
      .returning();
    return analysis;
  }

  async getLatest(treasuryId: string) {
    const db = requireDb();
    const results = await db
      .select()
      .from(schema.analyses)
      .where(eq(schema.analyses.treasuryId, treasuryId))
      .orderBy(schema.analyses.timestamp)
      .limit(1);
    return results[0] ?? null;
  }

  async getHistory(treasuryId: string, limit = 10) {
    const db = requireDb();
    return db
      .select()
      .from(schema.analyses)
      .where(eq(schema.analyses.treasuryId, treasuryId))
      .orderBy(schema.analyses.timestamp)
      .limit(limit);
  }
}

export class DecisionRepository {
  async create(
    treasuryId: string,
    data: {
      type: string;
      severity: RiskLevel;
      explanation: string;
      recommendation: string;
      actionPlan?: string;
    }
  ) {
    const db = requireDb();
    const [decision] = await db
      .insert(schema.decisions)
      .values({
        treasuryId,
        type: data.type,
        severity: data.severity,
        explanation: data.explanation,
        recommendation: data.recommendation,
        actionPlan: data.actionPlan,
      })
      .returning();
    return decision;
  }

  async updateStatus(id: string, status: DecisionStatus) {
    const db = requireDb();
    const [decision] = await db
      .update(schema.decisions)
      .set({ status })
      .where(eq(schema.decisions.id, id))
      .returning();
    return decision;
  }

  async getByTreasury(treasuryId: string) {
    const db = requireDb();
    return db
      .select()
      .from(schema.decisions)
      .where(eq(schema.decisions.treasuryId, treasuryId))
      .orderBy(schema.decisions.createdAt);
  }

  async getById(id: string) {
    const db = requireDb();
    const [decision] = await db
      .select()
      .from(schema.decisions)
      .where(eq(schema.decisions.id, id));
    return decision ?? null;
  }
}

export class ExecutionRepository {
  async create(decisionId: string, data: { simulationResult?: string }) {
    const db = requireDb();
    const [execution] = await db
      .insert(schema.executions)
      .values({
        decisionId,
        status: "simulating",
        simulationResult: data.simulationResult,
      })
      .returning();
    return execution;
  }

  async update(
    id: string,
    data: {
      txHash?: string;
      status: ExecutionStatus;
      gasUsed?: string;
      gasEstimate?: string;
    }
  ) {
    const db = requireDb();
    const [execution] = await db
      .update(schema.executions)
      .set(data)
      .where(eq(schema.executions.id, id))
      .returning();
    return execution;
  }

  async getByDecision(decisionId: string) {
    const db = requireDb();
    return db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.decisionId, decisionId));
  }

  async getAuditTrail(treasuryId: string) {
    const db = requireDb();
    const decisions = await db
      .select()
      .from(schema.decisions)
      .where(eq(schema.decisions.treasuryId, treasuryId));

    const trail = [];
    for (const decision of decisions) {
      const execs = await db
        .select()
        .from(schema.executions)
        .where(eq(schema.executions.decisionId, decision.id));

      for (const exec of execs) {
        trail.push({ decision, execution: exec });
      }
    }
    return trail;
  }
}

export class AttestationRepository {
  async upsert(data: {
    network: string;
    treasury: string;
    reportHash: string;
    publisher: string;
    txHash: string;
    blockNumber: string;
    timestamp: Date;
  }) {
    const db = requireDb();
    const [attestation] = await db
      .insert(schema.attestations)
      .values({
        network: data.network,
        treasury: data.treasury.toLowerCase(),
        reportHash: data.reportHash.toLowerCase(),
        publisher: data.publisher.toLowerCase(),
        txHash: data.txHash.toLowerCase(),
        blockNumber: data.blockNumber,
        timestamp: data.timestamp,
      })
      .onConflictDoUpdate({
        target: schema.attestations.txHash,
        set: {
          network: data.network,
          treasury: data.treasury.toLowerCase(),
          reportHash: data.reportHash.toLowerCase(),
          publisher: data.publisher.toLowerCase(),
          blockNumber: data.blockNumber,
          timestamp: data.timestamp,
        },
      })
      .returning();
    return attestation;
  }

  async list({
    limit = 25,
    offset = 0,
    network,
    treasury,
  }: {
    limit?: number;
    offset?: number;
    network?: string;
    treasury?: string;
  } = {}) {
    const db = requireDb();
    const filters: SQL[] = [];
    let query = db
      .select()
      .from(schema.attestations)
      .$dynamic()
      .orderBy(desc(schema.attestations.timestamp))
      .limit(limit)
      .offset(offset);

    if (network) filters.push(eq(schema.attestations.network, network));
    if (treasury) {
      filters.push(eq(schema.attestations.treasury, treasury.toLowerCase()));
    }
    if (filters.length > 0) query = query.where(and(...filters));

    return query;
  }
}

export class ExecutionPlanRepository {
  async create(data: {
    walletAddress: string;
    reportHash: string;
    planJson: string;
  }) {
    const db = requireDb();
    const [plan] = await db
      .insert(schema.executionPlans)
      .values({
        walletAddress: data.walletAddress.toLowerCase(),
        reportHash: data.reportHash,
        planJson: data.planJson,
        status: "PLANNED",
      })
      .returning();
    return plan;
  }

  async findById(id: string) {
    const db = requireDb();
    const [plan] = await db
      .select()
      .from(schema.executionPlans)
      .where(eq(schema.executionPlans.id, id));
    return plan ?? null;
  }

  async getLatestByWallet(walletAddress: string) {
    const db = requireDb();
    const results = await db
      .select()
      .from(schema.executionPlans)
      .where(eq(schema.executionPlans.walletAddress, walletAddress.toLowerCase()))
      .orderBy(desc(schema.executionPlans.createdAt))
      .limit(1);
    return results[0] ?? null;
  }

  async updateStatus(
    id: string,
    status: "APPROVED" | "SIGNED" | "REJECTED" | "STALE",
    options?: { snapshot?: unknown }
  ) {
    const db = requireDb();
    const updates: Record<string, unknown> = { status };

    if (status === "APPROVED") {
      updates.approvedAt = new Date();
      updates.rejectedAt = null;
      if (options?.snapshot) {
        updates.approvedSnapshot = JSON.stringify(options.snapshot);
        updates.approvedSnapshotAt = new Date();
      }
    } else if (status === "SIGNED") {
      updates.signedAt = new Date();
    } else if (status === "REJECTED") {
      updates.rejectedAt = new Date();
      updates.approvedAt = null;
    }

    const [plan] = await db
      .update(schema.executionPlans)
      .set(updates)
      .where(eq(schema.executionPlans.id, id))
      .returning();
    return plan ?? null;
  }

  async markStaleIfReportChanged(walletAddress: string, currentReportHash: string) {
    const db = requireDb();
    const [plan] = await db
      .update(schema.executionPlans)
      .set({ status: "STALE" })
      .where(
        and(
          eq(schema.executionPlans.walletAddress, walletAddress.toLowerCase()),
          or(
            eq(schema.executionPlans.status, "APPROVED"),
            eq(schema.executionPlans.status, "SIGNED")
          ),
          ne(schema.executionPlans.reportHash, currentReportHash)
        )
      )
      .returning();
    return plan ?? null;
  }

  async saveSignature(
    id: string,
    signerAddress: string,
    signedMessage: string,
    signature: string
  ) {
    const db = requireDb();
    const [plan] = await db
      .update(schema.executionPlans)
      .set({
        status: "SIGNED",
        signerAddress: signerAddress.toLowerCase(),
        signedMessage,
        signature,
        signedAt: new Date(),
      })
      .where(eq(schema.executionPlans.id, id))
      .returning();
    return plan ?? null;
  }

  async saveSimulationResult(
    id: string,
    simulationResult: Record<string, unknown>
  ) {
    const db = requireDb();
    const [plan] = await db
      .update(schema.executionPlans)
      .set({
        simulationResult: JSON.stringify(simulationResult),
        simulatedAt: new Date(),
      })
      .where(eq(schema.executionPlans.id, id))
      .returning();
    return plan ?? null;
  }

  async findByIdWithSnapshot(id: string) {
    const db = requireDb();
    const [plan] = await db
      .select()
      .from(schema.executionPlans)
      .where(eq(schema.executionPlans.id, id));
    return plan ?? null;
  }
}

export const treasuryRepo = new TreasuryRepository();
export const analysisRepo = new AnalysisRepository();
export const decisionRepo = new DecisionRepository();
export const executionRepo = new ExecutionRepository();
export const attestationRepo = new AttestationRepository();
export const executionPlanRepo = new ExecutionPlanRepository();
