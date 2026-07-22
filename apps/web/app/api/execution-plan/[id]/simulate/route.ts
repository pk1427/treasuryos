import { NextResponse } from "next/server";
import { executionPlanRepo } from "@/server/repositories";
import { simulatePlanSteps } from "@/lib/ai/plan-simulation";
import type { ExecutionPlan } from "@/lib/ai/plan-types";
import type { TreasurySnapshot } from "@treasuryos/shared";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planRecord = await executionPlanRepo.findById(id);

    if (!planRecord) {
      return NextResponse.json(
        { error: "Execution plan not found" },
        { status: 404 }
      );
    }

    if (planRecord.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: `Simulation is only available for APPROVED plans. Current status: ${planRecord.status}`,
        },
        { status: 409 }
      );
    }

    const plan = JSON.parse(planRecord.planJson) as ExecutionPlan;

    let snapshot: TreasurySnapshot | undefined;
    let snapshotWarning: string | undefined;

    if (planRecord.approvedSnapshot) {
      try {
        const raw =
          typeof planRecord.approvedSnapshot === "string"
            ? (JSON.parse(planRecord.approvedSnapshot) as TreasurySnapshot)
            : (planRecord.approvedSnapshot as TreasurySnapshot);
        snapshot = raw;
        const ageMinutes = planRecord.approvedSnapshotAt
          ? Math.round(
              (Date.now() - new Date(planRecord.approvedSnapshotAt).getTime()) /
                1000 /
                60
            )
          : null;
        snapshotWarning =
          ageMinutes !== null
            ? `Simulation uses data captured ${ageMinutes} minute(s) ago at approval time. Live state may have changed.`
            : "Simulation uses data captured at approval time. Live state may have changed.";
      } catch {
        snapshotWarning = "Failed to parse stored snapshot; simulation may be based on outdated data.";
      }
    }

    if (!snapshot) {
      snapshot = await scanTreasury(planRecord.walletAddress);
      snapshotWarning =
        "No snapshot was stored at approval time. Simulation is based on a live scan and may not match the plan's intended assumptions.";
    }

    const simulationResult = await simulatePlanSteps(plan, snapshot);

    await executionPlanRepo.saveSimulationResult(id, simulationResult);

    return NextResponse.json({
      ...simulationResult,
      snapshotWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to simulate execution plan",
      },
      { status: 500 }
    );
  }
}

async function scanTreasury(address: string) {
  const { scanTreasury: scan } = await import("@treasuryos/indexer");
  return scan(address);
}
