CREATE TABLE IF NOT EXISTS "attestations" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "attestations_tx_hash_idx"
  ON "attestations" ("tx_hash");

CREATE INDEX IF NOT EXISTS "attestations_network_timestamp_idx"
  ON "attestations" ("network", "timestamp");

CREATE INDEX IF NOT EXISTS "attestations_treasury_timestamp_idx"
  ON "attestations" ("treasury", "timestamp");
