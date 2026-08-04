import type { TreasurySnapshot } from "@treasuryos/shared";

const TRACE_ENABLED = process.env.TREASURYOS_TRACE_PIPELINE === "true";

export function tracePipeline(stage: string, data: Record<string, unknown>) {
  if (!TRACE_ENABLED) return;
  console.info(`[treasuryos:pipeline:${stage}]`, JSON.stringify(data));
}

export function summarizeSnapshot(snapshot: TreasurySnapshot) {
  return {
    address: snapshot.address,
    fetchedAt: snapshot.fetchedAt,
    totalValueUsd: snapshot.totalValueUsd,
    positions: snapshot.positions.map((position) => ({
      protocol: position.protocol,
      asset: position.asset,
      amountUsd: position.amountUsd,
    })),
  };
}
