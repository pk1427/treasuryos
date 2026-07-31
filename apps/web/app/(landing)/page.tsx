import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileCheck2,
  LockKeyhole,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/treasury-primitives";

const pillars = [
  {
    title: "AI Treasury Intelligence",
    description:
      "Scan any public treasury, score risk across concentration and stress scenarios, and receive an operator-grade brief — no wallet required.",
    icon: BarChart3,
    href: "/dashboard",
    cta: "Start analysis",
  },
  {
    title: "Owner-Controlled Execution",
    description:
      "When you own the wallet, review a deterministic plan, simulate it, sign your intent, and submit the transaction yourself.",
    icon: ShieldCheck,
    href: "/dashboard",
    cta: "Connect wallet",
  },
  {
    title: "Verifiable Onchain Proof",
    description:
      "Every execution is recorded with a report hash, attestation, and inspectable proof trail — no custody, no hidden steps.",
    icon: RadioTower,
    href: "/proof-attestation",
    cta: "View proof history",
  },
];

const trustItems = [
  { icon: LockKeyhole, label: "No custody", body: "Funds never leave your wallet." },
  { icon: ShieldCheck, label: "Owner only", body: "Execution unlocks only for the verified owner." },
  { icon: ScanLine, label: "Read-only analysis", body: "Inspect any treasury without connecting." },
  { icon: RadioTower, label: "Onchain proof", body: "Attestation and proof trail on Sepolia." },
  { icon: FileCheck2, label: "Simulation first", body: "Every plan is simulated before execution." },
  { icon: Wallet, label: "You sign", body: "No autonomous transactions. Ever." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 shadow-[0_0_28px_rgba(99,102,241,0.35)]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-bold text-zinc-100">TreasuryOS</span>
          </div>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Institutional treasury intelligence and execution
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Scan DeFi treasuries, understand risk, review deterministic execution plans,
            and produce verifiable onchain proof — all owner-controlled.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open Command Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 w-full max-w-5xl">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Three pillars
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {pillars.map((pillar) => (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="group rounded-2xl border border-white/10 bg-zinc-900/70 p-6 transition hover:border-cyan-400/30 hover:bg-zinc-900"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 transition group-hover:border-cyan-400/40 group-hover:bg-cyan-400/15">
                  <pillar.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-white">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{pillar.description}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-cyan-300 transition group-hover:text-cyan-200">
                  {pillar.cta}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 w-full max-w-5xl">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Trust & security
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 w-full max-w-5xl">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Ready to inspect a treasury?
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Paste any address and scan in seconds.
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Analyze mode is read-only. Manage mode requires the owner wallet.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill tone="info">Sepolia testnet</StatusPill>
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Scan Treasury
                    <ScanLine className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
