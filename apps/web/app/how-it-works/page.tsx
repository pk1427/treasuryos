import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Binary,
  CheckCircle2,
  FileJson,
  Hash,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const flow = [
  {
    title: "Treasury Address",
    body: "User enters a treasury address. No wallet connection is required.",
    icon: Binary,
    lane: "Input",
  },
  {
    title: "Treasury Scanner",
    body: "The scanner builds the current treasury position snapshot.",
    icon: ScanLine,
    lane: "Scan",
  },
  {
    title: "Risk Engine",
    body: "Concentration, counterparty, and liquidity risk are scored.",
    icon: ShieldCheck,
    lane: "Score",
  },
  {
    title: "Stress Simulator",
    body: "Market and protocol stress scenarios are applied to the snapshot.",
    icon: Waves,
    lane: "Simulate",
  },
  {
    title: "Risk Report",
    body: "The report packages the rating, positions, scores, and stress output.",
    icon: FileJson,
    lane: "Report",
  },
  {
    title: "Report Hash",
    body: "The generated JSON report is hashed into a bytes32 proof.",
    icon: Hash,
    lane: "Hash",
  },
  {
    title: "KeeperHub",
    body: "KeeperHub simulates and publishes the attestation transaction.",
    icon: RadioTower,
    lane: "Publish",
  },
  {
    title: "Sepolia",
    body: "The transaction lands on the configured test network.",
    icon: BadgeCheck,
    lane: "Network",
  },
  {
    title: "AttestationRegistry",
    body: "The registry emits the event that proves the report hash was called.",
    icon: CheckCircle2,
    lane: "Verify",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(139,92,246,0.16),transparent_32%),#09090b]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="animate-slide-up">
            <Badge variant="outline" className="mb-5 border-cyan-400/30 text-cyan-300">
              Proof architecture
            </Badge>
            <h1 className="max-w-3xl text-5xl font-bold leading-[1.03] text-white sm:text-6xl">
              A read-only path from treasury data to onchain proof
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              TreasuryOS turns a treasury address into a scored risk report,
              hashes that report, and publishes only the attestation proof
              through KeeperHub.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="transition hover:scale-[1.02]">
                <Link href="/dashboard">
                  Launch Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/attestations">View Attestations</Link>
              </Button>
            </div>
          </div>

          <div className="relative animate-slide-up">
            <div className="absolute -inset-10 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/65 p-5 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
              <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
                <ProofStat label="Custody" value="Never" />
                <ProofStat label="Action" value="Attest" />
                <ProofStat label="Funds moved" value="$0" />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-200">
                    <RadioTower className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      KeeperHub executor note
                    </p>
                    <p className="text-xs text-zinc-500">
                      The registry event is the proof artifact.
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">
                  KeeperHub executes through its own managed infrastructure, so
                  the on-chain &quot;to&quot; address is KeeperHub&apos;s executor. The
                  emitted AttestationRegistry event is what proves the registry
                  contract was called.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 backdrop-blur-xl">
            <p className="text-sm font-medium text-cyan-300">Flow summary</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Scan, score, simulate, publish, verify
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              The system stays inside the v1 scope: no custody, no execution,
              no recommendations, and no background jobs. The output is a
              verifiable attestation.
            </p>
            <div className="mt-5 grid gap-2">
              {["Read-only", "Deterministic hash", "KeeperHub publish", "Etherscan proof"].map(
                (item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    {item}
                  </div>
                )
              )}
            </div>
          </aside>

          <div className="relative rounded-3xl border border-white/10 bg-zinc-900/55 p-4 backdrop-blur-xl sm:p-6">
            <div className="absolute bottom-8 left-9 top-8 hidden w-px bg-gradient-to-b from-cyan-300/50 via-violet-300/30 to-emerald-300/50 md:block" />
            <div className="grid gap-3">
              {flow.map((step, index) => (
                <FlowRow key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FlowRow({
  step,
  index,
}: {
  step: {
    title: string;
    body: string;
    icon: LucideIcon;
    lane: string;
  };
  index: number;
}) {
  const Icon = step.icon;
  const isLast = index === flow.length - 1;

  return (
    <div
      className={cn(
        "group relative grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.04] md:grid-cols-[48px_120px_1fr]",
        isLast && "border-emerald-400/20 bg-emerald-400/5"
      )}
    >
      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
          {String(index + 1).padStart(2, "0")} / {step.lane}
        </p>
        <p className="mt-1 text-base font-semibold text-white">{step.title}</p>
      </div>
      <p className="text-sm leading-6 text-zinc-400 md:pt-4">{step.body}</p>
    </div>
  );
}

function ProofStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
