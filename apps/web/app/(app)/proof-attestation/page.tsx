"use client";

import { useState, useEffect, Fragment, type MouseEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ExternalLink,
  Loader2,
  Lock,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortenHash } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";

type IndexedAttestation = {
  id: string;
  network: string;
  treasury: string;
  reportHash: string;
  publisher: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;
  createdAt: string;
  status: string;
  transactionLink: string;
};

type AttestationsResponse = {
  items: IndexedAttestation[];
  page: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    hasMore: boolean;
  };
  filters: {
    network: string | null;
    treasury: string | null;
  };
};

export default function ProofAttestationPage() {
  const wallet = useWallet();
  const session = useTreasurySession();
  const { mode, connectedWallet, isOwnerVerified } = session;

  const [attestations, setAttestations] = useState<IndexedAttestation[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const locked = mode === "analyze" || !connectedWallet || !isOwnerVerified;

  useEffect(() => {
    let cancelled = false;

    async function loadAttestations() {
      setState("loading");
      setError(null);

      try {
        const response = await fetch("/api/attestations?limit=50", {
          cache: "no-store",
        });
        const data = (await response.json()) as AttestationsResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load attestations");
        }

        if (!cancelled) {
          setAttestations(data.items);
          setState("done");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to load attestations"
          );
          setState("error");
        }
      }
    }

    loadAttestations();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              TreasuryOS — Proof & Attestation
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Attestation History
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Date, action, report hash, attestation hash, and status for every published attestation.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div><p className="text-sm font-medium text-cyan-100">Need to inspect one execution end-to-end?</p><p className="mt-1 text-xs text-zinc-400">The proof trail links the report, simulation, attestation, and onchain record.</p></div>
          <Button asChild variant="secondary" size="sm"><a href="/proof-trail">Open Proof Trail</a></Button>
        </div>
        {locked ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} />
        ) : (
          <>
            {error ? (
              <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="w-10 px-3 py-3" />
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Report Hash</th>
                    <th className="px-3 py-3">Attestation Hash</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {state === "loading" ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-zinc-500">
                        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
                        Loading attestations...
                      </td>
                    </tr>
                  ) : attestations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-zinc-500">
                        <RadioTower className="mx-auto mb-3 h-8 w-8" />
                        No attestations found yet.
                      </td>
                    </tr>
                  ) : (
                    attestations.map((entry) => {
                      const expanded = expandedTx === entry.txHash;
                      return (
                        <Fragment key={entry.txHash}>
                          <tr
                            className="cursor-pointer bg-zinc-950 hover:bg-zinc-900/60"
                            onClick={() =>
                              setExpandedTx(expanded ? null : entry.txHash)
                            }
                          >
                            <td className="px-3 py-4 text-zinc-500">
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-3 py-4 text-zinc-300">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-4 text-zinc-200">
                              {entry.status === "Attested Onchain" ? "On-chain Attest" : entry.status}
                            </td>
                            <td className="px-3 py-4">
                              <InlineCopy
                                value={entry.reportHash}
                                display={shortenHash(entry.reportHash)}
                              />
                            </td>
                            <td className="px-3 py-4">
                              <InlineCopy
                                value={entry.txHash}
                                display={shortenHash(entry.txHash)}
                              />
                            </td>
                            <td className="px-3 py-4">
                              <Badge variant="low" className="normal-case">
                                ✓ Attested
                              </Badge>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={6} className="bg-zinc-950 px-6 py-5">
                                <div className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-2">
                                  <Detail label="Full report hash" value={entry.reportHash} />
                                  <Detail label="Attestation hash" value={entry.txHash} link={entry.transactionLink} />
                                  <Detail label="Treasury" value={entry.treasury} />
                                  <Detail label="Publisher" value={entry.publisher} />
                                  <Detail label="Block number" value={entry.blockNumber} />
                                  <Detail label="Network" value={entry.network} />
                                  <Detail label="Timestamp" value={new Date(entry.timestamp).toLocaleString()} />
                                  <Detail label="Status" value="✓ Attested Onchain" />
                                  <Detail label="Etherscan" value="View on Etherscan" link={entry.transactionLink} />
                                </div>
                                <div className="mt-3">
                                  <Button asChild variant="secondary" size="sm">
                                    <a href={`/proof-trail?tx=${entry.txHash}&report=${entry.reportHash}`}>
                                      View Proof Trail →
                                    </a>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function LockedPanel({ mode, onConnect }: { mode: "analyze" | "manage"; onConnect: () => void }) {
  const copy =
    mode === "analyze"
      ? "Proof and attestation remain visible here, but publishing and private proof workflows require Manage mode."
      : "Connect the wallet that owns this treasury to unlock proof and attestation workflows.";

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

function InlineCopy({ value, display }: { value: string; display: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-zinc-200">
      {display}
      <CopyButton value={value} label={`Copy ${display}`} />
    </span>
  );
}

function Detail({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs uppercase text-zinc-500">{label}</p>
      <div className="flex items-center gap-2">
        <p className="break-all font-mono text-sm text-zinc-100">{value}</p>
        <CopyButton value={value} label={`Copy ${label}`} />
        {link ? (
          <Button asChild variant="ghost" size="icon" aria-label="View on Etherscan">
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      className="h-7 w-7"
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
    </Button>
  );
}
