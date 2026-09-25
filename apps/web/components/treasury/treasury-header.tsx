"use client";

import Link from "next/link";
import { RefreshCw, Eye, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { ratingClasses, ratingLabel } from "@/components/ui/severity";
import type { RiskRating } from "@treasuryos/shared";

export function TreasuryHeader({
  address,
  network,
  totalValueUsd,
  riskScore,
  riskRating,
  lastUpdated,
  isOwner,
  onRefresh,
  refreshing,
}: {
  address: string;
  network: string;
  totalValueUsd: number;
  riskScore?: number;
  riskRating?: RiskRating;
  lastUpdated?: string;
  isOwner?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const rating = riskRating ?? "N/A";

  return (
    <div className="rounded-xl border-0 bg-card p-6 shadow-md">
      <div className="space-y-6 lg:space-y-0 lg:flex lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">
              {address.slice(2, 4).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-xl font-semibold text-foreground">
                {address.slice(0, 10)}…{address.slice(-8)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {network.charAt(0).toUpperCase() + network.slice(1)} ·{" "}
            {isOwner ? (
              <span className="font-semibold text-emerald-400">Owner connected</span>
            ) : (
              "Read-only"
            )}
            {lastUpdated
              ? ` · Updated ${new Date(lastUpdated).toLocaleString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Metric label="Total Value" value={formatUsd(totalValueUsd)} />
          <Metric
            label="Risk Score"
            value={
              riskScore !== undefined ? `${riskScore}` : "—"
            }
            sub={
              <span
                className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${ratingClasses(
                  rating
                )}`}
              >
                {rating} · {ratingLabel(rating)}
              </span>
            }
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scanning" : "Refresh"}
            </Button>
            <Link href="/stream">
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" /> Activity
              </Button>
            </Link>
            {isOwner ? (
              <Link href="/execution">
                <Button size="sm">
                  <Wallet className="h-4 w-4" /> Manage
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-0 bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</p>
      {sub ? <div className="mt-0.5">{sub}</div> : null}
    </div>
  );
}
