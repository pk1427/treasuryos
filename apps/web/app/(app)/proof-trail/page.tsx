"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ExternalLink,
  FileJson,
  Lock,
  Loader2,
  RadioTower,
  ArrowRight,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shortenHash } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import { WorkflowStepper } from "@/components/ui/treasury-primitives";

type StepState = "pending" | "running" | "done" | "error";
type IndexedAttestation = {
  id: string;
  network: string;
  treasury: string;
  reportHash: string;
  txHash: string;
  timestamp: string;
};

function ProofTrailContent() {
  const searchParams = useSearchParams();
  const wallet = useWallet();
  const session = useTreasurySession();
  const { mode, connectedWallet, isOwnerVerified, isKeeperHubManaged, reportResponse } = session;

  const txParam = searchParams.get("tx") ?? "";
  const reportParam = searchParams.get("report") ?? "";

  const simulation = session.keeperHubSimulation;
  const attestation = session.attestation;
  const simulateState = session.simulateState as StepState;
  const publishState = session.publishState as StepState;
  const reportHash = reportParam || reportResponse?.reportHash;
  const attestationTxHash = txParam || attestation?.transactionHash;
  const attestationLink = txParam
    ? `https://sepolia.etherscan.io/tx/${txParam}`
    : attestation?.transactionLink;

  const locked = mode === "analyze" || (!isKeeperHubManaged && (!connectedWallet || !isOwnerVerified));

  const [historicalAttestation, setHistoricalAttestation] = useState<IndexedAttestation | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  const hasCompletedAttestation = Boolean(attestationTxHash);
  const effectiveAttestationTxHash = attestationTxHash || historicalAttestation?.txHash;
  const effectiveAttestationLink = attestationLink || (historicalAttestation ? `https://sepolia.etherscan.io/tx/${historicalAttestation.txHash}` : undefined);
  const isViewingHistoricalProof = Boolean(effectiveAttestationTxHash) && !session.attestation;

  useEffect(() => {
    if (hasCompletedAttestation || !reportHash || !session.analyzedAddress) return;
    // Data-fetching effect: load the latest attestation for this treasury from the API.
    /* eslint-disable react-hooks/set-state-in-effect -- standard data-fetching pattern */
    setHistoricalLoading(true);
    setHistoricalAttestation(null);

    fetch(`/api/attestations?treasury=${session.analyzedAddress}&limit=1`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load attestations")))
      .then((data: { items: IndexedAttestation[] }) => {
        const matching = data.items.find((item) => item.reportHash === reportHash);
        if (matching) {
          setHistoricalAttestation(matching);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setHistoricalLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [hasCompletedAttestation, reportHash, session.analyzedAddress]);

  const executionDone = Boolean(session.executionResult?.txHash) || Boolean(effectiveAttestationTxHash);
  const executionState: StepState = executionDone
    ? "done"
    : session.executionResult?.status === "failed"
      ? "error"
      : "pending";

  const steps = [
    {
      label: "Report",
      done: Boolean(reportHash),
      state: reportHash ? "done" : "pending" as StepState,
    },
    {
      label: "Simulate",
      done: simulateState === "done" || executionDone,
      state: simulateState === "done"
        ? "done"
        : executionDone
          ? "done"
          : simulateState,
    },
    {
      label: "Execute",
      done: executionDone,
      state: executionState,
    },
    {
      label: "Publish",
      done: publishState === "done" || Boolean(effectiveAttestationTxHash),
      state: publishState === "done"
        ? "done"
        : Boolean(effectiveAttestationTxHash)
          ? "done"
          : publishState,
    },
    {
      label: "Attest",
      done: Boolean(effectiveAttestationTxHash),
      state: Boolean(effectiveAttestationTxHash)
        ? "done"
        : publishState === "done" || publishState === "running"
          ? "running"
          : "pending" as StepState,
    },
    {
      label: "Proof",
      done: Boolean(effectiveAttestationTxHash),
      state: Boolean(effectiveAttestationTxHash) ? "done" : "pending" as StepState,
    },
  ];

  const overallProgress = steps.filter((s) => s.done).length / steps.length;
  const completedSteps = steps.filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              TreasuryOS — Proof Trail
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Proof Trail
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {isViewingHistoricalProof
                ? "Verified proof trail for a completed attestation."
                : "Full chain from report hash through attestation to on-chain proof."}
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {locked ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} isKeeperHubManaged={isKeeperHubManaged} />
        ) : !reportHash && !effectiveAttestationTxHash ? (
          <Card className="rounded-xl border-dashed border-zinc-700">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-xl border border-white/10 bg-zinc-950 p-3">
                <FileJson className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-base font-medium text-zinc-200">No proof data available</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Generate a report and publish an attestation to populate the proof trail.
              </p>
              <Button asChild className="mt-4" variant="secondary">
                <a href="/dashboard">Scan Treasury</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Verification pipeline
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {completedSteps === steps.length
                      ? isViewingHistoricalProof
                        ? "This attestation is fully verified onchain."
                        : "All stages complete. Proof trail is fully verified."
                      : `${steps.length - completedSteps} stage${steps.length - completedSteps !== 1 ? "s" : ""} remaining.`}
                  </p>
                </div>
                <Badge variant="outline" className="normal-case">
                  {completedSteps}/{steps.length} complete
                </Badge>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(overallProgress * 100, 4)}%` }}
                />
              </div>
              <WorkflowStepper
                steps={steps.map((s) => s.label)}
                activeStep={steps.find((s) => !s.done)?.label}
                completedThrough={steps.reduce((last, step, index) => step.done ? index : last, -1)}
              />
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Report"
                value={reportHash ? "Generated" : "Pending"}
                detail={reportHash ? "Hash verified" : "Awaiting scan"}
                tone={reportHash ? "success" : "neutral"}
              />
              <MetricCard
                label="Simulation"
                value={simulateState === "done" || executionDone ? "Passed" : simulateState === "error" ? "Failed" : "Pending"}
                detail={simulateState === "done" || executionDone ? "Wallet context OK" : "Waiting"}
                tone={simulateState === "done" || executionDone ? "success" : simulateState === "error" ? "danger" : "neutral"}
              />
              <MetricCard
                label="Execution"
                value={session.executionResult?.txHash ? (session.executionResult.status === "failed" ? "Failed" : "Confirmed") : "Pending"}
                detail={session.executionResult?.executionMode === "keeperhub" ? "KeeperHub" : session.executionResult?.txHash ? "Direct" : "Awaiting execution"}
                tone={session.executionResult?.txHash ? (session.executionResult.status === "failed" ? "danger" : "success") : "neutral"}
              />
              <MetricCard
                label="Publish"
                value={publishState === "done" || Boolean(effectiveAttestationTxHash) ? "Published" : publishState === "error" ? "Failed" : "Pending"}
                detail={publishState === "done" || Boolean(effectiveAttestationTxHash) ? "KeeperHub confirmed" : "Waiting"}
                tone={publishState === "done" || Boolean(effectiveAttestationTxHash) ? "success" : publishState === "error" ? "danger" : "neutral"}
              />
              <MetricCard
                label="Attestation"
                value={effectiveAttestationTxHash ? "Confirmed" : "Pending"}
                detail={effectiveAttestationTxHash ? "Onchain verified" : "Waiting"}
                tone={effectiveAttestationTxHash ? "success" : "neutral"}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileJson className="h-5 w-5 text-cyan-300" />
                    Report Hash
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-300">
                      {reportHash ? shortenHash(reportHash) : "Waiting for data"}
                    </p>
                    {reportHash ? (
                      <Button asChild variant="ghost" size="icon" aria-label="Open report hash">
                        <a href={`/proof-attestation`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RadioTower className="h-5 w-5 text-violet-300" />
                    Attestation Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-300">
                      {effectiveAttestationTxHash ? shortenHash(effectiveAttestationTxHash) : "Waiting for attestation"}
                    </p>
                    {effectiveAttestationTxHash && effectiveAttestationLink ? (
                      <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
                        <a href={effectiveAttestationLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-cyan-300" />
                    KeeperHub Simulation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300">
                        {Boolean(effectiveAttestationTxHash)
                          ? "Simulation completed prior to attestation."
                          : historicalLoading
                            ? "Loading attestation history..."
                            : simulation?.message ?? simulation?.status ?? "Waiting for simulation data..."}
                      </p>
                    </div>
                    {(simulateState === "done" || Boolean(effectiveAttestationTxHash)) && (
                      <Badge variant="low" className="normal-case">Passed</Badge>
                    )}
                    {simulateState === "error" && (
                      <Badge variant="critical" className="normal-case">Failed</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-5 w-5 text-emerald-300" />
                    Execution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300">
                        {session.executionResult?.txHash
                          ? `Transaction ${shortenHash(session.executionResult.txHash)} ${session.executionResult.executionMode === "keeperhub" ? "executed via KeeperHub" : "executed directly"}.`
                          : "No execution recorded for this session."}
                      </p>
                      {session.executionResult?.keeperhub ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-zinc-400">Execution ID: {shortenHash(session.executionResult.keeperhub.executionId)}</p>
                          <p className="text-xs text-zinc-400">Chain ID: {session.executionResult.keeperhub.chainId}</p>
                          <p className="text-xs text-zinc-400">Gas Used: {Number(session.executionResult.keeperhub.gasUsed).toLocaleString()}</p>
                          <p className="text-xs text-zinc-400">Sponsored: {session.executionResult.keeperhub.sponsored ? "Yes" : "No"}</p>
                        </div>
                      ) : null}
                    </div>
                    {session.executionResult?.txHash && (
                      <Badge variant={session.executionResult.status === "failed" ? "critical" : "low"} className="normal-case">
                        {session.executionResult.status}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RadioTower className="h-5 w-5 text-violet-300" />
                    KeeperHub Publish
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300">
                        {Boolean(effectiveAttestationTxHash)
                          ? "Attestation published and confirmed onchain."
                          : historicalLoading
                            ? "Loading attestation history..."
                            : attestationTxHash
                              ? "Attestation published"
                              : attestation?.status ?? "Waiting for attestation..."}
                      </p>
                    </div>
                    {(publishState === "done" || Boolean(effectiveAttestationTxHash)) && (
                      <Badge variant="low" className="normal-case">Published</Badge>
                    )}
                    {publishState === "error" && (
                      <Badge variant="critical" className="normal-case">Failed</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-xl border-white/10 bg-zinc-950/50">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Explorer Links
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      View the attestation and proof records on Sepolia.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {effectiveAttestationTxHash ? (
                      <Button asChild variant="secondary" size="sm">
                        <a href={effectiveAttestationLink ?? `https://sepolia.etherscan.io/tx/${effectiveAttestationTxHash}`} target="_blank" rel="noreferrer">
                          Attestation on Etherscan
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                    {reportHash && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/proof-attestation`}>View Attestation History</a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProofTrailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>}>
      <ProofTrailContent />
    </Suspense>
  );
}

function LockedPanel({ mode, onConnect, isKeeperHubManaged }: { mode: "analyze" | "manage"; onConnect: () => void; isKeeperHubManaged: boolean }) {
  const copy =
    mode === "analyze"
      ? "The proof trail is visible as a locked workflow in Analyze mode. Switch to Manage with the owner wallet to publish or verify private execution proofs."
      : isKeeperHubManaged
        ? "This treasury is managed by your authenticated KeeperHub organization. Execution and proof workflows are available without a connected wallet."
        : "Connect the wallet that owns this treasury to view the proof trail.";

  return (
    <Card className="rounded-xl border-amber-500/30 bg-amber-500/10">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-200">Manage mode required</p>
          <p className="mt-1 text-sm text-zinc-400">
            {copy}
          </p>
          {!isKeeperHubManaged ? (
            <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
              <ShieldCheck className="h-4 w-4" />
              Connect Wallet
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    neutral: "border-white/10 bg-white/[0.04] text-zinc-300",
    info: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    danger: "border-red-400/25 bg-red-400/10 text-red-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-zinc-400">{detail}</p> : null}
    </div>
  );
}
