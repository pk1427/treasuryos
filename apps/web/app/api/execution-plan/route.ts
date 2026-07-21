import { NextResponse } from "next/server";
import { generateExecutionPlan } from "@/lib/ai/planner";
import { generateRiskReport } from "@/lib/v1-report";
import { executionPlanRepo } from "@/server/repositories";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = body.address;

  if (typeof address !== "string") {
    return NextResponse.json(
      { error: "address required" },
      { status: 400 }
    );
  }

  try {
    const { reportHash } = await generateRiskReport(address);
    const plan = await generateExecutionPlan(address, reportHash);

    try {
      await executionPlanRepo.markStaleIfReportChanged(
        address,
        plan.basedOnReportHash
      );

      const persisted = await executionPlanRepo.create({
        walletAddress: address,
        reportHash: plan.basedOnReportHash,
        planJson: JSON.stringify(plan),
      });

      return NextResponse.json({
        ...plan,
        id: persisted.id,
        status: persisted.status,
        approvedAt: persisted.approvedAt,
        rejectedAt: persisted.rejectedAt,
        createdAt: persisted.createdAt,
      });
    } catch (dbError) {
      console.error("Database error during plan persistence:", dbError);
      return NextResponse.json({
        ...plan,
        warning: "Plan generated but could not be persisted: database is not configured.",
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate execution plan",
      },
      { status: 500 }
    );
  }
}
