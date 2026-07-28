import Link from "next/link";
import {
  BarChart3,
  FileCheck2,
  LockKeyhole,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const analyzeItems = [
  "Portfolio analysis",
  "Risk drivers",
  "AI treasury insights",
  "Stress testing",
];

const manageItems = [
  "Execution planning",
  "Simulation & approval",
  "Wallet-signed swaps",
  "Onchain attestation",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-5 border-cyan-400/30 text-cyan-300">
            Sepolia • non-custodial • verifiable
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Treasury Intelligence & Execution Platform
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Analyze any public treasury read-only, or connect the owner wallet to
            plan, simulate, execute, and attest treasury actions.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <ModeCard
            icon={ScanLine}
            title="Analyze Any Treasury"
            description="Paste any Ethereum address to inspect treasury health without connecting a wallet."
            items={analyzeItems}
            cta="Analyze a Treasury"
            href="/dashboard"
            note="No wallet required"
          />
          <ModeCard
            icon={ShieldCheck}
            title="Manage My Treasury"
            description="Connect your wallet to unlock owner-only execution, proof, and audit workflows."
            items={manageItems}
            cta="Connect Wallet"
            href="/dashboard"
            note="You approve every transaction"
          />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <TrustMetric icon={LockKeyhole} label="Custody model" value="Non-custodial" />
          <TrustMetric icon={RadioTower} label="Proof layer" value="KeeperHub" />
          <TrustMetric icon={FileCheck2} label="Audit artifact" value="Onchain attestation" />
        </div>
      </section>
    </main>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  items,
  cta,
  href,
  note,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  items: string[];
  cta: string;
  href: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-zinc-300">
            <BarChart3 className="h-4 w-4 text-emerald-300" />
            {item}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild>
          <Link href={href}>
            {title.startsWith("Manage") ? <Wallet className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
            {cta}
          </Link>
        </Button>
        <p className="text-xs text-zinc-500">{note}</p>
      </div>
    </div>
  );
}

function TrustMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <Icon className="h-5 w-5 text-emerald-300" />
      <p className="mt-3 text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}