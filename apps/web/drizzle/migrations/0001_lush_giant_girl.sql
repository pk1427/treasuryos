ALTER TABLE "execution_plans" ADD COLUMN "approved_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD COLUMN "approved_snapshot_at" timestamp;