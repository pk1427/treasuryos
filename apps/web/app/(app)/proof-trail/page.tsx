"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, ExternalLink, FileCheck2, Loader2, RadioTower, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shortenHash } from "@/lib/utils";
import { useTreasurySession } from "@/components/treasury/session-context";

type ProofRecord = {
  id: string;
  wallet: string;
  txHash: string;
  chain: string;
  protocol: string;
  status: string;
  reportHash: string | null;
  executionMode: string | null;
  executionId: string | null;
  gasUsed: string | null;
  simulationResult: Record<string, unknown> | null;
  keeperhubAudit: Record<string, unknown> | null;
  attestationTxHash: string | null;
  executionProofHash: string | null;
  createdAt: string;
};

function ProofTrailContent() {
  const searchParams = useSearchParams();
  const { reportResponse, analyzedAddress } = useTreasurySession();
  const wallet = reportResponse?.report.address ?? analyzedAddress;
  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [selected, setSelected] = useState<ProofRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const executionId = searchParams.get("execution");
  const txHash = searchParams.get("tx");

  useEffect(() => {
    if (!wallet) return;

    const query = new URLSearchParams({ wallet });
    if (executionId) query.set("execution", executionId);
    if (txHash) query.set("tx", txHash);

    void Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
      return fetch(`/api/proofs?${query.toString()}`);
    })
      .then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.error ?? "Failed to load proofs"))))
      .then((data: { proofs: ProofRecord[]; selected: ProofRecord | null }) => {
        setProofs(data.proofs);
        setSelected(data.selected);
      })
      .catch((caught: unknown) => {
        setProofs([]);
        setSelected(null);
        setError(caught instanceof Error ? caught.message : "Failed to load proofs");
      })
      .finally(() => setLoading(false));
  }, [executionId, txHash, wallet]);

  if (!wallet) {
    return <div className="min-h-screen bg-zinc-950"><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><EmptyState message="Scan a treasury to load its completed execution proofs." /></main></div>;
  }
  if (loading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">TreasuryOS — Proof Trail</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Immutable Execution Proofs</h1>
          <p className="mt-1 text-sm text-zinc-400">Each record is linked to the report, simulation, execution, attestation, and proof created at completion time.</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error ? <ErrorState error={error} /> : null}
        {!selected && !error ? <EmptyState message="No completed proof records exist for this treasury." /> : null}
        {selected ? <ProofDetails proof={selected} proofs={proofs} /> : null}
      </main>
    </div>
  );
}

function ProofDetails({ proof, proofs }: { proof: ProofRecord; proofs: ProofRecord[] }) {
  const keeperHub = proof.executionMode === "keeperhub";
  const stages = [
    { label: "Report", detail: proof.reportHash ? "Report hash preserved" : "Legacy record", done: Boolean(proof.reportHash) },
    { label: "Simulation", detail: proof.simulationResult ? "Simulation preserved" : "Simulation unavailable", done: Boolean(proof.simulationResult) },
    { label: "Execution", detail: `${keeperHub ? "KeeperHub" : "Direct"} transaction confirmed`, done: Boolean(proof.txHash) },
    ...(keeperHub ? [{ label: "KeeperHub Audit", detail: proof.keeperhubAudit ? "Audit preserved" : "Audit unavailable", done: Boolean(proof.keeperhubAudit) }] : []),
    { label: "Attestation", detail: proof.attestationTxHash ? "Onchain attestation confirmed" : "Attestation unavailable", done: Boolean(proof.attestationTxHash) },
    { label: "Proof", detail: proof.executionProofHash ? "Immutable proof record complete" : "Proof unavailable", done: Boolean(proof.executionProofHash) },
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-emerald-400/20 bg-emerald-400/5">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><p className="font-medium text-emerald-100">Completed proof record</p></div>
            <p className="mt-1 text-sm text-zinc-400">Created {new Date(proof.createdAt).toLocaleString()} · {keeperHub ? "KeeperHub execution" : "Direct execution"}</p>
          </div>
          <Badge variant="low" className="w-fit normal-case">{proof.status}</Badge>
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage) => <StageCard key={stage.label} {...stage} />)}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <ProofField icon={FileCheck2} label="Report Hash" value={proof.reportHash} />
          <ProofField icon={Send} label="Execution Transaction" value={proof.txHash} explorer />
          <ProofField icon={RadioTower} label="Attestation Transaction" value={proof.attestationTxHash} explorer />
          <ProofField icon={ShieldCheck} label="Execution Proof" value={proof.executionProofHash} />
          <ProofField icon={Clock3} label="Execution ID" value={proof.executionId ?? proof.id} />
          <ProofField icon={Clock3} label="Gas Used" value={proof.gasUsed ? Number(proof.gasUsed).toLocaleString() : "Unavailable"} />
          <ProofField icon={ShieldCheck} label="Simulation" value={proof.simulationResult ? "Completed and preserved" : "Unavailable"} />
          <ProofField icon={ShieldCheck} label="KeeperHub Audit" value={keeperHub ? proof.keeperhubAudit ? "Completed and preserved" : "Unavailable" : "Not applicable"} />
        </div>
        <RecentProofs proofs={proofs} selectedId={proof.id} />
      </div>
    </div>
  );
}

