import { NextResponse } from "next/server";
import { treasuryService } from "@/server/services/treasury-service";
import { executionPlanRepo, decisionRepo } from "@/server/repositories";
import { planStepToActionPlan } from "@/lib/execution/adapters/keeperhub";
import type { ExecutionPlan } from "@/lib/ai/plan-types";

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

    const plan = await executionPlanRepo.findById(id);
    if (!plan) {
      return NextResponse.json(
        { error: "Execution plan not found" },
        { status: 404 }
      );
    }

    const treasury = await treasuryService.connectTreasury(plan.walletAddress);
    const treasuryId = "id" in treasury ? treasury.id : treasury.walletAddress;
    const decisions = await decisionRepo.getByTreasury(treasuryId);
    const decision = decisions.find((d) => {
      try {
        const actionPlan = JSON.parse(d.actionPlan ?? "{}");
        return actionPlan.basedOnReportHash === plan.reportHash;
      } catch {
        return false;
      }
    });

    let decisionId = decision?.id;
    if (!decisionId) {
      const planJson = JSON.parse(plan.planJson) as ExecutionPlan;
      const primaryStep = planJson.steps[0];
      if (!primaryStep) {
        return NextResponse.json(
          { error: "Execution plan has no executable steps" },
          { status: 400 }
        );
      }

      const actionPlan = planStepToActionPlan(primaryStep, plan.walletAddress);
      const created = await decisionRepo.create(treasuryId, {
        type: primaryStep.action,
        severity: "medium",
        explanation: primaryStep.reason,
        recommendation: primaryStep.reason,
        actionPlan: JSON.stringify(actionPlan),
      });
      decisionId = created.id;
    }

    const result = await treasuryService.executeDecision(decisionId, walletAddress);

    const execution = result.execution;
    const explorerUrl =
      execution.txHash && execution.status === "confirmed"
        ? `https://sepolia.etherscan.io/tx/${execution.txHash}`
        : null;

    const serializedSimulation = result.simulation
      ? {
          ...result.simulation,
          gasEstimate: result.simulation.gasEstimate?.toString(),
        }
      : null;

    return NextResponse.json({
      executionId: id,
      txHash: execution.txHash,
      status: execution.status,
      gasUsed: execution.gasUsed?.toString(),
      explorerUrl,
      simulation: serializedSimulation,
      decision: result.decision,
      executionMode: execution.executionMode,
      keeperhub: execution.executionMode === "keeperhub" ? {
        executionId: execution.executionId,
        transactionHash: execution.txHash,
        explorerUrl: execution.explorerUrl ?? explorerUrl,
        chainId: execution.chainId,
        gasUsed: execution.gasUsed?.toString(),
        sponsored: execution.sponsored,
        finalStatus: execution.status,
        executedAt: new Date().toISOString(),
      } : null,
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
