import { NextResponse } from "next/server";
import { treasuryService } from "@/server/services/treasury-service";

export async function POST(request: Request) {
  const body = await request.json();
  const { decisionId, walletAddress } = body;

  if (!decisionId || !walletAddress) {
    return NextResponse.json(
      { error: "decisionId and walletAddress required" },
      { status: 400 }
    );
  }

  try {
    const result = await treasuryService.executeDecision(
      decisionId,
      walletAddress
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
