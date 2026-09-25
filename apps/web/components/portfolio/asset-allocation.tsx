import type { TreasuryPosition } from "@treasuryos/shared";

const ASSET_COLORS = [
  "#8b5cf6",
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#a3a3a3",
];

export function AssetAllocation({
  positions,
  totalValueUsd,
}: {
  positions: TreasuryPosition[];
  totalValueUsd: number;
}) {
  const walletPositions = positions.filter((p) => p.protocol === "Wallet");
  const totals = new Map<string, number>();
  for (const p of walletPositions) {
    totals.set(p.asset, (totals.get(p.asset) ?? 0) + p.amountUsd);
  }
  // Include protocol positions too, grouped by asset symbol when present.
  for (const p of positions.filter((p) => p.protocol !== "Wallet")) {
    const asset = p.asset.split("/")[0];
    totals.set(asset, (totals.get(asset) ?? 0) + p.amountUsd);
  }

  const sorted = [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0 || totalValueUsd <= 0) {
    return (
      <p className="text-sm text-muted-foreground">No allocation data available.</p>
    );
  }

  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
  const segments = [
    ...top.map(([asset, value]) => ({ label: asset, value })),
    ...(rest > 0 ? [{ label: "Other", value: rest }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <Donut segments={segments} total={totalValueUsd} />
      <ul className="flex-1 space-y-2">
        {segments.map((s, i) => {
          const pct = totalValueUsd > 0 ? (s.value / totalValueUsd) * 100 : 0;
          return (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }}
              />
              <span className="flex-1 text-foreground">{s.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number }[];
  total: number;
}) {
  const size = 168;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcData = segments.reduce(
    (acc, s, i) => {
      const fraction = total > 0 ? s.value / total : 0;
      const dash = fraction * circumference;
      acc.items.push({
        key: s.label,
        stroke: ASSET_COLORS[i % ASSET_COLORS.length],
        dash,
        offset: -acc.running,
      });
      acc.running += dash;
      return acc;
    },
    { running: 0, items: [] as Array<{ key: string; stroke: string; dash: number; offset: number }> }
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      {arcData.items.map((s) => (
        <circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.stroke}
          strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      ))}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-zinc-400"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}
      >
        Assets
      </text>
    </svg>
  );
}
