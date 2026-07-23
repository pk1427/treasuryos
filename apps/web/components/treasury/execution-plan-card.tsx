"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";
import type { PlanSimulationResult } from "@/lib/ai/plan-simulation";
import { useWallet } from "@/components/wallet/context";

type Props = {
  address: string;
};

type PlanStatus = "PLANNED" | "APPROVED" | "SIGNED" | "REJECTED" | "STALE";

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

function statusVariant(status: PlanStatus): "low" | "medium" | "high" | "critical" | "default" {
  switch (status) {
    case "PLANNED":
      return "default";
    case "APPROVED":
      return "low";
    case "SIGNED":
      return "low";
    case "REJECTED":
      return "medium";
    case "STALE":
      return "critical";
    default:
      return "default";
  }
}

function statusLabel(status: PlanStatus): string {
  switch (status) {
    case "PLANNED":
      return "Planned — awaiting approval";
    case "APPROVED":
      return "Approved — awaiting execution (execution not yet available)";
    case "SIGNED":
      return "Signed — awaiting execution (execution not yet available)";
    case "REJECTED":
      return "Rejected";
    case "STALE":
      return "Stale — treasury state has changed";
    default:
      return status;
  }
}

export function ExecutionPlanCard({ address }: Props) {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [simulation, setSimulation] = useState<PlanSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [showSignPreview, setShowSignPreview] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const { address: walletAddress, signMessage } = useWallet();

  async function loadPlan() {
    setLoading(true);
    setError(null);
    setPlan(null);
    setPlanId(null);
    setPlanStatus(null);

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
      setPlanId(data.id ?? null);
      setPlanStatus(data.status ?? "PLANNED");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plan generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function approvePlan() {
    if (!planId) return;
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/execution-plan/${planId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: walletAddress ? JSON.stringify({ walletAddress }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to approve plan");
      }

      setPlanStatus(data.status ?? "APPROVED");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectPlan() {
    if (!planId) return;
    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/execution-plan/${planId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: walletAddress ? JSON.stringify({ walletAddress }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to reject plan");
      }

      setPlanStatus(data.status ?? "REJECTED");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function simulatePlan() {
    if (!planId) return;
    setSimulating(true);
    setError(null);
    setSimulation(null);

    try {
      const response = await fetch(`/api/execution-plan/${planId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: walletAddress ? JSON.stringify({ walletAddress }) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.stale) {
          setPlanStatus("STALE");
        }
        throw new Error(data.error ?? "Failed to simulate plan");
      }

      setSimulation(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  async function signPlan() {
    if (!planId || !plan) return;

    if (!walletAddress) {
      setSignError("Connect your wallet to sign this plan.");
      return;
    }

    setSigning(true);
    setSignError(null);

    try {
      const stepsSummary = plan.steps
        .map((s) => `#${s.order} ${s.protocol}/${s.action} ${s.asset ?? s.fromAsset ?? ""}`)
        .join("; ");

      const message = `I confirm intent to execute TreasuryOS execution plan.\nPlan ID: ${planId}\nWallet: ${address}\nReport Hash: ${plan.basedOnReportHash}\nSteps: ${stepsSummary}\nTimestamp: ${new Date().toISOString()}\nThis signature does not execute any transaction.`;

      const result = await signMessage(message);

      if (!result) {
        throw new Error("Wallet signature rejected or failed.");
      }

      const response = await fetch(`/api/execution-plan/${planId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerAddress: walletAddress,
          signature: result.signature,
          signedMessage: message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("stale") || data.error?.includes("STALE")) {
          setPlanStatus("STALE");
        }
        throw new Error(data.error ?? "Failed to sign plan");
      }

      setPlanStatus(data.status ?? "SIGNED");
      setSigned(true);
    } catch (caught) {
      setSignError(caught instanceof Error ? caught.message : "Signing failed");
    } finally {
      setSigning(false);
      setShowSignPreview(false);
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

  const isStale = planStatus === "STALE";
  const isRejected = planStatus === "REJECTED";
  const isConnected = !!walletAddress;
  const walletMatches = isConnected && walletAddress.toLowerCase() === address.toLowerCase();
  const canAct = planStatus === "PLANNED" && !actionLoading && walletMatches;
  const canSign = planStatus === "APPROVED" && !!simulation && !signed && !actionLoading && walletMatches;

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
          <Badge variant={statusVariant(planStatus ?? "PLANNED")} className="normal-case">
            Status: {planStatus ?? "PLANNED"}
          </Badge>
          {planStatus === "APPROVED" ? (
            <span className="text-xs text-zinc-500">
              {statusLabel("APPROVED")}
            </span>
          ) : null}
        </div>

        {isStale ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-300">
              This plan is out of date — treasury state has changed. Please regenerate.
            </p>
            <Button
              onClick={loadPlan}
              className="mt-3"
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Plan
            </Button>
          </div>
        ) : (
          <>
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
                    format={(v) => (v == null ? "∞ (No Debt)" : v.toFixed(2))}
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

            {planStatus === "APPROVED" && !simulation ? (
              <div className="flex items-center gap-3">
                <Button
                  onClick={simulatePlan}
                  disabled={simulating}
                  variant="secondary"
                >
                  {simulating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Simulate
                </Button>
                <span className="text-xs text-zinc-500">
                  Simulation does not move funds. It estimates what would happen
                  if this plan were executed, using KeeperHub&apos;s simulation
                  endpoint.
                </span>
              </div>
            ) : null}

            {simulation ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
                  Simulation Results
                </p>
                {simulation.snapshotWarning ? (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-300">{simulation.snapshotWarning}</p>
                  </div>
                ) : null}
                <div className="mb-3 flex items-center gap-2">
                  <Badge
                    variant={simulation.overallSuccess ? "low" : "critical"}
                    className="normal-case"
                  >
                    {simulation.overallSuccess
                      ? "All steps passed"
                      : "Issues detected"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {simulation.steps.map((step) => (
                    <div
                      key={step.order}
                      className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2"
                    >
                      <Badge
                        variant={step.success ? "low" : "critical"}
                        className="normal-case"
                      >
                        #{step.order} {step.success ? "Passed" : "Failed"}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-200">
                          {step.protocol} / {step.action}
                        </p>
                        {step.estimatedGas ? (
                          <p className="text-xs text-zinc-400">
                            Gas: {step.estimatedGas}
                          </p>
                        ) : null}
                        {step.note ? (
                          <p className="text-xs text-zinc-500">{step.note}</p>
                        ) : null}
                        {step.error ? (
                          <p className="text-xs text-red-400">{step.error}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {simulation.warnings.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                      Warnings
                    </p>
                    <div className="space-y-1">
                      {simulation.warnings.map((warning, index) => (
                        <p key={index} className="text-xs text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                 {simulation.projectedFinalState ? (
                   <div className="mt-3">
                     <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                       Projected Final State
                     </p>
                     <pre className="text-xs text-zinc-300">
                       {JSON.stringify(simulation.projectedFinalState, null, 2)}
                     </pre>
                   </div>
                 ) : null}
               </div>
             ) : null}

             {planStatus === "APPROVED" && simulation && !signed ? (
               <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                 <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                   Sign Execution Intent
                 </p>
                 <p className="text-xs text-zinc-400 mb-3">
                   Review the exact message below before signing. This signature
                   does not execute any transaction or move funds.
                 </p>
                 {showSignPreview ? (
                   <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3">
                     <pre className="text-xs text-zinc-300 whitespace-pre-wrap">
                       {(() => {
                         if (!plan || !planId) return "";
                         const stepsSummary = plan.steps
                           .map((s) => `#${s.order} ${s.protocol}/${s.action} ${s.asset ?? s.fromAsset ?? ""}`)
                           .join("; ");
                         return `I confirm intent to execute TreasuryOS execution plan.\nPlan ID: ${planId}\nWallet: ${address}\nReport Hash: ${plan.basedOnReportHash}\nSteps: ${stepsSummary}\nTimestamp: ${new Date().toISOString()}\nThis signature does not execute any transaction.`;
                       })()}
                     </pre>
                   </div>
                 ) : null}
                 <div className="flex items-center gap-2">
                   {!showSignPreview ? (
                     <Button onClick={() => setShowSignPreview(true)} variant="secondary" size="sm">
                       Review Message
                     </Button>
                   ) : (
                     <>
                       <Button onClick={signPlan} disabled={signing} variant="default" size="sm">
                         {signing ? (
                           <Loader2 className="h-4 w-4 animate-spin mr-2" />
                         ) : null}
                         Sign Execution Intent
                       </Button>
                       <Button
                         onClick={() => setShowSignPreview(false)}
                         variant="outline"
                         size="sm"
                       >
                         Cancel
                       </Button>
                     </>
                   )}
                 </div>
                 {signError ? (
                   <p className="mt-2 text-xs text-red-400">{signError}</p>
                 ) : null}
               </div>
             ) : null}

             {planStatus === "SIGNED" ? (
               <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                 <p className="text-sm text-emerald-300">
                   Signed — awaiting execution (execution not yet available)
                 </p>
                 <p className="text-xs text-zinc-400 mt-1">
                   Signing this intent does not execute any transaction or move funds.
                   Real execution requires a separate step not yet available.
                 </p>
               </div>
             ) : null}

             {isStale && signed ? (
               <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                 <p className="text-sm text-red-300">
                   Prior signature is void — treasury state has changed since signing.
                 </p>
                 <p className="text-xs text-zinc-400 mt-1">
                   Regenerate the plan and sign again after review.
                 </p>
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

             {!isConnected ? (
               <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                 <p className="text-sm text-amber-300">
                   Connect the treasury owner&apos;s wallet to enable actions.
                 </p>
               </div>
             ) : !walletMatches ? (
               <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                 <p className="text-sm text-red-300">
                   Connected wallet does not match the treasury being analyzed.
                 </p>
                 <p className="text-xs text-zinc-400 mt-1">
                   Scanned: {address.slice(0, 6)}...{address.slice(-4)}
                 </p>
                 <p className="text-xs text-zinc-400">
                   Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                 </p>
               </div>
             ) : null}

             {canAct || canSign ? (
              <div className="flex items-center gap-3">
                {canAct ? (
                  <>
                    <Button
                      onClick={approvePlan}
                      disabled={actionLoading}
                      variant="default"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      onClick={rejectPlan}
                      disabled={actionLoading}
                      variant="outline"
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}

            {isRejected ? (
              <div className="flex items-center gap-3">
                <Button
                  onClick={loadPlan}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Plan
                </Button>
              </div>
            ) : null}

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-zinc-500">
                Approving or signing a plan does not move funds. Execution is a
                separate, not-yet-available step that will require a wallet
                signature and a separate explicit execute action.
              </p>
            </div>
          </>
        )}
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
