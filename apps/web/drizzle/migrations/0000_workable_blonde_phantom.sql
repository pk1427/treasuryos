CREATE TYPE "public"."decision_status" AS ENUM('pending', 'approved', 'rejected', 'executed');--> statement-breakpoint
CREATE TYPE "public"."execution_plan_status" AS ENUM('PLANNED', 'APPROVED', 'REJECTED', 'STALE');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('simulating', 'pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treasury_id" uuid NOT NULL,
	"total_value" numeric(18, 2) NOT NULL,
	"runway_months" numeric(8, 2),
	"concentration_score" numeric(5, 4) NOT NULL,
	"idle_capital_usd" numeric(18, 2),
	"idle_capital_days" integer,
	"risk_score" "risk_level" NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treasury_id" uuid NOT NULL,
	"token_address" text NOT NULL,
	"symbol" text NOT NULL,
	"amount" numeric(36, 18) NOT NULL,
	"usd_value" numeric(18, 2) NOT NULL,
	"last_moved_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" text NOT NULL,
	"treasury" text NOT NULL,
	"report_hash" text NOT NULL,
	"publisher" text NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" numeric(20, 0) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"treasury_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" "risk_level" NOT NULL,
	"explanation" text NOT NULL,
	"recommendation" text NOT NULL,
	"action_plan" text,
	"status" "decision_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"report_hash" text NOT NULL,
	"plan_json" text NOT NULL,
	"status" "execution_plan_status" DEFAULT 'PLANNED' NOT NULL,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"simulated_at" timestamp,
	"simulation_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"tx_hash" text,
	"status" "execution_status" DEFAULT 'simulating' NOT NULL,
	"gas_used" numeric(18, 0),
	"gas_estimate" numeric(18, 0),
	"simulation_result" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasuries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_name" text NOT NULL,
	"wallet_address" text NOT NULL,
	"chain_id" integer DEFAULT 8453 NOT NULL,
	"reserve_wallet_address" text,
	"monthly_burn_usd" numeric(18, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "treasuries_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_treasury_id_treasuries_id_fk" FOREIGN KEY ("treasury_id") REFERENCES "public"."treasuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_treasury_id_treasuries_id_fk" FOREIGN KEY ("treasury_id") REFERENCES "public"."treasuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_treasury_id_treasuries_id_fk" FOREIGN KEY ("treasury_id") REFERENCES "public"."treasuries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attestations_tx_hash_idx" ON "attestations" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "attestations_network_timestamp_idx" ON "attestations" USING btree ("network","timestamp");--> statement-breakpoint
CREATE INDEX "attestations_treasury_timestamp_idx" ON "attestations" USING btree ("treasury","timestamp");--> statement-breakpoint
CREATE INDEX "execution_plans_wallet_idx" ON "execution_plans" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "execution_plans_wallet_report_idx" ON "execution_plans" USING btree ("wallet_address","report_hash");--> statement-breakpoint
CREATE INDEX "execution_plans_status_idx" ON "execution_plans" USING btree ("status");