function StageCard({ label, detail, done }: { label: string; detail: string; done: boolean }) {
  return <Card className={`rounded-xl ${done ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/10 bg-zinc-900/70"}`}><CardContent className="p-4"><div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${done ? "text-emerald-300" : "text-zinc-600"}`} /><p className="text-sm font-medium text-zinc-200">{label}</p></div><p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p></CardContent></Card>;
}

function ProofField({ icon: Icon, label, value, explorer = false }: { icon: typeof FileCheck2; label: string; value: string | null; explorer?: boolean }) {
  const link = explorer && value ? `https://sepolia.etherscan.io/tx/${value}` : null;
  return <Card className="rounded-xl bg-zinc-900/70"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-cyan-300" />{label}</CardTitle></CardHeader><CardContent className="flex items-center gap-2"><p className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-300">{value?.startsWith("0x") ? shortenHash(value) : value ?? "Unavailable"}</p>{link ? <Button asChild variant="ghost" size="icon" aria-label={`Open ${label} on Etherscan`}><a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button> : null}</CardContent></Card>;
}

function RecentProofs({ proofs, selectedId }: { proofs: ProofRecord[]; selectedId: string }) {
  return <Card className="h-fit rounded-xl bg-zinc-900/70"><CardHeader><CardTitle className="text-base">Recent Proofs</CardTitle></CardHeader><CardContent className="space-y-2">{proofs.length === 0 ? <p className="text-sm text-zinc-500">No additional proofs.</p> : proofs.map((proof) => <Button key={proof.id} asChild variant={proof.id === selectedId ? "secondary" : "ghost"} className="h-auto w-full justify-start px-3 py-2 text-left"><a href={`/proof-trail?execution=${proof.id}`}><span className="block font-mono text-xs">{shortenHash(proof.txHash)}</span><span className="mt-1 block text-xs text-zinc-500">{new Date(proof.createdAt).toLocaleString()}</span></a></Button>)}</CardContent></Card>;
}

function LoadingState() { return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><Loader2 className="h-7 w-7 animate-spin text-zinc-500" /></div>; }
function EmptyState({ message }: { message: string }) { return <Card className="rounded-xl border-dashed border-zinc-700"><CardContent className="py-16 text-center text-sm text-zinc-500">{message}</CardContent></Card>; }
function ErrorState({ error }: { error: string }) { return <Card className="rounded-xl border-red-500/30 bg-red-500/10"><CardContent className="p-4 text-sm text-red-200">{error}</CardContent></Card>; }

export default function ProofTrailPage() { return <Suspense fallback={<LoadingState />}><ProofTrailContent /></Suspense>; }
