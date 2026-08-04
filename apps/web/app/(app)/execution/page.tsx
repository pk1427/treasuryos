"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { shortenHash } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";
import { StatusPill, WorkflowStepper } from "@/components/ui/treasury-primitives";

type PlanStatus = "PLANNED" | "NOT_ACTIONABLE" | "APPROVED" | "SIGNED" | "REJECTED" | "STALE";

export default function ExecutionPage() {
  const wallet = useWallet();
  const session = useTreasurySession();
  const {
    mode,
    analyzedAddress: address,
    reportResponse,
    connectedWallet,
    isKeeperHubManaged,
    executionResult,
    setExecutionResult,
  } = session;

  const report = reportResponse?.report;
  const reportHash = reportResponse?.reportHash;
  const ownerVerified =
    Boolean(wallet.address && report?.address) &&
    wallet.address!.toLowerCase() === report!.address.toLowerCase();
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [signed, setSigned] = useState(false);
  const [selectedExecutionMode, setSelectedExecutionMode] = useState<"direct" | "keeperhub">("direct");
  const executionMode = isKeeperHubManaged ? "keeperhub" : selectedExecutionMode;
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [executionHistory, setExecutionHistory] = useState<
    Array<{
      date: string;
      action: string;
      txHash: string;
      explorer: string;
      status: string;
    }>
  >([]);

  useEffect(() => {
    if (!wallet.address) return;
    fetch(`/api/execute?wallet=${wallet.address}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("History unavailable")))
      .then(({ history }) => setExecutionHistory(history.map((entry: { createdAt: string; txHash: string; status: string }) => ({ date: new Date(entry.createdAt).toLocaleString(), action: "Executed plan", txHash: entry.txHash, explorer: `https://sepolia.etherscan.io/tx/${entry.txHash}`, status: entry.status }))))
      .catch(() => undefined);
  }, [wallet.address, executionResult]);

  const locked =
    mode === "analyze" || (!isKeeperHubManaged && (!connectedWallet || !ownerVerified));
  const mismatch =
    Boolean(connectedWallet && report?.address) &&
    connectedWallet!.toLowerCase() !== report!.address.toLowerCase();

  const isConnected = !!wallet.address;
  const walletMatches = isConnected && wallet.address && report?.address
    ? wallet.address.toLowerCase() === report.address.toLowerCase()
    : false;
  const canManage = walletMatches || isKeeperHubManaged;

  const effectiveWalletAddressForApi = () => {
    if (executionMode === "keeperhub") {
      return wallet.address || report?.address || address || "";
    }
    return wallet.address || "";
  };
  const keeperHubSteps = ["Generate", "Approve", "Simulate", "Execute"];
  const directSteps = ["Generate", "Approve", "Simulate", "Sign", "Execute"];
  const workflowSteps = executionMode === "keeperhub" ? keeperHubSteps : directSteps;
  const keeperHubActiveStep =
    planStatus === "SIGNED" || (planStatus === "APPROVED" && simulation)
      ? "Execute"
      : planStatus === "APPROVED"
        ? "Simulate"
        : "Approve";
  const directActiveStep =
    planStatus === "SIGNED" ? "Execute"
    : planStatus === "APPROVED" ? simulation ? "Sign" : "Simulate"
    : "Approve";
  const activeStep = executionMode === "keeperhub" ? keeperHubActiveStep : directActiveStep;
  const keeperHubCompletedThrough =
    planStatus === "SIGNED" || (planStatus === "APPROVED" && simulation)
      ? 2
      : planStatus === "APPROVED"
        ? 1
        : 0;
  const directCompletedThrough =
    planStatus === "SIGNED" ? 3
    : planStatus === "APPROVED" ? simulation ? 2 : 1
    : 0;
  const completedThrough = executionMode === "keeperhub" ? keeperHubCompletedThrough : directCompletedThrough;

  async function loadPlan() {
    if (!report?.address) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    setPlanId(null);
    setPlanStatus(null);

    try {
      const response = await fetch("/api/execution-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: report.address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to generate execution plan");
      setPlan(data);
      setPlanId(data.id ?? null);
      setPlanStatus(data.status ?? "PLANNED");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plan generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function executePlan() {
    if (!planId || !plan) return;
    setActionLoading(true);
    setError(null);

    try {
      const effectiveWalletAddress =
        executionMode === "keeperhub"
          ? wallet.address || (report?.address ?? address)
          : wallet.address;

      if (!effectiveWalletAddress) {
        throw new Error("Wallet address is required");
      }

      if (executionMode === "keeperhub") {
        const response = await fetch(`/api/execution-plan/${planId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: effectiveWalletAddress }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Execution failed");

        setExecutionResult({
          txHash: data.txHash,
          explorer: data.explorerUrl,
          status: data.status,
          executionMode: data.executionMode,
          keeperhub: data.keeperhub,
        });
        setExecutionHistory((history) => [
          {
            date: new Date().toISOString(),
            action: planActionLabel(plan),
            txHash: data.txHash,
            explorer: data.explorerUrl,
            status: data.status,
          },
          ...history,
        ]);
        return;
      }

      const prepareResponse = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "prepare", planId, walletAddress: wallet.address }),
      });

      const prepareData = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepareData.error ?? "Failed to prepare transaction");

      const transaction = prepareData.transaction;
      if (!transaction || !transaction.to || !transaction.data) {
        throw new Error("Invalid transaction preparation response");
      }

      const txHash = await wallet.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        chainId: transaction.chainId,
      });

      if (!txHash) throw new Error("Wallet did not return a transaction hash");

      const completeResponse = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "complete", planId, walletAddress: wallet.address, txHash }),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeData.error ?? "Execution completion failed");

      setExecutionResult({
        txHash: completeData.txHash,
        explorer: completeData.explorer,
        status: completeData.status,
        executionMode: "direct",
        actualOutput: completeData.actualOutput,
        postExecution: completeData.postExecution,
      });
      setExecutionHistory((history) => [
          {
            date: new Date().toISOString(),
            action: planActionLabel(plan),
          txHash: completeData.txHash,
          explorer: completeData.explorer,
          status: completeData.status,
        },
        ...history,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution failed");
    } finally {
      setActionLoading(false);
    }
  }

  const expectedOutcome = plan?.expectedOutcome;
  const ethExposureBefore = expectedOutcome?.ethExposureBefore ?? 0;
  const ethExposureAfter = expectedOutcome?.ethExposureAfter ?? 0;
  const usdcBalanceBefore = report?.snapshot.positions.find(
    (position) => position.asset === "USDC"
  )?.amountUsd ?? 0;
  const usdcBalanceAfter = expectedOutcome
    ? usdcBalanceBefore + (plan.steps.find((s) => s.action === "swap" && s.toAsset === "USDC")?.amountUsd ?? 0)
    : usdcBalanceBefore;
  const deltaUsd = usdcBalanceAfter - usdcBalanceBefore;
  const deltaEth = ethExposureBefore - ethExposureAfter;

  const slippageBps = 50;
  const minReceived = expectedOutcome
    ? (plan.steps.find((s) => s.action === "swap" && s.toAsset === "USDC")?.amountUsd ?? 0) * (1 - slippageBps / 10000)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              TreasuryOS — Execution
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Execution Plan
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Review a deterministic plan, validate it, and execute through your treasury wallet or KeeperHub.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {locked && !mismatch ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} isKeeperHubManaged={isKeeperHubManaged} />
        ) : locked && mismatch ? (
          <MismatchedWalletPanel connectedWallet={connectedWallet} analyzedAddress={report?.address ?? address} />
        ) : executionResult ? (
          <div className="space-y-6">
            <ExecutionConfirmation result={executionResult} reportHash={reportHash} />
            <BeforeAfterPanel
              ethExposureBefore={ethExposureBefore}
              ethExposureAfter={ethExposureAfter}
              usdcBalanceBefore={usdcBalanceBefore}
              usdcBalanceAfter={usdcBalanceAfter}
              deltaUsd={deltaUsd}
              deltaEth={deltaEth}
              actualOutput={executionResult.actualOutput}
              postExecution={executionResult.postExecution}
            />
            <ProofOfExecution
              txHash={executionResult.txHash}
              explorer={executionResult.explorer}
              reportHash={reportHash}
              executionMode={executionResult.executionMode}
              keeperhub={executionResult.keeperhub}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-white/10 pb-2">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  activeTab === "live"
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                onClick={() => setActiveTab("live")}
              >
                Live Plan
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  activeTab === "history"
                    ? "bg-cyan-400/10 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                onClick={() => setActiveTab("history")}
              >
                Execution History
              </button>
            </div>

            {activeTab === "history" ? (
              <ExecutionHistory history={executionHistory} />
            ) : loading ? (
              <StagedLoading
                steps={[
                  "Analyzing risk data",
                  "Building execution plan",
                  "Checking preconditions",
                ]}
              />
            ) : error ? (
              <ExecutionError error={error} onRetry={loadPlan} />
            ) : plan && plan.steps.length > 0 ? (
              <div className="space-y-6">
                <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                    {executionMode === "keeperhub"
                      ? "KeeperHub execution workflow"
                      : "Direct execution workflow"}
                  </p>
                  <WorkflowStepper
                    steps={workflowSteps}
                    activeStep={activeStep}
                    completedThrough={completedThrough}
                  />
                  <p className="mt-3 text-xs text-zinc-400">
                    {executionMode === "keeperhub"
                      ? "KeeperHub executes this plan server-side through the organization wallet. No MetaMask signing is required."
                      : "Approval, simulation, and intent signing do not move funds. Only the final Execute action opens your wallet transaction prompt."}
                  </p>
                </section>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="success">
                    {executionMode === "keeperhub"
                      ? "KeeperHub treasury verified"
                      : "Verified Treasury Owner"}
                  </StatusPill>
                  <StatusPill tone="neutral">
                    {executionMode === "keeperhub"
                      ? "Organization wallet"
                      : `Wallet ${shortenAddress(wallet.address ?? "")}`}
                  </StatusPill>
                </div>
                <ExecutionTicket
                  plan={plan}
                  planStatus={planStatus ?? "PLANNED"}
                  simulationPassed={Boolean((simulation as { overallSuccess?: boolean } | null)?.overallSuccess)}
                  slippageBps={slippageBps}
                  minReceived={minReceived}
                  executionMode={executionMode}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Execution Mode</span>
                  <div className="flex rounded-lg border border-white/10 bg-zinc-950/50 p-0.5">
                    <button
                      type="button"
                      disabled={planStatus !== "PLANNED"}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition",
                        executionMode === "direct"
                          ? "bg-cyan-400/10 text-cyan-300"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                      onClick={() => setSelectedExecutionMode("direct")}
                    >
                      Direct Execution
                    </button>
                    <button
                      type="button"
                      disabled={planStatus !== "PLANNED"}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition",
                        executionMode === "keeperhub"
                          ? "bg-violet-400/10 text-violet-300"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                      onClick={() => setSelectedExecutionMode("keeperhub")}
                    >
                      KeeperHub Execution
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {executionMode === "keeperhub" && planStatus === "APPROVED" && simulation && canManage ? (
                    <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                      <Badge variant="outline" className="normal-case border-violet-400/50 text-violet-200">
                        KeeperHub
                      </Badge>
                      <span className="text-xs text-zinc-400">Sponsored execution • Private routing • Gas sponsorship</span>
                    </div>
                  ) : null}
                  {executionMode === "direct" && planStatus === "SIGNED" && walletMatches ? (
                    <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                      <Badge variant="outline" className="normal-case border-cyan-400/50 text-cyan-200">
                        Direct
                      </Badge>
                      <span className="text-xs text-zinc-400">Owner-signed • Direct RPC broadcast</span>
                    </div>
                  ) : null}
                  {planStatus === "PLANNED" && canManage ? (
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!planId) return;
                        setActionLoading(true);
                        setError(null);
                        try {
                          const response = await fetch(`/api/execution-plan/${planId}/approve`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ walletAddress: effectiveWalletAddressForApi() }),
                          });
                          const data = await response.json();
                          if (!response.ok) throw new Error(data.error ?? "Approval failed");
                          setPlanStatus(data.status ?? "APPROVED");
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "Approval failed");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Approve Plan
                    </Button>
                  ) : null}
                  {planStatus === "APPROVED" && !signed && canManage ? (
                    <Button variant="secondary" onClick={async () => {
                      setSimulating(true);
                      try {
                        const response = await fetch(`/api/execution-plan/${planId}/simulate`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ walletAddress: effectiveWalletAddressForApi() }),
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          if (data.stale) setPlanStatus("STALE");
                          throw new Error(data.error ?? "Simulation failed");
                        }
                        setSimulation(data);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Simulation failed");
                      } finally {
                        setSimulating(false);
                      }
                    }} disabled={simulating}>
                      {simulating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Simulate
                    </Button>
                  ) : null}
                  {executionMode === "direct" && planStatus === "APPROVED" && simulation && !signed && walletMatches ? (
                    <Button onClick={async () => {
                      if (!planId || !wallet.address) return;
                      setActionLoading(true);
                      try {
                        const stepsSummary = plan.steps
                          .map((s) => `#${s.order} ${s.protocol}/${s.action} ${s.asset ?? s.fromAsset ?? ""}`)
                          .join("; ");
                        const message = `I confirm intent to execute TreasuryOS execution plan.\nPlan ID: ${planId}\nWallet: ${wallet.address}\nReport Hash: ${plan.basedOnReportHash}\nSteps: ${stepsSummary}\nTimestamp: ${new Date().toISOString()}\nThis signature does not execute any transaction.`;
                        const result = await wallet.signMessage(message);
                        if (!result) throw new Error("Wallet signature rejected");
                        const signResponse = await fetch(`/api/execution-plan/${planId}/sign`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ signerAddress: wallet.address, signature: result.signature, signedMessage: message }),
                        });
                        const signData = await signResponse.json();
                        if (!signResponse.ok) throw new Error(signData.error ?? "Signing failed");
                        setPlanStatus("SIGNED");
                        setSigned(true);
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Signing failed");
                      } finally {
                        setActionLoading(false);
                      }
                    }} disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Sign Execution Intent
                    </Button>
                  ) : null}
                  {(executionMode === "direct" ? planStatus === "SIGNED" : planStatus === "APPROVED" && simulation) && canManage ? (
                    <Button onClick={executePlan} disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Execute
                    </Button>
                  ) : null}
                </div>
                {plan.warnings && plan.warnings.length > 0 ? (
                  <div className="space-y-1">
                    {plan.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400">{w}</p>
                    ))}
                  </div>
                ) : null}
                  {executionMode === "direct" && !isConnected ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-300">Connect the treasury owner&apos;s wallet to enable actions.</p>
                  </div>
                  ) : executionMode === "direct" && !walletMatches ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm text-red-300">Connected wallet does not match the treasury being analyzed.</p>
                  </div>
                ) : null}
              </div>
            ) : plan && plan.steps.length === 0 ? (
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-300" />
                    AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-amber-200">No supported action is ready for this treasury.</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    The scan did not produce a deterministic Sepolia Uniswap V3 ETH ↔ USDC swap. Review the current holdings or regenerate after the treasury changes.
                  </p>
                  <Button onClick={loadPlan} className="mt-3" variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-300" />
                    AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400">
                    Build a reviewable, non-custodial plan from the current risk report. Generating a plan does not sign or submit a transaction.
                  </p>
                  <Button onClick={loadPlan} className="mt-4" variant="secondary">
                    <Activity className="h-4 w-4 mr-2" />
                    Generate Plan
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ExecutionTicket({
  plan,
  planStatus,
  simulationPassed,
  slippageBps,
  minReceived,
  executionMode,
}: {
  plan: ExecutionPlan;
  planStatus: PlanStatus;
  simulationPassed: boolean;
  slippageBps: number;
  minReceived: number;
  executionMode: "direct" | "keeperhub";
}) {
  const swapStep = plan.steps.find((s) => s.action === "swap");
  const primaryStep = plan.steps[0];

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-violet-300" />
          Pre-Trade Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">Action</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">
              {primaryStep ? `${actionLabel(primaryStep.action)} ${primaryStep.fromAsset ?? primaryStep.asset ?? ""} → ${primaryStep.toAsset ?? ""}` : "No action"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Input</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">
              {swapStep ? `${swapStep.amountToken ?? `${swapStep.amountUsd?.toFixed(2)} ${swapStep.fromAsset ?? ""}`}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Estimated Output</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300">
              {swapStep ? `~${swapStep.amountUsd ? swapStep.amountUsd.toLocaleString() : "—"} USDC` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Reason</p>
            <p className="mt-1 text-sm text-zinc-300">{primaryStep?.reason ?? "—"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Quote</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-zinc-500">Est. output</p>
              <p className="font-mono text-sm text-emerald-300">~{swapStep?.amountUsd?.toLocaleString() ?? "—"} USDC</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Min. received ({slippageBps / 100}% slippage)</p>
              <p className="font-mono text-sm text-zinc-200">~{minReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Network</p>
              <p className="font-mono text-sm text-amber-300">Sepolia testnet — pricing may not reflect market value</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium uppercase text-zinc-500">Preconditions</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <PreconditionCheck
              label={executionMode === "keeperhub" ? "KeeperHub treasury verified" : "Verified treasury owner"}
              passed={true}
            />
            <PreconditionCheck label="Report fresh" passed={planStatus !== "STALE"} />
            <PreconditionCheck label="Plan approved" passed={["APPROVED", "SIGNED"].includes(planStatus)} />
            <PreconditionCheck label="Simulation passed" passed={simulationPassed} />
            {executionMode === "direct" ? (
              <PreconditionCheck label="Execution intent signed" passed={planStatus === "SIGNED"} />
            ) : (
              <PreconditionCheck label="KeeperHub authorization active" passed={true} />
            )}
          </div>
        </div>

        {plan.warnings && plan.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            {plan.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">{w}</p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PreconditionCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <Lock className="h-4 w-4 text-zinc-600" />
      )}
      <span className={passed ? "text-zinc-300" : "text-zinc-500"}>{label}</span>
    </div>
  );
}

function LockedPanel({ mode, onConnect, isKeeperHubManaged }: { mode: "analyze" | "manage"; onConnect: () => void; isKeeperHubManaged: boolean }) {
  const noWalletCopy =
    mode === "analyze"
      ? "Connect the wallet that owns this treasury to switch from Analyze mode into Manage mode."
      : isKeeperHubManaged
        ? "This treasury is managed by your authenticated KeeperHub organization. Execution is available without a connected wallet."
        : "No wallet is connected. Connect the treasury owner wallet to unlock execution planning.";

  return (
    <Card className="rounded-xl border-amber-500/30 bg-amber-500/10">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-200">Manage mode required</p>
          <p className="mt-1 text-sm text-zinc-400">
            {noWalletCopy}
          </p>
          {!isKeeperHubManaged ? (
            <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MismatchedWalletPanel({ connectedWallet, analyzedAddress }: { connectedWallet: string | null; analyzedAddress: string }) {
  return (
    <Card className="rounded-xl border-red-500/30 bg-red-500/10">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-red-300" />
        <div>
          <p className="font-medium text-red-200">Execution unavailable for this treasury</p>
          <p className="mt-1 text-sm text-zinc-400">
            Connected wallet {shortenAddress(connectedWallet!)} does not own {shortenAddress(analyzedAddress)}.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Execution is not forced — connect the wallet that controls this treasury to proceed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionConfirmation({ result, reportHash }: { result: { txHash: string; explorer: string; status: string }; reportHash?: string }) {
  return (
    <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/10">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-semibold text-emerald-200">Execution Complete</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Transaction</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-300">{shortenHash(result.txHash)}</span>
              <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
                <a href={result.explorer} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Status</span>
            <Badge variant="low" className="normal-case">{result.status}</Badge>
          </div>
          {reportHash ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Report Hash</span>
              <span className="font-mono text-xs text-zinc-300">{shortenHash(reportHash)}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm">
            <a href="/proof-trail">View Proof Trail <ArrowRight className="h-4 w-4" /></a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/proof-attestation">View Attestations</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BeforeAfterPanel({ ethExposureBefore, ethExposureAfter, usdcBalanceBefore, usdcBalanceAfter, deltaUsd, deltaEth, actualOutput, postExecution }: {
  ethExposureBefore: number;
  ethExposureAfter: number;
  usdcBalanceBefore: number;
  usdcBalanceAfter: number;
  deltaUsd: number;
  deltaEth: number;
  actualOutput?: { asset: "USDC"; amount: string } | null;
  postExecution?: {
    totalValueUsd: number;
    ethValueUsd: number;
    usdcValueUsd: number;
    ethAllocation: number;
    usdcAllocation: number;
  } | null;
}) {
  if (postExecution) {
    return (
      <Card className="rounded-xl bg-zinc-900/70">
        <CardHeader>
          <CardTitle className="text-base">Confirmed Onchain Outcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-zinc-400">
            Wallet balances were re-scanned after the transaction was mined.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <OutcomeMetric label="ETH Allocation" value={`${(postExecution.ethAllocation * 100).toFixed(1)}%`} />
            <OutcomeMetric label="USDC Allocation" value={`${(postExecution.usdcAllocation * 100).toFixed(1)}%`} tone="success" />
            <OutcomeMetric
              label="USDC Received"
              value={actualOutput ? `${Number(actualOutput.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${actualOutput.asset}` : "Verified in wallet"}
              tone="success"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader>
        <CardTitle className="text-base">Plan Estimate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs uppercase text-zinc-500">ETH Exposure</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-sm text-zinc-400">{(ethExposureBefore * 100).toFixed(0)}%</span>
              <span className="text-xs text-zinc-600">→</span>
              <span className="font-mono text-sm text-emerald-300">{(ethExposureAfter * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs uppercase text-zinc-500">USDC Balance</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-sm text-zinc-400">${usdcBalanceBefore.toLocaleString()}</span>
              <span className="text-xs text-zinc-600">→</span>
              <span className="font-mono text-sm text-emerald-300">${usdcBalanceAfter.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-4">
            <p className="text-xs uppercase text-zinc-500">Modelled Change</p>
            <p className="mt-2 font-mono text-sm text-emerald-300">
              +${deltaUsd.toLocaleString()} USDC / −{(deltaEth * 100).toFixed(0)} percentage points ETH allocation
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OutcomeMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-4">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className={cn("mt-2 font-mono text-sm", tone === "success" ? "text-emerald-300" : "text-zinc-200")}>
        {value}
      </p>
    </div>
  );
}

function ProofOfExecution({
  txHash,
  explorer,
  reportHash,
  attestationHash,
  executionMode,
  keeperhub,
}: {
  txHash: string;
  explorer: string;
  reportHash?: string;
  attestationHash?: string;
  executionMode?: string;
  keeperhub?: {
    executionId: string;
    transactionHash: string;
    explorerUrl: string;
    chainId: number;
    gasUsed: string;
    sponsored: boolean;
    finalStatus: string;
    executedAt: string;
  } | null;
}) {
  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader>
        <CardTitle className="text-base">Proof of Execution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-zinc-500">Transaction</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-300">{shortenHash(txHash)}</span>
            <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
              <a href={explorer} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        {executionMode === "keeperhub" && keeperhub ? (
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="normal-case border-violet-400/50 text-violet-200">
                KeeperHub
              </Badge>
              <Badge variant={keeperhub.sponsored ? "low" : "medium"} className="normal-case">
                {keeperhub.sponsored ? "Sponsored" : "Self-funded"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-zinc-500">Execution ID</span>
              <span className="font-mono text-xs text-zinc-300">{shortenHash(keeperhub.executionId)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-zinc-500">Chain ID</span>
              <span className="font-mono text-xs text-zinc-300">{keeperhub.chainId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-zinc-500">Gas Used</span>
              <span className="font-mono text-xs text-zinc-300">{Number(keeperhub.gasUsed).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-zinc-500">Final Status</span>
              <Badge variant="low" className="normal-case">{keeperhub.finalStatus}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-zinc-500">Executed At</span>
              <span className="font-mono text-xs text-zinc-300">{new Date(keeperhub.executedAt).toLocaleString()}</span>
            </div>
          </div>
        ) : null}
        {reportHash ? (
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-zinc-500">Report Hash</span>
            <span className="font-mono text-xs text-zinc-300">{shortenHash(reportHash)}</span>
          </div>
        ) : null}
        {attestationHash ? (
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-zinc-500">Attestation</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-300">{shortenHash(attestationHash)}</span>
            </div>
          </div>
        ) : null}
        <Button asChild variant="secondary" size="sm">
          <a href="/proof-trail">View full Proof Trail <ArrowRight className="h-4 w-4" /></a>
        </Button>
      </CardContent>
    </Card>
  );
}

function actionLabel(action: PlanStep["action"]): string {
  switch (action) {
    case "swap": return "Swap";
    case "repay": return "Repay";
    case "supply": return "Supply";
    case "withdraw": return "Withdraw";
    case "collect-fees": return "Collect Fees";
    case "rebalance": return "Rebalance";
    default: return action;
  }
}

function planActionLabel(plan: ExecutionPlan): string {
  const primaryStep = plan.steps[0];
  if (!primaryStep) return "Executed plan";

  const fromAsset = primaryStep.fromAsset ?? primaryStep.asset;
  return primaryStep.toAsset && fromAsset
    ? `${actionLabel(primaryStep.action)} ${fromAsset} → ${primaryStep.toAsset}`
    : `${actionLabel(primaryStep.action)} plan`;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ExecutionHistory({
  history,
}: {
  history: Array<{
    date: string;
    action: string;
    txHash: string;
    explorer: string;
    status: string;
  }>;
}) {
  if (history.length === 0) {
    return (
      <Card className="rounded-xl border-dashed border-zinc-700">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No execution history yet. Execute a plan to see it here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Tx Hash</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {history.map((entry) => (
                <tr key={entry.txHash} className="bg-zinc-950/40">
                  <td className="px-4 py-3 text-zinc-300">{entry.date}</td>
                  <td className="px-4 py-3 text-zinc-200">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300">{shortenHash(entry.txHash)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="low" className="normal-case">{entry.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="sm">
                      <a href={`/proof-trail?tx=${entry.txHash}`}>View Trail <ArrowRight className="h-4 w-4" /></a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StagedLoading({ steps }: { steps: string[] }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (steps.length === 0) return;
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      if (index >= steps.length) {
        clearInterval(interval);
      } else {
        setCurrentStep(index);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [steps]);

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {steps[currentStep] ?? "Preparing..."}
        </div>
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <div
              key={step}
              className={cn("h-1 flex-1 rounded-full", i <= currentStep ? "bg-cyan-400" : "bg-zinc-800")}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="rounded-xl border-red-500/30 bg-red-500/10">
      <CardContent className="p-6">
        <p className="text-sm text-red-400">{error}</p>
        <p className="mt-2 text-xs text-zinc-500">
          If funds were moved, check your wallet and the transaction on Etherscan. If not, review the error and retry.
        </p>
        <Button onClick={onRetry} className="mt-3" variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
