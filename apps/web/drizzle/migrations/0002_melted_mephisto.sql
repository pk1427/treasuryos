ALTER TYPE "public"."execution_plan_status" ADD VALUE 'SIGNED' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TABLE "execution_plans" ADD COLUMN "signer_address" text;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD COLUMN "signed_message" text;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD COLUMN "signed_at" timestamp;