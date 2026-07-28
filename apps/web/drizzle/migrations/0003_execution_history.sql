CREATE TABLE IF NOT EXISTS "execution_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"wallet" text NOT NULL,
	"tx_hash" text NOT NULL,
	"chain" text NOT NULL,
	"protocol" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_history" ADD CONSTRAINT "execution_history_plan_id_execution_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."execution_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_history_plan_idx" ON "execution_history" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_history_wallet_idx" ON "execution_history" USING btree ("wallet");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "execution_history_tx_hash_idx" ON "execution_history" USING btree ("tx_hash");
