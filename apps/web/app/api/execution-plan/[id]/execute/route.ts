import { NextResponse } from "next/server";
import { treasuryService } from "@/server/services/treasury-service";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const walletAddress = body.walletAddress;

    if (typeof walletAddress !== "string" || !walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    const result = await treasuryService.executeDecision(id, walletAddress);

    const execution = result.execution;
    const explorerUrl =
      execution.txHash && execution.status === "confirmed"
        ? `https://sepolia.etherscan.io/tx/${execution.txHash}`
        : null;

    return NextResponse.json({
      executionId: id,
      txHash: execution.txHash,
      status: execution.status,
      gasUsed: execution.gasUsed?.toString(),
      explorerUrl,
      simulation: result.simulation,
      decision: result.decision,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Execution failed",
      },
      { status: 500 }
    );
  }
}
