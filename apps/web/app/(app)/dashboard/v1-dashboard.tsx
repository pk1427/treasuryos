"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  FileJson,
  Loader2,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Table2,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type {
  RiskFactor,
  RiskReport,
  RiskReportV2,
  StressRiskFactor,
  TreasuryPosition,
} from "@treasuryos/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, shortenHash } from "@/lib/utils";
import { TreasuryBriefing } from "@/components/treasury/treasury-briefing";
import { TrustRail } from "@/components/treasury/trust-rail";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";

const LOADING_STEPS = [
  "Scanning wallet balances",
  "Reading DeFi positions",
  "Running stress scenarios",
  "Calculating risk drivers",
  "Generating report hash",
];
const MANAGE_LIFECYCLE = ["Discover", "Analyze", "Plan", "Execute", "Attest"] as const;
const ANALYZE_LIFECYCLE = ["Discover", "Analyze", "Understand"] as const;
const REPORT_REQUEST_TIMEOUT_MS = 60_000;

type StepState = "idle" | "loading" | "done" | "error";
type Mode = "analyze" | "manage";

export function V1Dashboard() {
  const wallet = useWallet();
  const session = useTreasurySession();
  const {
    mode,
    setMode,
    analyzedAddress: address,
    setAnalyzedAddress: setAddress,
    reportResponse,
    setReportResponse,
    riskV2,
    setRiskV2,
    setKeeperHubSimulation: setSimulation,
    setAttestation,
    setSimulateState,
    setPublishState,
  } = session;
  const [reportState, setReportState] = useState<StepState>("idle");
  const [loadingCopy, setLoadingCopy] = useState(LOADING_STEPS[0]);
  const [error, setError] = useState<string | null>(null);

  const report = reportResponse?.report;
  const reportHash = reportResponse?.reportHash;
  const network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";
  const ownerVerified =
    Boolean(wallet.address && report?.address) &&
    wallet.address!.toLowerCase() === report!.address.toLowerCase();
  const executionUnlocked = mode === "manage" && ownerVerified;

  const largestPosition = useMemo(() => {
    if (!report) return null;
    return [...report.snapshot.positions].sort((a, b) => b.amountUsd - a.amountUsd)[0] ?? null;
  }, [report]);

  const exposure = report && largestPosition && report.snapshot.totalValueUsd > 0
    ? largestPosition.amountUsd / report.snapshot.totalValueUsd
    : 0;

  const primaryRisk = useMemo(() => {
    if (!riskV2) return null;
    return [...riskV2.compositeRisk.factors].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity)
    )[0] ?? null;
  }, [riskV2]);

  const topPositions = useMemo(
    () => (report ? [...report.snapshot.positions].sort((a, b) => b.amountUsd - a.amountUsd).slice(0, 4) : []),
    [report]
  );

  async function generateReport(inputAddress = address) {
    if (!inputAddress.trim()) {
      setError("Enter a treasury address to analyze.");
      return;
    }

    setAddress(inputAddress.trim());
    setError(null);
    setReportState("loading");
    setSimulateState("idle");
    setPublishState("idle");
    setReportResponse(null);
    setSimulation(null);
    setAttestation(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS);
      const responsePromise = fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: inputAddress.trim() }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));

      const [response] = await Promise.all([
        responsePromise,
        playLoadingSequence(setLoadingCopy),
      ]);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Report generation failed");
      }

      setReportResponse(data);
      setRiskV2(data.riskV2 ?? null);
      setReportState("done");
    } catch (caught) {
      setError(reportErrorMessage(caught));
      setReportState("error");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                TreasuryOS Command Center
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                Institutional treasury intelligence and execution
              </h1>
            </div>
            <ModeSwitcher
              mode={mode}
              analyzedAddress={report?.address ?? address}
              connectedWallet={wallet.address}
              ownerVerified={ownerVerified}
              onAnalyze={() => setMode("analyze")}
              onManage={async () => {
                if (!wallet.address) await wallet.connect();
              }}
            />
          </div>
          <SessionBlock
            mode={mode}
            analyzedAddress={report?.address ?? address}
            connectedWallet={wallet.address}
            ownerVerified={ownerVerified}
            network={network}
          />
        </div>
      </header>

<main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase text-zinc-500">
              {mode === "analyze" ? "Analyze treasury address" : "Managed treasury address"}
            </span>
             <input
               value={address}
               onChange={(event) => setAddress(event.target.value)}
               placeholder="Paste any Ethereum address"
               className="h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-cyan-400"
             />
           </label>
           <div className="flex flex-wrap items-center gap-2">
             <Badge variant="outline" className="h-10 px-3 text-emerald-300">
               Network: {network}
             </Badge>
             <Button onClick={() => generateReport()} disabled={reportState === "loading"}>
               {reportState === "loading" ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
               ) : (
                 <ScanLine className="h-4 w-4" />
               )}
               Scan Treasury
             </Button>
           </div>
         </section>

        {reportState === "loading" ? (
          <StagedScanBanner activeStep={loadingCopy} />
        ) : null}

         {error ? (
           <StatusBanner tone="critical" icon={TriangleAlert}>
             {error}
           </StatusBanner>
         ) : null}

        <CommandCenter
            mode={mode}
            report={report}
            reportHash={reportHash}
            primaryRisk={primaryRisk}
            largestPosition={largestPosition}
            exposure={exposure}
            topPositions={topPositions}
            ownerVerified={ownerVerified}
            executionUnlocked={executionUnlocked}
            onAnalyze={() => setMode("analyze")}
            onManage={async () => {
              if (!wallet.address) await wallet.connect();
            }}
        />

         <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
           <div className="space-y-6">
             <SectionCard
               id="risk"
               icon={TriangleAlert}
               title="Risk & Simulation"
               description="One consolidated view of risk drivers and stress sensitivity."
             >
               <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                 <RiskDrivers riskV2={riskV2} report={report} />
                 <StressRanking report={report} />
               </div>
             </SectionCard>
           </div>

           <aside className="space-y-6">
             <TrustRail mode={mode} ownerVerified={ownerVerified} />

             <SectionCard
               icon={FileJson}
               title="AI Treasury Brief"
               description="Advisory analysis only. Execution remains deterministic."
             >
               {report ? (
                 <TreasuryBriefing address={report.address} />
               ) : (
                 <EmptyState icon={FileJson} text="Scan a treasury to generate an AI brief." />
               )}
             </SectionCard>
           </aside>
         </div>
       </main>
    </div>
  );
}

