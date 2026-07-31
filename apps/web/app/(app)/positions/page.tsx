"use client";

import {
  Table2,
  Lock,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import { MetricCard, StatusPill } from "@/components/ui/treasury-primitives";

type TreasuryPosition = {
  protocol: string;
  asset: string;
  amountUsd: number;
  type?: "wallet" | "lending" | "borrowing" | "lp" | "staking" | "vault";
  metadata?: Record<string, unknown>;
};

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
  const positions = report?.snapshot.positions ?? [];
  const totalValue = report?.snapshot.totalValueUsd ?? 0;
  const ownerVerified =
    Boolean(wallet.address && report?.address) &&
    wallet.address!.toLowerCase() === report!.address.toLowerCase();
  const locked =
    mode === "analyze" || !connectedWallet || !ownerVerified;

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
          <EmptyState icon={Table2} text="No positions found. Scan a treasury to populate the inventory." />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Total Value" value={usd(totalValue)} detail="Detected onchain assets" />
              <MetricCard label="Positions" value={String(positions.length)} detail="Wallet and protocol inventory" />
              <MetricCard label="Network" value={process.env.NEXT_PUBLIC_CHAIN ?? "sepolia"} detail="Configured test network" tone="info" />
            </div>
            <PositionsTable positions={positions} totalValue={totalValue} />
          </div>
        )}
      </main>
    </div>
  );
}

function PositionsTable({
  positions,
  totalValue,
}: {
  positions: TreasuryPosition[];
  totalValue: number;
}) {
  if (positions.length === 0) {
    return <EmptyState icon={Table2} text="No positions found." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Protocol</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">Allocation</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {positions
            .slice()
            .sort((a, b) => b.amountUsd - a.amountUsd)
            .map((position) => (
              <tr key={`${position.protocol}-${position.asset}-${position.amountUsd}`} className="bg-zinc-950/40">
                <td className="px-4 py-3 font-medium text-zinc-100">{position.asset}</td>
                <td className="px-4 py-3 text-zinc-300">{position.protocol}</td>
                <td className="px-4 py-3 text-zinc-400">{positionTypeLabel(position.type)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-100">{usd(position.amountUsd)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="ml-auto w-28">
                    <p className="font-mono text-xs tabular-nums text-zinc-300">{totalValue > 0 ? percent(position.amountUsd / totalValue) : "--"}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min((position.amountUsd / Math.max(totalValue, 1)) * 100, 100)}%` }} /></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PositionStatus position={position} totalValue={totalValue} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionStatus({ position, totalValue }: { position: TreasuryPosition; totalValue: number }) {
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
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <div className="flex items-start gap-3">
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
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 px-4 text-center text-sm text-zinc-500">
      <Icon className="h-6 w-6" />
      {text}
    </div>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function positionTypeLabel(type: string | undefined): string {
  if (type === "lending") return "Supplied";
  if (type === "borrowing") return "Borrowed";
  if (type === "lp") return "Liquidity position";
  if (type === "staking") return "Staked";
  if (type === "vault") return "Vault";
  return "Wallet balance";
}
