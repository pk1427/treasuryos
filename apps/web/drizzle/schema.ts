import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const riskLevelEnum = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const decisionStatusEnum = pgEnum("decision_status", [
  "pending",
  "approved",
  "rejected",
  "executed",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "simulating",
  "pending",
  "confirmed",
  "failed",
]);

export const treasuries = pgTable("treasuries", {
  id: uuid("id").defaultRandom().primaryKey(),
  protocolName: text("protocol_name").notNull(),
  walletAddress: text("wallet_address").notNull().unique(),
  chainId: integer("chain_id").notNull().default(8453),
  reserveWalletAddress: text("reserve_wallet_address"),
  monthlyBurnUsd: numeric("monthly_burn_usd", { precision: 18, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  treasuryId: uuid("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  tokenAddress: text("token_address").notNull(),
  symbol: text("symbol").notNull(),
  amount: numeric("amount", { precision: 36, scale: 18 }).notNull(),
  usdValue: numeric("usd_value", { precision: 18, scale: 2 }).notNull(),
  lastMovedAt: timestamp("last_moved_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analyses = pgTable("analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  treasuryId: uuid("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  totalValue: numeric("total_value", { precision: 18, scale: 2 }).notNull(),
  runwayMonths: numeric("runway_months", { precision: 8, scale: 2 }),
  concentrationScore: numeric("concentration_score", {
    precision: 5,
    scale: 4,
  }).notNull(),
  idleCapitalUsd: numeric("idle_capital_usd", { precision: 18, scale: 2 }),
  idleCapitalDays: integer("idle_capital_days"),
  riskScore: riskLevelEnum("risk_score").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const decisions = pgTable("decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  treasuryId: uuid("treasury_id")
    .notNull()
    .references(() => treasuries.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: riskLevelEnum("severity").notNull(),
  explanation: text("explanation").notNull(),
  recommendation: text("recommendation").notNull(),
  actionPlan: text("action_plan"),
  status: decisionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const executions = pgTable("executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  txHash: text("tx_hash"),
  status: executionStatusEnum("status").notNull().default("simulating"),
  gasUsed: numeric("gas_used", { precision: 18, scale: 0 }),
  gasEstimate: numeric("gas_estimate", { precision: 18, scale: 0 }),
  simulationResult: text("simulation_result"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const attestations = pgTable(
  "attestations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    network: text("network").notNull(),
    treasury: text("treasury").notNull(),
    reportHash: text("report_hash").notNull(),
    publisher: text("publisher").notNull(),
    txHash: text("tx_hash").notNull(),
    blockNumber: numeric("block_number", { precision: 20, scale: 0 }).notNull(),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    txHashIdx: uniqueIndex("attestations_tx_hash_idx").on(table.txHash),
    networkTimestampIdx: index("attestations_network_timestamp_idx").on(
      table.network,
      table.timestamp
    ),
    treasuryTimestampIdx: index("attestations_treasury_timestamp_idx").on(
      table.treasury,
      table.timestamp
    ),
  })
);

export const treasuriesRelations = relations(treasuries, ({ many }) => ({
  assets: many(assets),
  analyses: many(analyses),
  decisions: many(decisions),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  treasury: one(treasuries, {
    fields: [assets.treasuryId],
    references: [treasuries.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ one }) => ({
  treasury: one(treasuries, {
    fields: [analyses.treasuryId],
    references: [treasuries.id],
  }),
}));

export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  treasury: one(treasuries, {
    fields: [decisions.treasuryId],
    references: [treasuries.id],
  }),
  executions: many(executions),
}));

export const executionsRelations = relations(executions, ({ one }) => ({
  decision: one(decisions, {
    fields: [executions.decisionId],
    references: [decisions.id],
  }),
}));
