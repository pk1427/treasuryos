"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ExternalLink,
  FileJson,
  Lock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, shortenHash } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";

function ProofTrailContent() {
  const searchParams = useSearchParams();
  const wallet = useWallet();
  const session = useTreasurySession();
  const { mode, connectedWallet, isOwnerVerified, reportResponse } = session;

  const txParam = searchParams.get("tx") ?? "";
  const reportParam = searchParams.get("report") ?? "";

  const simulation = session.keeperHubSimulation;
  const attestation = session.attestation;
  const simulateState = session.simulateState;
  const publishState = session.publishState;
  const reportHash = reportParam || reportResponse?.reportHash;
  const attestationTxHash = txParam || attestation?.transactionHash;
  const attestationLink = txParam
    ? `https://sepolia.etherscan.io/tx/${txParam}`
    : attestation?.transactionLink;

  const locked = mode === "analyze" || !connectedWallet || !isOwnerVerified;

  const steps = [
    { label: "Report", done: Boolean(reportHash) },
    { label: "Simulate", done: simulateState === "done" },
    { label: "Publish", done: publishState === "done" },
    { label: "Attest", done: Boolean(attestationTxHash) },
    { label: "Proof", done: Boolean(attestationTxHash) },
  ];

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
              Full chain from report hash through attestation to on-chain proof.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {locked ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} />
        ) : (
          <div className="space-y-6">
            <ProofStrip steps={steps} />

            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <HashPanel label="Report Hash" value={reportHash} />
              <HashPanel label="Attestation Transaction" value={attestationTxHash} link={attestationLink} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ProofStepCard title="KeeperHub Simulation" body={simulation?.message ?? simulation?.status} state={simulateState} />
              <ProofStepCard title="KeeperHub Publish" body={attestationTxHash ?? attestation?.status} state={attestationTxHash ? "done" : publishState} />
            </div>

            {reportHash ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                <p className="text-xs uppercase text-zinc-500 mb-2">Explorer Links</p>
                <div className="flex flex-wrap gap-3">
                  {attestationTxHash ? (
                    <Button asChild variant="secondary" size="sm">
                      <a href={attestationLink ?? `https://sepolia.etherscan.io/tx/${attestationTxHash}`} target="_blank" rel="noreferrer">
                        Attestation on Etherscan →
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!reportHash && !attestationTxHash ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                <FileJson className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">
                  No proof data available for this session. Generate a report and publish an attestation to populate the proof trail.
                </p>
              </div>
            ) : null}
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

function LockedPanel({ mode, onConnect }: { mode: "analyze" | "manage"; onConnect: () => void }) {
  const copy =
    mode === "analyze"
      ? "The proof trail is visible as a locked workflow in Analyze mode. Switch to Manage with the owner wallet to publish or verify private execution proofs."
      : "Connect the wallet that owns this treasury to view the proof trail.";

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-200">Manage mode required</p>
          <p className="mt-1 text-sm text-zinc-400">
            {copy}
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
            <ShieldCheck className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProofStrip({ steps }: { steps: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((step) => (
        <div
          key={step.label}
          className={cn(
            "rounded-lg border px-3 py-2 text-center text-xs font-medium",
            step.done
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-white/10 bg-white/[0.03] text-zinc-500"
          )}
        >
          {step.label} {step.done ? "✓" : ""}
        </div>
      ))}
    </div>
  );
}

function HashPanel({ label, value, link }: { label: string; value?: string; link?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">{label}</p>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-300">
          {value ? shortenHash(value) : "Waiting"}
        </p>
        {value ? (
          <Button asChild variant="ghost" size="icon" aria-label={`Open ${label}`}>
            <a href={link ?? `https://sepolia.etherscan.io/tx/${value}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProofStepCard({ title, body, state }: { title: string; body?: string; state: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <Badge variant={state === "done" ? "low" : state === "error" ? "critical" : "default"}>
          {state}
        </Badge>
      </div>
      <p className="mt-2 break-all text-xs text-zinc-500">{body ?? "Waiting"}</p>
    </div>
  );
}
