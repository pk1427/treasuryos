import { NextResponse } from "next/server";
import { executionPlanRepo } from "@/server/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestWalletAddress = body.walletAddress;

    const plan = await executionPlanRepo.findById(id);

    if (!plan) {
      return NextResponse.json(
        { error: "Execution plan not found" },
        { status: 404 }
      );
    }

    if (plan.status !== "PLANNED") {
      return NextResponse.json(
        {
          error: `Cannot reject plan with status: ${plan.status}. Only PLANNED plans can be rejected.`,
        },
        { status: 409 }
      );
    }

    if (
      !requestWalletAddress ||
      typeof requestWalletAddress !== "string" ||
      requestWalletAddress.toLowerCase() !== plan.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: `Wallet mismatch. This plan belongs to ${plan.walletAddress}. Connect that wallet to reject.`,
        },
        { status: 403 }
      );
    }

    try {
      const updated = await executionPlanRepo.updateStatus(id, "REJECTED");

      if (!updated) {
        return NextResponse.json(
          { error: "Failed to reject execution plan" },
          { status: 500 }
        );
      }

      const planJson = JSON.parse(updated.planJson);

      return NextResponse.json({
        ...planJson,
        id: updated.id,
        status: updated.status,
        approvedAt: updated.approvedAt,
        rejectedAt: updated.rejectedAt,
        createdAt: updated.createdAt,
      });
    } catch (dbError) {
      console.error("Database error during rejection:", dbError);
      return NextResponse.json(
        {
          error: "Rejection failed: database is not configured.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reject execution plan",
      },
      { status: 500 }
    );
  }
}
