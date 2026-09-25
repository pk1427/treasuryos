import type { TreasuryPosition } from "@treasuryos/shared";

export function ProtocolAllocation({
  positions,
  totalValueUsd,
}: {
  positions: TreasuryPosition[];
  totalValueUsd: number;
}) {
  const totals = new Map<string, number>();
  for (const p of positions) {
    totals.set(p.protocol, (totals.get(p.protocol) ?? 0) + p.amountUsd);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0 || totalValueUsd <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No protocol exposure detected.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map(([protocol, value]) => {
        const pct = totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0;
        return (
          <li key={protocol}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{protocol}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
