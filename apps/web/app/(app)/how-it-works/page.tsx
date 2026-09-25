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
    <div className="min-h-screen bg-transparent">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="text-xl font-bold text-foreground font-display">TreasuryOS</span>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <Badge variant="outline" className="mb-5 border-accent/30 text-primary">
                How it works
              </Badge>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                Understand any treasury. Execute only your own.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
                Inspect any supported public treasury without connecting a wallet.
                A wallet is required only for execution, and it must own the
                treasury currently being viewed.
              </p>
            </div>

            <div className="rounded-xl border border-accent/20 privacy-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <Link href="/verification">View Proof History</Link>
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
          <Card className="rounded-xl privacy-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Execution guardrails
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">
                    What must be true before funds can move
                  </h2>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {guardrails.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl privacy-card overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proof pipeline
                  </p>
                  <h2 className="text-lg font-semibold text-foreground">
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
        "rounded-xl privacy-card",
        highlighted ? "border-accent/30" : "border-border"
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
              highlighted ? "bg-secondary text-primary" : "bg-muted/20 text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
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
    <div className="grid gap-3 rounded-lg border privacy-card sm:grid-cols-[36px_1fr]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/20 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-mono-ui text-xs uppercase tracking-wide text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{step.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
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
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-px privacy-card">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <Icon className="h-4 w-4 text-primary" />
              <span className="font-mono-ui text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">{step.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
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
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "success" ? "text-emerald-400" : "text-muted-foreground"}>
        {value}
      </span>
    </div>
  );
}
