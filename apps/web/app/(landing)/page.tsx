import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  RadioTower,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicTreasurySearch } from "@/components/treasury/public-treasury-search";

const pillars = [
  {
    title: "AI Treasury Intelligence",
    description:
      "Connect once, then inspect any public treasury, score concentration and stress risk, and receive an operator-grade brief.",
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
    title: "Execution Verification",
    description:
      "Every verified execution is recorded with its report hash, receipt, and inspectable verification trail — no custody, no hidden steps.",
    icon: RadioTower,
    href: "/proof-attestation",
    cta: "View execution history",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfbfd]">
      <section className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div aria-hidden className="absolute inset-x-0 top-8 -z-0 mx-auto h-[440px] max-w-4xl rounded-full bg-violet-200/30 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-4xl text-center animate-slide-up">
          <p className="text-sm font-semibold tracking-wide text-violet-700">Treasury portfolio intelligence</p>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-7xl">
            Know what your treasury holds.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-500">
            A clear view of balances, allocations, risk, and owner-controlled DeFi actions—built for teams that need to understand before they move.
          </p>
          <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3">
            <PublicTreasurySearch />
            <Button asChild variant="ghost" size="sm">
              <Link href="/how-it-works">See how TreasuryOS works <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-20 w-full max-w-5xl animate-slide-up">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">TreasuryOS, at a glance</p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
            {pillars.map((pillar) => (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="group bg-white p-7 transition hover:bg-violet-50/50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 transition group-hover:bg-violet-200">
                  <pillar.icon className="h-5 w-5 text-violet-700" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-white">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{pillar.description}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-violet-700 transition group-hover:text-violet-800">
                  {pillar.cta}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-600" /> No custody</span>
          <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-violet-600" /> You sign every transaction</span>
          <Link className="inline-flex items-center gap-2 font-medium text-violet-700 hover:text-violet-900" href="/proof-attestation"><RadioTower className="h-4 w-4" /> View public proofs</Link>
        </div>
      </section>
    </main>
  );
}
