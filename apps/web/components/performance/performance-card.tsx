import { TrendingUp, Clock } from "lucide-react";
import { formatUsd } from "@/lib/utils";

export function PerformanceCard({ totalValueUsd }: { totalValueUsd: number }) {
  return (
    <div className="self-start rounded-2xl bg-card p-5 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground font-display">Performance</h3>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Live snapshot
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-mono text-3xl font-semibold text-foreground">
          {formatUsd(totalValueUsd)}
        </p>
        <p className="pb-1 text-sm text-muted-foreground">current treasury value</p>
      </div>

      <div className="mt-5 rounded-xl bg-background/45 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Historical performance is not available yet
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Period comparisons will appear after TreasuryOS has collected
              enough snapshots. The value above is the current live reading.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
