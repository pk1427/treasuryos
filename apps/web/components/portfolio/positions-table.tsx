import { StatusPill } from "@/components/ui/treasury-primitives";
import { formatUsd } from "@/lib/utils";
import type { TreasuryPosition } from "@treasuryos/shared";

const ASSET_COLORS: Record<string, string> = {
  ETH: "#627eea",
  USDC: "#2775ca",
  USDT: "#26a17b",
  DAI: "#f5ac37",
  WBTC: "#f7931a",
  AAVE: "#b6509e",
  UNI: "#ff007a",
};

export function PositionsTable({
  positions,
  totalValue,
}: {
  positions: TreasuryPosition[];
  totalValue: number;
}) {
  if (positions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border privacy-card px-6 py-12 text-center text-sm text-muted-foreground">
        No positions found for this treasury.
      </div>
    );
  }

  const sorted = [...positions].sort((a, b) => b.amountUsd - a.amountUsd);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border privacy-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Asset</th>
            <th className="px-4 py-3 font-medium">Protocol</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 text-right font-medium">Value</th>
            <th className="px-4 py-3 text-right font-medium">Allocation</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {sorted.map((position) => {
            const allocation =
              totalValue > 0 ? (position.amountUsd / totalValue) * 100 : 0;
            return (
              <tr
                key={`${position.protocol}-${position.asset}-${position.amountUsd}`}
                className="bg-muted/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: `${getAssetColor(position.asset)}20`,
                        color: getAssetColor(position.asset),
                      }}
                    >
                      {position.asset.slice(0, 2)}
                    </span>
                    <span className="font-medium text-foreground">
                      {position.asset}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{position.protocol}</td>
                <td className="px-4 py-3">
                  <StatusPill tone="neutral" className="normal-case">
                    {positionTypeLabel(position.type)}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {formatUsd(position.amountUsd)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="ml-auto flex w-28 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {totalValue > 0 ? `${allocation.toFixed(1)}%` : "—"}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/30">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(allocation, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PositionStatus position={position} totalValue={totalValue} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PositionStatus({
  position,
  totalValue,
}: {
  position: TreasuryPosition;
  totalValue: number;
}) {
  if (position.protocol === "Uniswap" && position.metadata?.inRange != null) {
    return (
      <StatusPill
        tone={position.metadata.inRange ? "success" : "danger"}
        className="normal-case"
      >
        {position.metadata.inRange ? "In range" : "Out of range"}
      </StatusPill>
    );
  }
  const allocation = totalValue > 0 ? position.amountUsd / totalValue : 0;
  return (
    <StatusPill tone={allocation >= 0.7 ? "warning" : "neutral"} className="normal-case">
      {allocation >= 0.7 ? "Concentrated" : "Monitor"}
    </StatusPill>
  );
}

function positionTypeLabel(type: string | undefined): string {
  if (type === "lending") return "Supplied";
  if (type === "borrowing") return "Borrowed";
  if (type === "lp") return "Liquidity";
  if (type === "staking") return "Staked";
  if (type === "vault") return "Vault";
  return "Wallet";
}

function getAssetColor(asset: string): string {
  return ASSET_COLORS[asset.toUpperCase()] ?? "#6b7280";
}
