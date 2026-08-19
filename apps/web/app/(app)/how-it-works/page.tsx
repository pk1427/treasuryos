import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  FileJson,
  Hash,
  Lock,
  PenLine,
  RadioTower,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const analyzeFlow = [
  {
    title: "Enter any treasury address",
    body: "No wallet connection is required to inspect a supported public treasury address.",
    icon: ScanLine,
  },
  {
    title: "Scan wallet and DeFi positions",
    body: "TreasuryOS reads balances and supported protocol positions from the configured test network.",
    icon: Wallet,
  },
  {
    title: "Score treasury risk",
    body: "Concentration, counterparty, liquidity, and stress sensitivity are converted into an operator-grade risk view.",
    icon: ShieldCheck,
  },
  {
    title: "Review the treasury",
    body: "Portfolio, positions, risk, stress scenarios, and execution activity remain read-only for any public address.",
    icon: Hash,
  },
];

const manageFlow = [
  {
    title: "Verify owner wallet",
    body: "Execution unlocks only when the connected wallet matches the scanned treasury address. If it does not match, management surfaces stay locked and no transaction can be prepared.",
    icon: BadgeCheck,
  },
  {
    title: "Create a deterministic plan",
    body: "The planner produces a pre-trade ticket for supported Uniswap V3 wallet swaps only.",
    icon: FileCheck2,
  },
  {
    title: "Approve and sign intent",
    body: "Approval and intent signature confirm operator intent. They do not submit a transaction.",
    icon: PenLine,
  },
  {
    title: "Simulate with wallet context",
    body: "The simulation runs from the real owner wallet context before execution is enabled.",
    icon: Waves,
  },
  {
    title: "Execute explicitly",
    body: "The user clicks Execute and signs the wallet transaction. TreasuryOS does not execute autonomously.",
    icon: Send,
  },
  {
    title: "Record and verify",
    body: "The transaction hash and report hash are retained in the TreasuryOS execution record.",
    icon: RadioTower,
  },
];

const guardrails = [
  "No custody: TreasuryOS never holds funds.",
  "No autonomous execution: the owner must click Execute.",
  "No mismatched wallets: execution is locked when owner verification fails.",
  "No hidden AI actions: plans are deterministic pre-trade tickets.",
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-bold text-slate-950">TreasuryOS</span>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <Badge variant="outline" className="mb-5 border-cyan-400/30 text-cyan-300">
                How it works
              </Badge>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                Understand any treasury. Execute only your own.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400">
                Inspect any supported public treasury without connecting a wallet.
                A wallet is required only for execution, and it must own the
                treasury currently being viewed.
              </p>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Current execution scope — Sepolia only
              </p>
              <div className="mt-4 grid gap-3">
                <ScopeRow label="Supported" value="Uniswap V3 wallet swap" tone="success" />
                <ScopeRow label="Pairs" value="ETH ↔ USDC only" tone="success" />
                <ScopeRow label="Not enabled" value="Aave actions, Base, batch actions, x402" tone="muted" />
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open portfolio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/proof-attestation">View Proof History</Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-2">
          <ModePanel
            eyebrow="Public analysis"
            title="Inspect any public treasury"
            body="Enter any supported treasury address. Overview, Positions, risk, stress scenarios, and Activity are public and read-only."
            icon={ScanLine}
            steps={analyzeFlow}
          />
          <ModePanel
            eyebrow="Owner-only execution"
            title="Operate only the treasury your wallet owns"
            body="When the connected wallet matches the scanned treasury, you can create a plan, approve it, simulate it, sign intent, and explicitly submit the transaction."
            icon={ShieldCheck}
            steps={manageFlow}
            highlighted
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-xl bg-zinc-900/70">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Execution guardrails
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    What must be true before funds can move
                  </h2>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {guardrails.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl bg-zinc-900/70 overflow-hidden">
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Proof pipeline
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    A distinct verification record after execution
                  </h2>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ProofPipeline />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function ModePanel({
  eyebrow,
  title,
  body,
  icon: Icon,
  steps,
  highlighted,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  steps: Array<{ title: string; body: string; icon: LucideIcon }>;
  highlighted?: boolean;
}) {
  return (
    <Card
      className={cn(
        "rounded-xl bg-zinc-900/70",
        highlighted ? "border-cyan-400/30" : "border-white/10"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
              highlighted ? "bg-cyan-400/10 text-cyan-300" : "bg-white/[0.04] text-zinc-300"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {steps.map((step, index) => (
            <FlowStep key={step.title} step={step} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FlowStep({
  step,
  index,
}: {
  step: { title: string; body: string; icon: LucideIcon };
  index: number;
}) {
  const Icon = step.icon;

  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3 sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-cyan-300">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-zinc-500">
          {String(index + 1).padStart(2, "0")}
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-100">{step.title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">{step.body}</p>
      </div>
    </div>
  );
}

function ProofPipeline() {
  const steps = [
    { label: "Report", icon: FileJson, description: "Risk report generated and hashed" },
    { label: "Simulate", icon: Waves, description: "Wallet-context simulation executed" },
    { label: "Execute", icon: RadioTower, description: "Wallet transaction submitted" },
    { label: "Verify", icon: BadgeCheck, description: "Receipt and calldata verified" },
    { label: "Record", icon: Sparkles, description: "TreasuryOS execution record saved" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-white/10">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="bg-zinc-950 p-4">
            <div className="flex items-center justify-between gap-3">
              <Icon className="h-4 w-4 text-cyan-300" />
              <span className="font-mono text-xs text-zinc-600">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-100">{step.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function ScopeRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "muted";
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={tone === "success" ? "text-emerald-300" : "text-zinc-300"}>
        {value}
      </span>
    </div>
  );
}
