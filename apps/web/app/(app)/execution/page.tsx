"use client";

import { useEffect, useState } from "react";
import {
  Activity,
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
import { shortenHash } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";

type PlanStatus = "PLANNED" | "NOT_ACTIONABLE" | "APPROVED" | "SIGNED" | "REJECTED" | "STALE";

export default function ExecutionPage() {
  const wallet = useWallet();
  const session = useTreasurySession();
  const {
    mode,
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

  const locked =
    mode === "analyze" || !connectedWallet || !ownerVerified;
  const mismatch =
    Boolean(connectedWallet && report?.address) &&
    connectedWallet!.toLowerCase() !== report!.address.toLowerCase();

  const isConnected = !!wallet.address;
  const walletMatches = isConnected && wallet.address && report?.address
    ? wallet.address.toLowerCase() === report.address.toLowerCase()
    : false;

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
          action: "Swap",
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
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {locked && !mismatch ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} />
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
            <div className="flex gap-2 border-b border-white/10 pb-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "live" ? "bg-cyan-400/10 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}
                onClick={() => setActiveTab("live")}
              >
                Live Plan
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "history" ? "bg-cyan-400/10 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}
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
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="low" className="normal-case">
                    Ownership verified ✓
                  </Badge>
                  <Badge variant="outline" className="normal-case">
                    Wallet {shortenAddress(wallet.address ?? "")}
                  </Badge>
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
                  <div className="space-y-1">
                    {plan.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400">{w}</p>
                    ))}
                  </div>
                ) : null}
                {!isConnected ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-300">Connect the treasury owner&apos;s wallet to enable actions.</p>
                  </div>
                ) : !walletMatches ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm text-red-300">Connected wallet does not match the treasury being analyzed.</p>
                  </div>
                ) : null}
              </div>
            ) : plan && plan.steps.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-300" />
                    AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-300">No executable actions.</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    TreasuryOS determined that no deterministic onchain action is available for this plan.
                  </p>
                  <Button onClick={loadPlan} className="mt-3" variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-violet-300" />
                    AI Action Planner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400">
                    Generate a deterministic execution plan based on your treasury risk analysis.
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-violet-300" />
          Pre-Trade Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Quote</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
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
          <p className="mb-2 text-xs font-medium uppercase text-zinc-500">Preconditions</p>
          <div className="space-y-1">
            <PreconditionCheck label="Wallet owner verified" passed={true} />
            <PreconditionCheck label="Report fresh" passed={planStatus !== "STALE"} />
            <PreconditionCheck label="Plan approved" passed={["APPROVED", "SIGNED"].includes(planStatus)} />
            <PreconditionCheck label="Simulation passed" passed={simulationPassed} />
            <PreconditionCheck label="Plan signed" passed={planStatus === "SIGNED"} />
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

function LockedPanel({ mode, onConnect }: { mode: "analyze" | "manage"; onConnect: () => void }) {
  const noWalletCopy =
    mode === "analyze"
      ? "Connect the wallet that owns this treasury to switch from Analyze mode into Manage mode."
      : "No wallet is connected. Connect the treasury owner wallet to unlock execution planning.";

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-200">Manage mode required</p>
          <p className="mt-1 text-sm text-zinc-400">
            {noWalletCopy}
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}

function MismatchedWalletPanel({ connectedWallet, analyzedAddress }: { connectedWallet: string | null; analyzedAddress: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
      <div className="flex items-start gap-3">
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
      </div>
    </div>
  );
}

function ExecutionConfirmation({ result, reportHash }: { result: { txHash: string; explorer: string; status: string }; reportHash?: string }) {
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
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
    </section>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Before / After</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase text-zinc-500">ETH Exposure</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-sm text-zinc-400">{(ethExposureBefore * 100).toFixed(0)}%</span>
              <span className="text-xs text-zinc-600">→</span>
              <span className="font-mono text-sm text-emerald-300">{(ethExposureAfter * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase text-zinc-500">USDC Balance</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-sm text-zinc-400">${usdcBalanceBefore.toLocaleString()}</span>
              <span className="text-xs text-zinc-600">→</span>
              <span className="font-mono text-sm text-emerald-300">${usdcBalanceAfter.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase text-zinc-500">Delta</p>
            <p className="mt-1 font-mono text-sm text-emerald-300">
              +${deltaUsd.toLocaleString()} USDC / −{deltaEth.toFixed(4)} ETH
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProofOfExecution({ txHash, explorer, reportHash, attestationHash }: {
  txHash: string;
  explorer: string;
  reportHash?: string;
  attestationHash?: string;
}) {
  return (
    <Card>
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
          <a href="/proof-trail">View full Proof Trail →</a>
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
      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
        <Activity className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No execution history yet. Execute a plan to see it here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Tx Hash</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Proof</th>
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
                  <a href={`/proof-trail?tx=${entry.txHash}`}>View Trail →</a>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {steps[currentStep] ?? "Preparing..."}
        </div>
        <div className="flex gap-2">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full ${i <= currentStep ? "bg-cyan-400" : "bg-zinc-800"}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card>
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
