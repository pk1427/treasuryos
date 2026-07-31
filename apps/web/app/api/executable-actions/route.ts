import { NextResponse } from "next/server";
import { scanTreasury } from "@treasuryos/indexer";
import { EXECUTION_ADAPTERS } from "@/lib/execution/registry";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.address !== "string") return NextResponse.json({ error: "address required" }, { status: 400 });
  try {
    const snapshot = await scanTreasury(body.address);
    const actions = (await Promise.all(EXECUTION_ADAPTERS.map((adapter) => adapter.discover(snapshot)))).flat();
    return NextResponse.json({ actions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to discover executable actions" }, { status: 500 });
  }
}
