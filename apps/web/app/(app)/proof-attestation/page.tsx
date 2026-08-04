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
  Search,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const { mode, connectedWallet, isOwnerVerified, isKeeperHubManaged } = session;

  const [attestations, setAttestations] = useState<IndexedAttestation[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const locked = mode === "analyze" || (!isKeeperHubManaged && (!connectedWallet || !isOwnerVerified));

  const filteredAttestations = attestations.filter((attestation) => {
    const matchesSearch =
      searchQuery === "" ||
      attestation.reportHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attestation.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attestation.treasury.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attestation.status.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStatus === "all" ||
      attestation.status.toLowerCase().includes(filterStatus.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  const recentAttestations = filteredAttestations.slice(0, 10);
  const olderAttestations = filteredAttestations.slice(10);

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
              Onchain attestation records linked to treasury reports and executions.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div>
            <p className="text-sm font-medium text-cyan-100">Need to inspect one execution end-to-end?</p>
            <p className="mt-1 text-xs text-zinc-400">The proof trail links the report, simulation, attestation, and onchain record.</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href="/proof-trail">Open Proof Trail</a>
          </Button>
        </div>

        {!locked && state === "done" && (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by hash, treasury, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-zinc-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none focus:border-cyan-400"
              >
                <option value="all">All statuses</option>
                <option value="attested">Attested</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        )}

        {locked ? (
          <LockedPanel mode={mode} onConnect={wallet.connect} isKeeperHubManaged={isKeeperHubManaged} />
        ) : (
          <>
            {error ? (
              <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {state === "loading" ? (
              <Card className="rounded-xl bg-zinc-900/70">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-zinc-500" />
                  <p className="text-sm text-zinc-500">Loading attestations...</p>
                </CardContent>
              </Card>
            ) : filteredAttestations.length === 0 ? (
              <Card className="rounded-xl border-dashed border-zinc-700">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 rounded-xl border border-white/10 bg-zinc-950 p-2.5">
                    <RadioTower className="h-5 w-5 text-zinc-400" />
                  </div>
                  <p className="text-base font-medium text-zinc-200">No attestations found</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                    {searchQuery || filterStatus !== "all"
                      ? "No attestations match your current filters. Try adjusting your search."
                      : "Execute a plan to generate the first attestation record."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Recent Attestations
                      </p>
                      <Badge variant="outline" className="normal-case">
                        {recentAttestations.length} record{recentAttestations.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {recentAttestations.map((entry) => {
                      const expanded = expandedTx === entry.txHash;
                      return (
                        <Fragment key={entry.txHash}>
                          <div
                            className="cursor-pointer bg-zinc-950 transition hover:bg-zinc-900/60"
                            onClick={() =>
                              setExpandedTx(expanded ? null : entry.txHash)
                            }
                          >
                            <div className="flex items-center gap-4 px-4 py-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="low" className="normal-case">
                                    ✓ Attested
                                  </Badge>
                                  <span className="text-sm font-medium text-zinc-200">
                                    {entry.status === "Attested Onchain" ? "On-chain Attest" : entry.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                  <span>
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </span>
                                  <span className="font-mono">
                                    Report: {shortenHash(entry.reportHash)}
                                  </span>
                                  <span className="font-mono">
                                    Tx: {shortenHash(entry.txHash)}
                                  </span>
                                  <span>{entry.network}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={entry.transactionLink}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Etherscan
                                  </a>
                                </Button>
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                                )}
                              </div>
                            </div>
                          </div>
                          {expanded ? (
                            <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-5">
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
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {olderAttestations.length > 0 && (
                  <details className="group">
                    <summary className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900">
                      <Filter className="h-4 w-4" />
                      Older attestations ({olderAttestations.length})
                      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60">
                      <div className="divide-y divide-zinc-800">
                        {olderAttestations.map((entry) => (
                          <div
                            key={entry.txHash}
                            className="cursor-pointer bg-zinc-950 transition hover:bg-zinc-900/60"
                            onClick={() =>
                              setExpandedTx(expandedTx === entry.txHash ? null : entry.txHash)
                            }
                          >
                            <div className="flex items-center gap-4 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="low" className="normal-case">
                                    ✓ Attested
                                  </Badge>
                                  <span className="text-sm text-zinc-300">
                                    {entry.status === "Attested Onchain" ? "On-chain Attest" : entry.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                  <span>
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                  </span>
                                  <span className="font-mono">
                                    Report: {shortenHash(entry.reportHash)}
                                  </span>
                                  <span className="font-mono">
                                    Tx: {shortenHash(entry.txHash)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={entry.transactionLink}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Etherscan
                                  </a>
                                </Button>
                                {expandedTx === entry.txHash ? (
                                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                                )}
                              </div>
                            </div>
                            {expandedTx === entry.txHash && (
                              <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-5">
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
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LockedPanel({ mode, onConnect, isKeeperHubManaged }: { mode: "analyze" | "manage"; onConnect: () => void; isKeeperHubManaged: boolean }) {
  const copy =
    mode === "analyze"
      ? "Proof and attestation remain visible here, but publishing and private proof workflows require Manage mode."
      : isKeeperHubManaged
        ? "This treasury is managed by your authenticated KeeperHub organization. Proof and attestation workflows are available without a connected wallet."
        : "Connect the wallet that owns this treasury to unlock proof and attestation workflows.";

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
