import { NextResponse } from "next/server";
import { executionPlanRepo } from "@/server/repositories";
import { scanTreasury } from "@treasuryos/indexer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
          error: `Cannot approve plan with status: ${plan.status}. Only PLANNED plans can be approved.`,
        },
        { status: 409 }
      );
    }

    try {
      const snapshot = await scanTreasury(plan.walletAddress);
      const updated = await executionPlanRepo.updateStatus(id, "APPROVED", {
        snapshot,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "Failed to approve execution plan" },
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
      console.error("Database error during approval:", dbError);
      return NextResponse.json(
        {
          error: "Approval failed: database is not configured.",
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
            : "Failed to approve execution plan",
      },
      { status: 500 }
    );
  }
}
