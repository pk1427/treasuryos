"use client";

import { useMemo } from "react";
import {
  BarChart3,
  Lock,
  Wallet,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/treasury-primitives";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import { formatUsd } from "@/lib/utils";
import type { TreasuryPosition } from "@treasuryos/shared";

const ALLOCATION_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export default function PositionsPage() {
  const wallet = useWallet();
  const session = useTreasurySession();
  const {
    mode,
    analyzedAddress: address,
    reportResponse,
    connectedWallet,
  } = session;

  const report = reportResponse?.report;
  const positions = useMemo(() => report?.snapshot.positions ?? [], [report?.snapshot.positions]);
  const totalValue = useMemo(() => report?.snapshot.totalValueUsd ?? 0, [report?.snapshot.totalValueUsd]);
  const ownerVerified =
    Boolean(wallet.address && report?.address) &&
    wallet.address!.toLowerCase() === report!.address.toLowerCase();
  const locked =
    mode === "analyze" || !connectedWallet || !ownerVerified;

  const chartData = useMemo(() => {
    const sorted = [...positions]
      .filter((p) => p.amountUsd > 0)
      .sort((a, b) => b.amountUsd - a.amountUsd)
      .slice(0, 7);

    if (sorted.length === 0) return [];

    const topTotal = sorted.reduce((sum, p) => sum + p.amountUsd, 0);
    const rest = totalValue - topTotal;

    return [
      ...sorted.map((p, i) => ({
        name: p.asset,
        value: p.amountUsd,
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
      })),
      ...(rest > 0
        ? [
            {
              name: "Other",
              value: rest,
              color: "#525252",
            },
          ]
        : []),
    ];
  }, [positions, totalValue]);

  const walletPositions = positions.filter((p) => p.protocol === "Wallet");
  const protocolPositions = positions.filter((p) => p.protocol !== "Wallet");

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              TreasuryOS — Positions
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Treasury Positions
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Complete inventory of detected wallet balances and protocol positions.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {locked ? (
          <LockedPanel
            mode={mode}
            analyzedAddress={report?.address ?? address}
            connectedWallet={connectedWallet}
            onConnect={wallet.connect}
          />
        ) : positions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Value"
                value={formatUsd(totalValue)}
                detail={`${positions.length} position${positions.length !== 1 ? "s" : ""}`}
                tone="info"
              />
              <MetricCard
                label="Wallet Holdings"
                value={String(walletPositions.length)}
                detail="Native and token balances"
              />
              <MetricCard
                label="Protocol Positions"
                value={String(protocolPositions.length)}
                detail="DeFi protocol exposure"
              />
              <MetricCard
                label="Network"
                value={process.env.NEXT_PUBLIC_CHAIN ?? "sepolia"}
                detail="Configured test network"
                tone="neutral"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5 text-cyan-300" />
                      Position Inventory
                    </CardTitle>
                    <Badge variant="outline" className="normal-case">
                      {positions.length} items
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                          <th className="px-4 py-3 font-medium">Asset</th>
                          <th className="px-4 py-3 font-medium">Protocol</th>
                          <th className="px-4 py-3 font-medium">Type</th>
                          <th className="px-4 py-3 text-right font-medium">Value</th>
                          <th className="px-4 py-3 text-right font-medium">Allocation</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {positions
                          .slice()
                          .sort((a, b) => b.amountUsd - a.amountUsd)
                          .map((position) => {
                            const allocation =
                              totalValue > 0
                                ? (position.amountUsd / totalValue) * 100
                                : 0;
                            return (
                              <tr
                                key={`${position.protocol}-${position.asset}-${position.amountUsd}`}
                                className="bg-zinc-950/40 transition hover:bg-zinc-900/40"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="h-8 w-8 rounded-lg"
                                      style={{
                                        backgroundColor: `${getAssetColor(position.asset)}20`,
                                      }}
                                    >
                                      <div
                                        className="flex h-full w-full items-center justify-center rounded-lg text-xs font-bold"
                                        style={{
                                          color: getAssetColor(position.asset),
                                        }}
                                      >
                                        {position.asset.slice(0, 2)}
                                      </div>
                                    </div>
                                    <span className="font-medium text-zinc-100">
                                      {position.asset}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-zinc-300">
                                  {position.protocol}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusPill tone="neutral" className="normal-case">
                                    {positionTypeLabel(position.type)}
                                  </StatusPill>
                                </td>
                                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-100">
                                  {formatUsd(position.amountUsd)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="ml-auto w-28">
                                    <p className="font-mono text-xs tabular-nums text-zinc-300">
                                      {totalValue > 0 ? `${allocation.toFixed(1)}%` : "--"}
                                    </p>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                                      <div
                                        className="h-full rounded-full bg-cyan-400 transition-all"
                                        style={{
                                          width: `${Math.min(allocation, 100)}%`,
                                        }}
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
                </CardContent>
              </Card>

              <aside className="space-y-6">
                <Card className="rounded-xl bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChart className="h-5 w-5 text-violet-300" />
                      Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="space-y-4">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                  stroke="none"
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "1px solid #27272a",
                                borderRadius: "8px",
                              }}
                              formatter={(value) => [
                                formatUsd(Number(value ?? 0)),
                                "Value",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                          {chartData.slice(0, 5).map((entry) => (
                            <div
                              key={entry.name}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-zinc-300">
                                  {entry.name}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-zinc-400">
                                {totalValue > 0
                                  ? `${((entry.value / totalValue) * 100).toFixed(1)}%`
                                  : "--"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No allocation data available.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-zinc-900/70">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">
                      Protocol Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(() => {
                        const protocolMap = new Map<string, { count: number; value: number }>();
                        positions.forEach((p) => {
                          const current = protocolMap.get(p.protocol) ?? { count: 0, value: 0 };
                          protocolMap.set(p.protocol, {
                            count: current.count + 1,
                            value: current.value + p.amountUsd,
                          });
                        });
                        return Array.from(protocolMap.entries()).map(
                          ([protocol, data]) => (
                            <div
                              key={protocol}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-zinc-200">
                                  {protocol}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {data.count} position{data.count !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <p className="font-mono text-sm text-zinc-300">
                                {formatUsd(data.value)}
                              </p>
                            </div>
                          )
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        )}
      </main>
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
      <StatusPill tone={position.metadata.inRange ? "success" : "danger"}>
        {position.metadata.inRange ? "In range" : "Out of range"}
      </StatusPill>
    );
  }
  const allocation = totalValue > 0 ? position.amountUsd / totalValue : 0;
  return (
    <StatusPill tone={allocation >= 0.7 ? "warning" : "neutral"}>
      {allocation >= 0.7 ? "Concentrated" : "Monitor"}
    </StatusPill>
  );
}

function LockedPanel({
  mode,
  analyzedAddress,
  connectedWallet,
  onConnect,
}: {
  mode: "analyze" | "manage";
  analyzedAddress: string;
  connectedWallet: string | null;
  onConnect: () => void;
}) {
  const mismatch =
    Boolean(connectedWallet && analyzedAddress) &&
    connectedWallet!.toLowerCase() !== analyzedAddress.toLowerCase();

  return (
    <Card className="rounded-xl border-amber-500/30 bg-amber-500/10">
      <CardContent className="flex items-start gap-3 p-6">
        <Lock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <p className="font-medium text-amber-200">
            {mismatch ? "Execution unavailable for this treasury" : "Manage mode required"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {mismatch
              ? `Connected wallet ${shortenAddress(connectedWallet!)} does not own ${shortenAddress(analyzedAddress)}.`
              : mode === "analyze"
                ? "Analyze mode is intentionally read-only. Connect the treasury owner wallet to unlock management, execution, and private proof workflows."
                : "Connect the wallet that owns this treasury to unlock execution planning; TreasuryOS never takes custody of funds."}
          </p>
          {!connectedWallet ? (
            <Button className="mt-3" variant="secondary" size="sm" onClick={onConnect}>
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="rounded-xl border-dashed border-zinc-700">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-xl border border-white/10 bg-zinc-950 p-3">
          <BarChart3 className="h-6 w-6 text-zinc-400" />
        </div>
        <p className="text-base font-medium text-zinc-200">
          No positions found
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Scan a treasury to populate the position inventory. Positions include
          wallet balances, LP tokens, staking positions, and protocol deposits.
        </p>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    neutral: "border-white/10 bg-white/[0.04] text-zinc-300",
    info: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    danger: "border-red-400/25 bg-red-400/10 text-red-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-zinc-400">{detail}</p> : null}
    </div>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
  const colors: Record<string, string> = {
    ETH: "#627eea",
    USDC: "#2775ca",
    USDT: "#26a17b",
    DAI: "#f5ac37",
    WBTC: "#f7931a",
    AAVE: "#b6509e",
    UNI: "#ff007a",
  };
  return colors[asset.toUpperCase()] ?? "#6b7280";
}
