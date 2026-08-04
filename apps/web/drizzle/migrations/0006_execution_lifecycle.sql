ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "report_hash" text;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "execution_mode" text;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "execution_id" text;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "gas_used" numeric(18, 0);--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "simulation_result" jsonb;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "keeperhub_audit" jsonb;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "attestation_tx_hash" text;--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "execution_proof_hash" text;
