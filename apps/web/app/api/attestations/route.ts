import { NextResponse } from "next/server";
import { attestationRepo } from "@/server/repositories";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));
  const network = searchParams.get("network") ?? undefined;
  const treasury = searchParams.get("treasury") ?? undefined;

  try {
    const rows = await attestationRepo.list({
      limit: limit + 1,
      offset,
      network,
      treasury,
    });
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      network: row.network,
      treasury: row.treasury,
      reportHash: row.reportHash,
      publisher: row.publisher,
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      timestamp: row.timestamp.toISOString(),
      createdAt: row.createdAt.toISOString(),
      status: "Attested Onchain",
      transactionLink: etherscanTxUrl(row.network, row.txHash),
    }));

    return NextResponse.json({
      items,
      page: {
        limit,
        offset,
        nextOffset: rows.length > limit ? offset + limit : null,
        hasMore: rows.length > limit,
      },
      filters: {
        network: network ?? null,
        treasury: treasury ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load attestations",
      },
      { status: 500 }
    );
  }
}

function clampLimit(value: string | null): number {
  const parsed = value ? Number.parseInt(value, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function clampOffset(value: string | null): number {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function etherscanTxUrl(network: string, txHash: string): string {
  if (network === "sepolia") {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  return `https://etherscan.io/tx/${txHash}`;
}
