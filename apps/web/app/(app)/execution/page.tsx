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
    analyzedAddress: address,
    reportResponse,
    connectedWallet,
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
  const [executionResult, setExecutionResult] = useState<{
    txHash: string;
    explorer: string;
    status: string;
  } | null>(null);
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
      .then(({ history }) => setExecutionHistory(history.map((entry: { createdAt: string; txHash: string; status: string }) => ({ date: new Date(entry.createdAt).toLocaleString(), action: "Swap ETH → USDC", txHash: entry.txHash, explorer: `https://sepolia.etherscan.io/tx/${entry.txHash}`, status: entry.status }))))
      .catch(() => undefined);
  }, [wallet.address, executionResult]);

  const locked = !connectedWallet || !ownerVerified;
  const mismatch =
    Boolean(connectedWallet && report?.address) &&
    connectedWallet!.toLowerCase() !== report!.address.toLowerCase();

  const isConnected = !!wallet.address;
  const walletMatches = isConnected && wallet.address && report?.address
    ? wallet.address.toLowerCase() === report.address.toLowerCase()
    : false;

  async function loadPlan() {
    if (!report?.address) return;
    if (loading) return;
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
    if (!planId || !wallet.address) return;
    setActionLoading(true);
    setError(null);

    try {
      const prepared = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "prepare", planId, walletAddress: wallet.address }),
      }).then((r) => r.json());

      if (!prepared.success) throw new Error("Execution preparation failed");

      const txHash = await wallet.sendTransaction(prepared.transaction);
      if (!txHash) throw new Error("Wallet did not return a transaction hash");

      const completed = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "complete", planId, walletAddress: wallet.address, txHash }),
      }).then((r) => r.json()) as { txHash: string; explorer: string; status: string };

      setExecutionResult({
        txHash: completed.txHash,
        explorer: completed.explorer,
        status: completed.status,
      });
      setExecutionHistory((history) => [
        {
          date: new Date().toISOString(),
          action: "Swap ETH → USDC",
          txHash: completed.txHash,
          explorer: completed.explorer,
          status: completed.status,
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
  const usdcBalanceBefore = 30;
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
    <div className="min-h-screen bg-transparent">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground font-display">Execution</h1>
        {locked && !mismatch ? (
          <LockedPanel onConnect={wallet.connect} />
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
            />
            <ProofOfExecution
              txHash={executionResult.txHash}
              explorer={executionResult.explorer}
              reportHash={reportHash}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-border pb-2">
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  activeTab === "live"
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:text-foreground"
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
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:text-foreground"
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
                <section className="rounded-xl border border-accent/20 privacy-card p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Owner-controlled execution</p>
                  <WorkflowStepper steps={["Generate", "Approve", "Simulate", "Sign", "Execute"]} activeStep={planStatus === "SIGNED" ? "Execute" : planStatus === "APPROVED" ? simulation ? "Sign" : "Simulate" : "Approve"} completedThrough={planStatus === "SIGNED" ? 3 : planStatus === "APPROVED" ? simulation ? 2 : 1 : 0} />
                  <p className="mt-4 text-sm text-muted-foreground">Each step creates a reviewable checkpoint. Only <strong>Execute</strong> opens a transaction prompt in your wallet.</p>
                </section>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="success">Ownership verified</StatusPill>
                  <StatusPill tone="neutral">Wallet {shortenAddress(wallet.address ?? "")}</StatusPill>
                </div>
                <ExecutionTicket
                  plan={plan}
                  planStatus={planStatus ?? "PLANNED"}
                  simulationPassed={Boolean((simulation as { overallSuccess?: boolean } | null)?.overallSuccess)}
                  slippageBps={slippageBps}
                  minReceived={minReceived}
                />
                <div className="flex flex-wrap gap-3">
                  {planStatus === "PLANNED" && walletMatches ? (
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
                            body: JSON.stringify({ walletAddress: wallet.address }),
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
                  {planStatus === "APPROVED" && !signed ? (
                    <Button variant="secondary" onClick={async () => {
                      setSimulating(true);
                      try {
                        const response = await fetch(`/api/execution-plan/${planId}/simulate`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ walletAddress: wallet.address }),
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
                  {planStatus === "APPROVED" && simulation && !signed && walletMatches ? (
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
                  {planStatus === "SIGNED" && walletMatches ? (
                    <Button onClick={executePlan} disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Execute
                    </Button>
                  ) : null}
                </div>
                {plan.warnings && plan.warnings.length > 0 ? (
                  <div className="space-y-1 rounded-lg border border-border privacy-card p-3">
                    {plan.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{w}</p>
                    ))}
                  </div>
                ) : null}
                {!isConnected ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm text-primary">Connect the treasury owner&apos;s wallet to enable actions.</p>
                  </div>
                ) : !walletMatches ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm text-red-300">Connected wallet does not match the treasury being analyzed.</p>
                  </div>
                ) : null}
              </div>
            ) : plan && plan.steps.length === 0 ? (
    <Card className="rounded-xl privacy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs font-medium text-muted-foreground">No supported action is ready for this treasury.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The scan did not produce a deterministic Sepolia Uniswap V3 ETH ↔ USDC swap. Review the current holdings or regenerate after the treasury changes.
                  </p>
                  <Button onClick={loadPlan} className="mt-3" variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
    <Card className="rounded-xl privacy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
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
}: {
  plan: ExecutionPlan;
  planStatus: PlanStatus;
  simulationPassed: boolean;
  slippageBps: number;
  minReceived: number;
}) {
  const swapStep = plan.steps.find((s) => s.action === "swap");
  const primaryStep = plan.steps[0];

  return (
    <Card className="rounded-xl privacy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Pre-Trade Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Action</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {primaryStep ? `${actionLabel(primaryStep.action)} ${primaryStep.fromAsset ?? primaryStep.asset ?? ""} → ${primaryStep.toAsset ?? ""}` : "No action"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Input</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {swapStep ? `${swapStep.amountToken ?? `${swapStep.amountUsd?.toFixed(2)} ${swapStep.fromAsset ?? ""}`}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Estimated Output</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {swapStep ? `~${swapStep.amountUsd ? swapStep.amountUsd.toLocaleString() : "—"} USDC` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm text-secondary">{primaryStep?.reason ?? "—"}</p>
          </div>
        </div>

        <div className="border-y border-border py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quote</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Est. output</p>
              <p className="font-mono text-sm text-primary">~{swapStep?.amountUsd?.toLocaleString() ?? "—"} USDC</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Min. received ({slippageBps / 100}% slippage)</p>
              <p className="font-mono text-sm text-foreground">~{minReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Network</p>
              <p className="font-mono text-sm text-muted-foreground">Sepolia testnet</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">Preconditions</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <PreconditionCheck label="Wallet owner verified" passed={true} />
            <PreconditionCheck label="Report fresh" passed={planStatus !== "STALE"} />
            <PreconditionCheck label="Plan approved" passed={["APPROVED", "SIGNED"].includes(planStatus)} />
            <PreconditionCheck label="Simulation passed" passed={simulationPassed} />
            <PreconditionCheck label="Plan signed" passed={planStatus === "SIGNED"} />
          </div>
        </div>

        {plan.warnings && plan.warnings.length > 0 ? (
          <div className="rounded-lg border border-border privacy-card p-3">
            {plan.warnings.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground">{w}</p>
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
        <Lock className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={passed ? "text-secondary" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function LockedPanel({ onConnect }: { onConnect: () => void }) {
  return (
    <Card className="rounded-xl border-accent/20 privacy-card">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium text-foreground">Connect the treasury owner to execute</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the wallet that owns the selected treasury to unlock execution planning.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
            Connect Wallet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MismatchedWalletPanel({ connectedWallet, analyzedAddress }: { connectedWallet: string | null; analyzedAddress: string }) {
  return (
    <Card className="rounded-xl border-accent/20 privacy-card">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="font-medium text-foreground">This wallet cannot execute for the selected treasury</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connected wallet {shortenAddress(connectedWallet!)} does not own {shortenAddress(analyzedAddress)}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
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
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Execution Complete</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Transaction</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-secondary">{shortenHash(result.txHash)}</span>
              <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
                <a href={result.explorer} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant="low" className="normal-case">{result.status}</Badge>
          </div>
          {reportHash ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Report Hash</span>
              <span className="font-mono text-xs text-secondary">{shortenHash(reportHash)}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="sm">
            <a href="/stream">View treasury activity <ArrowRight className="h-4 w-4" /></a>
          </Button>
          <Button asChild variant="outline" size="sm">
          <a href="/verification">View public proofs</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BeforeAfterPanel({ ethExposureBefore, ethExposureAfter, usdcBalanceBefore, usdcBalanceAfter, deltaUsd, deltaEth }: {
  ethExposureBefore: number;
  ethExposureAfter: number;
  usdcBalanceBefore: number;
  usdcBalanceAfter: number;
  deltaUsd: number;
  deltaEth: number;
}) {
  return (
    <Card className="rounded-xl privacy-card">
      <CardHeader>
        <CardTitle className="text-base">Before / After</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border privacy-card p-4">
            <p className="text-xs uppercase text-muted-foreground">ETH Exposure</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-sm text-secondary">{(ethExposureBefore * 100).toFixed(0)}%</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="font-mono text-sm text-primary">{(ethExposureAfter * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="rounded-lg border border-border privacy-card p-4">
            <p className="text-xs uppercase text-muted-foreground">USDC Balance</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-sm text-secondary">${usdcBalanceBefore.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="font-mono text-sm text-primary">${usdcBalanceAfter.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border privacy-card p-4">
            <p className="text-xs uppercase text-muted-foreground">Delta</p>
            <p className="mt-2 font-mono text-sm text-primary">
              +${deltaUsd.toLocaleString()} USDC / −{deltaEth.toFixed(4)} ETH
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProofOfExecution({ txHash, explorer, reportHash }: {
  txHash: string;
  explorer: string;
  reportHash?: string;
}) {
  return (
    <Card className="rounded-xl privacy-card">
      <CardHeader>
        <CardTitle className="text-base">Proof of Execution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">Transaction</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-secondary">{shortenHash(txHash)}</span>
            <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
              <a href={explorer} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        {reportHash ? (
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground">Report Hash</span>
            <span className="font-mono text-xs text-secondary">{shortenHash(reportHash)}</span>
          </div>
        ) : null}
        <Button asChild variant="secondary" size="sm">
          <a href="/verification">View public proofs <ArrowRight className="h-4 w-4" /></a>
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
      <Card className="rounded-xl border-dashed privacy-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No execution history yet. Execute a plan to see it here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl privacy-card">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Tx Hash</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Public record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((entry) => (
                <tr key={entry.txHash} className="bg-secondary/20">
                  <td className="px-4 py-3 text-secondary">{entry.date}</td>
                  <td className="px-4 py-3 text-foreground">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-secondary">{shortenHash(entry.txHash)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="low" className="normal-case">{entry.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild variant="ghost" size="sm">
                      <a href="/verification">View Proofs <ArrowRight className="h-4 w-4" /></a>
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
    <Card className="rounded-xl privacy-card">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {steps[currentStep] ?? "Preparing..."}
        </div>
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <div
              key={step}
              className={cn("h-1 flex-1 rounded-full", i <= currentStep ? "bg-primary" : "bg-muted")}
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
        <p className="mt-2 text-xs text-muted-foreground">
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
