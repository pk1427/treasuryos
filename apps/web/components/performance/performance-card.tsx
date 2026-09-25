import { TrendingUp, Clock } from "lucide-react";
import { formatUsd } from "@/lib/utils";

const RANGES = ["1D", "1W", "1M", "6M", "1Y"];

export function PerformanceCard({ totalValueUsd }: { totalValueUsd: number }) {
  return (
    <div className="rounded-2xl border border-border privacy-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground font-display">Performance</h3>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Live snapshot
        </span>
      </div>

      <div className="mt-5 flex items-end gap-3">
        <p className="font-mono text-3xl font-semibold text-foreground">
          {formatUsd(totalValueUsd)}
        </p>
        <p className="pb-1 text-sm text-muted-foreground">current treasury value</p>
      </div>

      <div className="mt-6 rounded-xl border border-border privacy-card p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Historical performance is not available yet
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              TreasuryOS will build historical treasury snapshots to enable
              period comparisons. Today only the current live value is shown.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <span
              key={r}
              className="rounded-lg border border-dashed border-white/10 px-3 py-1.5 text-xs text-muted-foreground"
            >
              {r} — coming soon
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
