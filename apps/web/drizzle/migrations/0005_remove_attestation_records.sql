DROP TABLE IF EXISTS "attestations";
--> statement-breakpoint
ALTER TABLE "execution_history" ADD COLUMN IF NOT EXISTS "report_hash" text NOT NULL DEFAULT '';
