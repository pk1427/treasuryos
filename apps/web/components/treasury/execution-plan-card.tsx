"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Lock } from "lucide-react";
import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";

type Props = {
  address: string;
};

function actionLabel(action: PlanStep["action"]): string {
  switch (action) {
    case "swap":
      return "Swap";
    case "repay":
      return "Repay";
    case "supply":
      return "Supply";
    case "withdraw":
      return "Withdraw";
    case "collect-fees":
      return "Collect Fees";
    case "rebalance":
      return "Rebalance";
    default:
      return action;
  }
}

function actionVariant(action: PlanStep["action"]): "low" | "medium" | "high" | "critical" | "default" {
  switch (action) {
    case "repay":
      return "critical";
    case "swap":
      return "medium";
    case "collect-fees":
      return "low";
    default:
      return "default";
  }
}

export function ExecutionPlanCard({ address }: Props) {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      const response = await fetch("/api/execution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate execution plan");
      }

      setPlan(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plan generation failed");
    } finally {
      setLoading(false);
    }
  }

  if (!plan && !loading && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Action Planner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">
            Generate a deterministic execution plan based on your treasury risk
            analysis. This is read-only and does not execute any actions.
          </p>
          <Button
            onClick={loadPlan}
            className="mt-4"
            variant="secondary"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Action Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing risk data and building plan...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Action Planner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error}</p>
          <Button
            onClick={loadPlan}
            className="mt-3"
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-300" />
          AI Action Planner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="normal-case">
            Status: {plan?.status}
          </Badge>
          <Badge variant="medium" className="normal-case">
            Requires Approval
          </Badge>
        </div>

        {plan?.steps && plan.steps.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
              Planned Steps
            </p>
            <div className="space-y-2">
              {plan.steps.map((step) => (
                <StepCard key={step.order} step={step} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No actionable steps generated.</p>
        )}

        {plan?.expectedOutcome ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
              Expected Outcome
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <OutcomeRow
                label="Health Factor"
                before={plan.expectedOutcome.healthFactorBefore}
                after={plan.expectedOutcome.healthFactorAfter}
                format={(v) => (v == null ? "N/A" : v.toFixed(2))}
              />
              <OutcomeRow
                label="ETH Exposure"
                before={plan.expectedOutcome.ethExposureBefore}
                after={plan.expectedOutcome.ethExposureAfter}
                format={(v) => `${((v ?? 0) * 100).toFixed(0)}%`}
              />
              <OutcomeRow
                label="Stablecoin Ratio"
                before={plan.expectedOutcome.stablecoinRatioBefore}
                after={plan.expectedOutcome.stablecoinRatioAfter}
                format={(v) => `${((v ?? 0) * 100).toFixed(0)}%`}
              />
            </div>
          </div>
        ) : null}

        {plan?.warnings && plan.warnings.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
              Warnings
            </p>
            <div className="space-y-1">
              {plan.warnings.map((warning, index) => (
                <p key={index} className="text-xs text-amber-400">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button disabled className="opacity-50 cursor-not-allowed">
            <Lock className="h-4 w-4 mr-2" />
            Approve & Execute
          </Button>
          <span className="text-xs text-zinc-500">
            Coming in v5.1 — not yet functional
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadPlan}
            variant="outline"
            size="sm"
          >
            Regenerate Plan
          </Button>
          <span className="text-xs text-zinc-500">
            Plan is read-only and does not execute actions.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StepCard({ step }: { step: PlanStep }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <Badge variant="default" className="normal-case">
        #{step.order}
      </Badge>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={actionVariant(step.action)} className="normal-case">
            {actionLabel(step.action)}
          </Badge>
          <span className="text-xs text-zinc-500 uppercase">
            {step.protocol}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-200">{step.reason}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          {step.fromAsset ? (
            <span>
              From: {step.fromAsset}
              {step.amountToken ? ` (${step.amountToken})` : ""}
            </span>
          ) : null}
          {step.toAsset ? <span>To: {step.toAsset}</span> : null}
          {step.asset ? <span>Asset: {step.asset}</span> : null}
          {step.amountUsd ? (
            <span className="font-mono text-cyan-300">
              ${step.amountUsd.toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  before,
  after,
  format,
}: {
  label: string;
  before?: number | null | undefined;
  after?: number | null | undefined;
  format: (value: number | null | undefined) => string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-sm text-zinc-400">
          {format(before)}
        </span>
        <span className="text-xs text-zinc-600">→</span>
        <span className="font-mono text-sm text-emerald-300">
          {format(after)}
        </span>
      </div>
    </div>
  );
}
