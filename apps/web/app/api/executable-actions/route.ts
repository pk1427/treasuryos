import { NextResponse } from "next/server";
import { generateExecutionPlan } from "@/lib/ai/planner";
import { tracePipeline } from "@/lib/debug/pipeline-trace";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.address !== "string") return NextResponse.json({ error: "address required" }, { status: 400 });
  try {
    const plan = await generateExecutionPlan(body.address);
    const actions = plan.steps.map((step) => ({
      adapterId: step.protocol,
      action: step.action,
      fromAsset: step.fromAsset ?? step.asset ?? "",
      toAsset: step.toAsset ?? "",
      label: `${step.action === "swap" ? "Swap" : step.action} ${step.fromAsset ?? step.asset ?? ""} to ${step.toAsset ?? ""}`.trim(),
    }));
    tracePipeline("dashboard-plan-discovery", {
      basedOnReportHash: plan.basedOnReportHash,
      actions,
      warnings: plan.warnings,
    });
    return NextResponse.json({ actions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to discover executable actions" }, { status: 500 });
  }
}
