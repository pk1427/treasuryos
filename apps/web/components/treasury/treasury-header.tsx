"use client";

import Link from "next/link";
import Image from "next/image";
import { RefreshCw, Eye, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { ratingClasses, ratingLabel } from "@/components/ui/severity";
import type { RiskRating } from "@treasuryos/shared";

export function TreasuryHeader({
  address,
  totalValueUsd,
  riskScore,
  riskRating,
  lastUpdated,
  isOwner,
  onRefresh,
  refreshing,
}: {
  address: string;
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
    <div className="rounded-2xl bg-card p-5 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:gap-8">
        <div className="flex min-w-0 items-center gap-3">
          <AccountAvatar address={address} />
          {lastUpdated ? (
            <div className="text-xs text-muted-foreground">
              <p className="uppercase tracking-[0.16em] text-muted-foreground/75">Portfolio updated</p>
              <p className="mt-1">
                Updated {new Date(lastUpdated).toLocaleString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </p>
            </div>
          ) : null}
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-white/[0.08] xl:block" />

        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 sm:gap-x-9">
          <Metric label="Total Value" value={formatUsd(totalValueUsd)} />
          <Metric
            label="Risk Score"
            value={
              riskScore !== undefined ? `${riskScore}` : "—"
            }
            sub={
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${ratingClasses(
                  rating
                )}`}
              >
                {rating} · {ratingLabel(rating)}
              </span>
            }
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap xl:ml-auto xl:pl-2">
          <div className="flex items-center gap-1 rounded-xl bg-background/60 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh portfolio data"
              className="h-9 px-3 text-foreground hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Scanning" : "Refresh"}
            </Button>
            <Link href="/stream">
              <Button
                variant="ghost"
                size="sm"
                title="View portfolio activity"
                className="h-9 px-3 text-foreground hover:bg-white/[0.06]"
              >
                <Eye className="h-4 w-4" /> Activity
              </Button>
            </Link>
          </div>
          {isOwner ? (
            <Link href="/execution">
              <Button size="sm" title="Manage this treasury" className="h-10 px-4 shadow-sm">
                <Wallet className="h-4 w-4" /> Manage
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AccountAvatar({ address }: { address: string }) {
  const avatarUrl = `https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(address)}&backgroundColor=0f172a`;

  return (
    <div
      className="relative h-12 w-12 shrink-0 overflow-visible rounded-2xl bg-gradient-to-br from-cyan-300 via-cyan-400 to-sky-500 p-0.5 shadow-[0_8px_22px_-10px_rgba(34,211,238,0.9)]"
      aria-label={`Connected treasury account ${address}`}
      title="Connected treasury account"
    >
      <Image
        src={avatarUrl}
        alt="Generated treasury account avatar"
        width={48}
        height={48}
        unoptimized
        className="h-full w-full rounded-[0.9rem] bg-slate-950 object-cover"
      />
      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-400" />
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
    <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
      {sub ? <div className="flex items-center">{sub}</div> : null}
    </div>
  );
}
