import { NextResponse } from "next/server";
import { executionHistoryRepo, executionPlanRepo } from "@/server/repositories";
import { buildEthToUsdcSwapTransaction } from "@/lib/execution/execute";
import { persistExecutionHistory } from "@/lib/execution/history";
import { validateExecutionPreconditions } from "@/lib/execution/validations";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  try {
    const history = await executionHistoryRepo.listByWallet(wallet);
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load execution history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const planId = body.planId;
  const walletAddress = body.walletAddress;
  const phase = body.phase ?? "prepare";

  if (typeof planId !== "string" || typeof walletAddress !== "string") {
    return NextResponse.json(
      { error: "planId and walletAddress required" },
      { status: 400 }
    );
  }

  try {
    const plan = await executionPlanRepo.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { error: "Execution plan not found" },
        { status: 404 }
      );
    }

    const validated = await validateExecutionPreconditions(plan, walletAddress);

    if (phase === "prepare") {
      const transaction = buildEthToUsdcSwapTransaction(
        validated.step,
        validated.walletAddress
      );

      return NextResponse.json({
        success: true,
        status: "ready",
        planId,
        transaction,
      });
    }

    if (phase === "complete") {
      if (typeof body.txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
        return NextResponse.json(
          { error: "txHash required" },
          { status: 400 }
        );
      }

      const result = await persistExecutionHistory({
        planId,
        wallet: validated.walletAddress,
        txHash: body.txHash,
        protocol: "uniswap-v3",
        reportHash: validated.reportHash as `0x${string}`,
      });

      return NextResponse.json({
        success: true,
        txHash: body.txHash,
        explorer: `https://sepolia.etherscan.io/tx/${body.txHash}`,
        status: result.receipt.status,
        historyId: result.history.id,
        attestation: result.attestation,
      });
    }

    return NextResponse.json(
      { error: "Unsupported execution phase" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Execution preconditions failed.",
      },
      { status: 409 }
    );
  }
}
