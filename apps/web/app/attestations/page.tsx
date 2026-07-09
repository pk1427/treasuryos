"use client";

import { Fragment, useEffect, useState, type MouseEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ExternalLink,
  FileJson,
  Loader2,
  RadioTower,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortenHash, truncateAddress } from "@/lib/utils";

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

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<IndexedAttestation[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.15),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(139,92,246,0.13),transparent_32%),#09090b]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-medium text-cyan-300">Proof artifact</p>
        <h1 className="mt-1 text-3xl font-bold text-zinc-100">Attestations</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Published KeeperHub attestations indexed from AttestationRegistry
          events and persisted in the database.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={RadioTower}
          label="Indexed attestations"
          value={String(attestations.length)}
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Verified status"
          value={attestations.length > 0 ? "Onchain" : "Waiting"}
        />
        <SummaryCard
          icon={FileJson}
          label="History backing"
          value="Database"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/60 backdrop-blur-xl">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs uppercase text-zinc-500">
            <tr>
              <th className="w-10 px-3 py-3" />
              <th className="px-3 py-3">Time</th>
              <th className="px-3 py-3">Treasury</th>
              <th className="px-3 py-3">Report Hash</th>
              <th className="px-3 py-3">Transaction</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {state === "loading" ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-zinc-500">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
                  Loading indexed attestations...
                </td>
              </tr>
            ) : attestations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-zinc-500">
                  <RadioTower className="mx-auto mb-3 h-8 w-8" />
                  No indexed attestations found in the database yet.
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
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-4">
                        <InlineCopy
                          value={entry.treasury}
                          display={truncateAddress(entry.treasury)}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <InlineCopy
                          value={entry.reportHash}
                          display={shortenHash(entry.reportHash)}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <InlineCopy
                            value={entry.txHash}
                            display={shortenHash(entry.txHash)}
                          />
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            onClick={(event) => event.stopPropagation()}
                            aria-label="View transaction on Etherscan"
                          >
                            <a
                              href={entry.transactionLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant="low" className="normal-case">
                          ✓ Attested Onchain
                        </Badge>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr>
                        <td colSpan={6} className="bg-zinc-950 px-6 py-5">
                          <div className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-2">
                            <Detail label="Full treasury address" value={entry.treasury} />
                            <Detail label="Full report hash" value={entry.reportHash} />
                            <Detail
                              label="Full transaction hash"
                              value={entry.txHash}
                              link={entry.transactionLink}
                            />
                            <Detail label="Publisher" value={entry.publisher} />
                            <Detail label="Block number" value={entry.blockNumber} />
                            <Detail label="Network" value={entry.network} />
                            <Detail
                              label="Timestamp"
                              value={new Date(entry.timestamp).toLocaleString()}
                            />
                            <Detail label="Status" value="✓ Attested Onchain" />
                            <Detail
                              label="Etherscan"
                              value="View on Etherscan"
                              link={entry.transactionLink}
                            />
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

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
      <Icon className="h-5 w-5 text-cyan-300" />
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-zinc-400">{label}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string;
}) {
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
