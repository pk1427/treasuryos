import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  RadioTower,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const flow = [
  "Treasury Address",
  "Treasury Scanner",
  "Risk Engine",
  "Stress Simulator",
  "Risk Report",
  "Hash",
  "KeeperHub",
  "Sepolia",
  "AttestationRegistry",
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.16),transparent_30%),#09090b]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
        <div className="animate-slide-up">
          <Badge variant="outline" className="mb-5 border-cyan-400/30 text-cyan-300">
            KeeperHub powered attestations
          </Badge>
          <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Treasury Risk Intelligence with Onchain Attestations
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Scan treasury addresses, analyze risk exposure, stress test
            portfolios, and publish immutable risk attestations onchain through
            KeeperHub.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="transition hover:scale-[1.02]">
              <Link href="/dashboard">
                Launch Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/how-it-works">How it Works</Link>
            </Button>
          </div>
        </div>

        <div className="relative animate-slide-up lg:justify-self-end">
          <div className="absolute -inset-10 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Protocol-aware preview
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  Risk report
                </p>
              </div>
              <Badge variant="low" className="normal-case">
                Attested Onchain
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PreviewMetric label="Risk Rating" value="Generated" />
              <PreviewMetric label="Portfolio Value" value="Onchain" />
              <PreviewMetric label="Protocols" value="Wallet + DeFi" />
              <PreviewMetric label="Report Proof" value="bytes32" />
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-zinc-300">
                <RadioTower className="h-4 w-4 text-cyan-300" />
                KeeperHub publish proof
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>
              <p className="mt-3 font-mono text-xs text-zinc-500">
                Report hash -&gt; AttestationRegistry event
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <MetricCard icon={ScanLine} label="Protocol adapters" value="2" />
        <MetricCard icon={CheckCircle2} label="Custody required" value="$0" />
        <MetricCard icon={ShieldCheck} label="Proof network" value="Sepolia" />
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-cyan-300">How it works</p>
              <h2 className="mt-1 text-2xl font-bold text-white">
                From address to verifiable attestation
              </h2>
            </div>
            <p className="max-w-xl text-sm text-zinc-400">
              KeeperHub executes through managed infrastructure; the emitted
              AttestationRegistry event proves the registry call.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-9">
            {flow.map((item, index) => (
              <div key={item} className="group flex items-center gap-2 md:block">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-xs font-semibold text-zinc-200 transition duration-200 group-hover:-translate-y-1 group-hover:border-cyan-400/30 group-hover:text-white">
                  {item}
                </div>
                {index < flow.length - 1 ? (
                  <span className="text-zinc-600 md:hidden">-&gt;</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-400/30">
      <Icon className="h-5 w-5 text-cyan-300" />
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-zinc-400">{label}</p>
    </div>
  );
}
