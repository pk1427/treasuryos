import { NextResponse } from "next/server";
import { executionPlanRepo } from "@/server/repositories";

export async function GET(
  request: Request,
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

    const planJson = JSON.parse(plan.planJson);

    return NextResponse.json({
      ...planJson,
      id: plan.id,
      status: plan.status,
      approvedAt: plan.approvedAt,
      rejectedAt: plan.rejectedAt,
      createdAt: plan.createdAt,
    });
  } catch (error) {
    console.error("Database error during plan fetch:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch execution plan",
      },
      { status: 500 }
    );
  }
}