function SessionBlock({
  mode,
  analyzedAddress,
  connectedWallet,
  ownerVerified,
  network,
}: {
  mode: Mode;
  analyzedAddress: string;
  connectedWallet: string | null;
  ownerVerified: boolean;
  network: string;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase text-zinc-500">Mode</p>
        <p className="mt-1 text-sm font-medium text-zinc-200">
          {mode === "analyze" ? "Analyze" : "Manage"}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase text-zinc-500">Treasury</p>
        <p className="mt-1 font-mono text-sm text-zinc-200">
          {analyzedAddress ? shortenAddress(analyzedAddress) : "--"}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase text-zinc-500">Network</p>
        <p className="mt-1 text-sm font-medium text-zinc-200">{network}</p>
      </div>
      {mode === "manage" ? (
        <>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-zinc-500">Owner</p>
            <p className="mt-1 text-sm font-medium text-emerald-300">
              {ownerVerified ? "Verified" : "Unverified"}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase text-zinc-500">Wallet</p>
            <p className="mt-1 font-mono text-sm text-zinc-200">
              {connectedWallet ? shortenAddress(connectedWallet) : "--"}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ModeSwitcher({
  mode,
  analyzedAddress,
  connectedWallet,
  ownerVerified,
  onAnalyze,
  onManage,
}: {
  mode: Mode;
  analyzedAddress: string;
  connectedWallet: string | null;
  ownerVerified: boolean;
  onAnalyze: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
      <Button
        type="button"
        variant={mode === "analyze" ? "secondary" : "ghost"}
        size="sm"
        onClick={onAnalyze}
      >
        <ScanLine className="h-4 w-4" />
        Analyzing: {analyzedAddress ? shortenAddress(analyzedAddress) : "none"}
      </Button>
      <Button
        type="button"
        variant={mode === "manage" ? "secondary" : "ghost"}
        size="sm"
        onClick={onManage}
      >
        <ShieldCheck className="h-4 w-4" />
        {connectedWallet ? shortenAddress(connectedWallet) : "Manage"}
        {ownerVerified ? " ✓" : ""}
      </Button>
    </div>
  );
}

function CommandCenter({
  mode,
  report,
  reportHash,
  primaryRisk,
  largestPosition,
  exposure,
  topPositions,
  ownerVerified,
  executionUnlocked,
  onAnalyze,
  onManage,
}: {
  mode: Mode;
  report?: RiskReport;
  reportHash?: string;
  primaryRisk: RiskFactor | StressRiskFactor | null;
  largestPosition: TreasuryPosition | null;
  exposure: number;
  topPositions: TreasuryPosition[];
  ownerVerified: boolean;
  executionUnlocked: boolean;
  onAnalyze: () => void;
  onManage: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
      <div className="grid gap-px bg-white/10 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="bg-zinc-950 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Treasury Health
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Badge
                  variant={report ? ratingVariant(report.score.rating) : "default"}
                  className="px-4 py-2 text-3xl font-bold"
                >
                  {report?.score.rating ?? "--"}
                </Badge>
                <div>
                  <p className="text-lg font-semibold text-zinc-100">
                    {primaryRisk?.title ?? "Scan a treasury to assess risk"}
                  </p>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    {primaryRisk?.description ??
                      "Analyze any address read-only, then switch to Manage mode when you are ready to operate your own treasury."}
                  </p>
                </div>
              </div>
            </div>
            {reportHash ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-xs uppercase text-zinc-500">Report hash</p>
                <p className="mt-1 font-mono text-xs text-zinc-300">
                  {shortenHash(reportHash)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
              {mode === "manage" ? "Recommended Action" : "Operator Insight"}
            </p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-lg font-semibold text-white">
                {report && largestPosition
                  ? largestPosition.asset === "ETH" && exposure >= 0.7
                    ? `Reduce ETH exposure from ${percent(exposure)} toward 70%`
                    : `Monitor ${largestPosition.asset} exposure at ${percent(exposure)}`
                  : "No action available until a treasury is scanned"}
              </p>
              {mode === "analyze" ? (
                <Button variant="secondary" size="sm" onClick={onManage}>
                  <Wallet className="h-4 w-4" />
                  Switch to Manage
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant={executionUnlocked ? "low" : "medium"} className="normal-case">
                    {ownerVerified ? "Ownership verified" : "Execution locked"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={onAnalyze}>
                    Analyze Another Treasury
                  </Button>
                </div>
              )}
            </div>
          </div>

          <LifecycleStrip mode={mode} executionUnlocked={executionUnlocked} />

          <div className="mt-4 flex flex-wrap gap-2">
            <LinkCard href="/positions" icon={Table2} label="Positions" description="View full treasury inventory" />
            <LinkCard href="/execution" icon={Activity} label="Execution Plan" description="Pre-trade ticket and execution" />
            <LinkCard href="/proof-attestation" icon={RadioTower} label="Proof & Attestation" description="Attestation history and proof trail" />
          </div>
        </div>

        <div className="bg-zinc-950 p-5 sm:p-6">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <CommandMetric label="Total Value" value={report ? usd(report.snapshot.totalValueUsd) : "--"} />
            <CommandMetric
              label="Largest Exposure"
              value={largestPosition ? `${largestPosition.asset} ${percent(exposure)}` : "--"}
            />
            <CommandMetric label="Composite Risk" value={report ? `${report.score.composite}/100` : "--"} />
          </div>
        </div>
      </div>

      {topPositions.length > 0 ? (
        <div className="border-t border-white/10 bg-zinc-950 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Top Positions
          </p>
          <div className="grid gap-2 md:grid-cols-4">
            {topPositions.map((position) => (
              <div key={`${position.protocol}-${position.asset}-${position.amountUsd}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-zinc-100">{position.asset}</p>
                <p className="mt-1 text-xs text-zinc-500">{position.protocol}</p>
                <p className="mt-2 font-mono text-sm text-zinc-200">{usd(position.amountUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LinkCard({ href, icon: Icon, label, description }: { href: string; icon: LucideIcon; label: string; description: string }) {
  return (
    <Link href={href} className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-300" />
        <p className="text-sm font-medium text-zinc-200">{label}</p>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </Link>
  );
}

function LifecycleStrip({ mode, executionUnlocked }: { mode: Mode; executionUnlocked: boolean }) {
  const steps = mode === "manage" ? MANAGE_LIFECYCLE : ANALYZE_LIFECYCLE;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const active = mode === "manage" && step === "Execute" && executionUnlocked;
        return (
          <div
            key={step}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              active
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-current text-[10px] text-zinc-950">
              {index + 1}
            </span>
            {step}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="rounded-xl bg-zinc-900/70">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-cyan-300" />
          {title}
        </CardTitle>
        <p className="text-sm text-zinc-400">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RiskDrivers({ riskV2, report }: { riskV2: RiskReportV2 | null; report?: RiskReport }) {
  const factors = riskV2?.compositeRisk.factors ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreMini label="Concentration" value={report?.score.concentration} />
        <ScoreMini label="Counterparty" value={report?.score.counterparty} />
        <ScoreMini label="Liquidity" value={report?.score.liquidity} />
      </div>
      <div className="space-y-2">
        {factors.length > 0 ? (
          factors.slice(0, 5).map((factor) => (
            <div key={factor.id} className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
              <div className="flex items-start gap-3">
                <Badge variant={severityVariant(factor.severity)} className="normal-case">
                  {factor.severity}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-zinc-100">{factor.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{factor.description}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={TriangleAlert} text="Risk drivers appear after scanning." />
        )}
      </div>
    </div>
  );
}

function StressRanking({ report }: { report?: RiskReport }) {
  if (!report) {
    return <EmptyState icon={Activity} text="Stress ranking appears after scanning." />;
  }

  return (
    <div className="space-y-2">
      {report.stressResults
        .slice()
        .sort((a, b) => stressLoss(b) - stressLoss(a))
        .map((result) => (
          <div key={result.scenario} className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-100">{scenarioLabel(result.scenario)}</p>
              <Badge variant={lossVariant(result)} className="normal-case">
                -{percent(stressLoss(result))}
              </Badge>
            </div>
            <div className="mt-3 h-2 rounded-full bg-zinc-800">
              <div
                className={cn("h-2 rounded-full", severityColor(stressLoss(result) * 100))}
                style={{ width: `${Math.min(stressLoss(result) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              {usd(result.currentValueUsd)} → {usd(result.stressedValueUsd)}
            </p>
          </div>
        ))}
    </div>
  );
}

function CommandMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 p-4 last:border-b-0">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value?: number }) {
  const score = value ?? 0;
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-zinc-950/50 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 truncate text-xs uppercase text-zinc-500" title={label}>{label}</p>
        <p className="shrink-0 font-mono text-sm text-zinc-200">{value ?? "--"}</p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
        <div className={cn("h-1.5 rounded-full", severityColor(score))} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function StagedScanBanner({ activeStep }: { activeStep: string }) {
  const activeIndex = Math.max(LOADING_STEPS.indexOf(activeStep), 0);

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        {activeStep}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {LOADING_STEPS.map((step, index) => (
          <div
            key={step}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              index <= activeIndex
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-zinc-950/40 text-zinc-500"
            )}
          >
            {step}
          </div>
        ))}
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

function StatusBanner({ tone, icon: Icon, children }: { tone: "info" | "critical"; icon: LucideIcon; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
        tone === "info"
          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
          : "border-red-500/30 bg-red-500/10 text-red-200"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </div>
  );
}

function reportErrorMessage(caught: unknown): string {
  if (caught instanceof Error && caught.name === "AbortError") {
    return "Report generation timed out. Check the Sepolia RPC configuration and try again.";
  }
  return caught instanceof Error ? caught.message : "Report failed";
}

async function playLoadingSequence(setCopy: (copy: string) => void) {
  for (const copy of LOADING_STEPS) {
    setCopy(copy);
    await delay(475);
  }
}

function ratingVariant(rating: RiskReport["score"]["rating"]) {
  if (rating === "N/A") return "default";
  if (rating === "A" || rating === "B") return "low";
  if (rating === "C") return "medium";
  if (rating === "D") return "high";
  return "critical";
}

function lossVariant(result: RiskReport["stressResults"][number]) {
  const loss = stressLoss(result);
  if (loss < 0.15) return "low";
  if (loss < 0.3) return "medium";
  if (loss < 0.5) return "high";
  return "critical";
}

function stressLoss(result: RiskReport["stressResults"][number]) {
  return result.currentValueUsd > 0
    ? (result.currentValueUsd - result.stressedValueUsd) / result.currentValueUsd
    : 0;
}

function severityRank(severity: string) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function severityVariant(severity: string): "low" | "medium" | "high" | "critical" | "default" {
  switch (severity) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return "default";
  }
}

function severityColor(score: number): string {
  if (score < 35) return "bg-emerald-500";
  if (score < 70) return "bg-amber-500";
  return "bg-red-500";
}

function scenarioLabel(scenario: string): string {
  return scenario
    .replace("ETH_-50", "ETH -50%")
    .replace("STABLE_DEPEG_-10", "Stablecoin depeg -10%")
    .replace("PROTOCOL_FAILURE", "Protocol failure");
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
