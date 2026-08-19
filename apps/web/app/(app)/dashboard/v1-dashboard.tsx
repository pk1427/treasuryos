"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Table2,
  Loader2,
  TriangleAlert,
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
import { cn } from "@/lib/utils";
import { HashValue, StatusPill, WorkflowStepper } from "@/components/ui/treasury-primitives";
import { useTreasurySession } from "@/components/treasury/session-context";

const LOADING_STEPS = [
  "Scanning wallet balances",
  "Reading DeFi positions",
  "Running stress scenarios",
  "Calculating risk drivers",
  "Generating report hash",
] as const;
const MANAGE_LIFECYCLE = ["Discover", "Analyze", "Plan", "Execute", "Record"] as const;
const ANALYZE_LIFECYCLE = ["Discover", "Analyze", "Understand"] as const;
const REPORT_REQUEST_TIMEOUT_MS = 60_000;

type StepState = "idle" | "loading" | "done" | "error";
type Mode = "analyze" | "manage";

export function V1Dashboard() {
  const searchParams = useSearchParams();
  const session = useTreasurySession();
  const {
    analyzedAddress: address,
    setAnalyzedAddress: setAddress,
    reportResponse,
    setReportResponse,
    riskV2,
    setRiskV2,
  } = session;
  const [reportState, setReportState] = useState<StepState>("idle");
  const [loadingCopy, setLoadingCopy] = useState(LOADING_STEPS[0]);
  const [error, setError] = useState<string | null>(null);
  const requestedAddress = useRef<string | null>(null);

  const report = reportResponse?.report;
  const searchAddress = searchParams.get("address") ?? "";

  const largestPosition = useMemo(() => {
    if (!report) return null;
    return (
      [...report.snapshot.positions].sort(
        (a, b) => b.amountUsd - a.amountUsd
      )[0] ?? null
    );
  }, [report]);

  const exposure = useMemo(() => {
    if (!report || !largestPosition || report.snapshot.totalValueUsd <= 0)
      return 0;
    return largestPosition.amountUsd / report.snapshot.totalValueUsd;
  }, [report, largestPosition]);

  const primaryRisk = useMemo(() => {
    if (!riskV2) return null;
    return (
      [...riskV2.compositeRisk.factors].sort(
        (a, b) => severityRank(b.severity) - severityRank(a.severity)
      )[0] ?? null
    );
  }, [riskV2]);
  const criticalRiskActive = primaryRisk?.severity === "critical";

  async function generateReport(inputAddress = address) {
    if (!inputAddress.trim()) {
      setError("Enter a treasury address to analyze.");
      return;
    }

    setAddress(inputAddress.trim());
    setError(null);
    setReportState("loading");
    setReportResponse(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        REPORT_REQUEST_TIMEOUT_MS
      );
      const responsePromise = fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: inputAddress.trim() }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));

      const [response] = await Promise.all([
        responsePromise,
        playLoadingSequence(setLoadingCopy as (copy: string) => void),
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

  // The request ref intentionally prevents duplicate scans for the same query address.
  useEffect(() => {
    const target = searchAddress.trim();
    if (!target || reportState !== "idle") return;
    if (report?.address?.toLowerCase() === target.toLowerCase()) return;
    if (requestedAddress.current === target.toLowerCase()) return;
    requestedAddress.current = target.toLowerCase();
    void generateReport(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAddress, report?.address, reportState]);


  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {reportState === "loading" ? (
          <StagedScanBanner activeStep={loadingCopy} />
        ) : error ? (
          <StatusBanner tone="critical" icon={TriangleAlert}>
            {error}
          </StatusBanner>
        ) : report ? (
          <OverviewReport
            report={report}
            primaryRisk={primaryRisk}
            criticalRiskActive={criticalRiskActive}
            largestPosition={largestPosition}
            exposure={exposure}
            riskV2={riskV2}
          />
        ) : (
          <EmptyOverview />
        )}
      </main>
    </div>
  );
}

function PortfolioIdentity({ report }: { report: RiskReport }) {
  return (
    <section className="border-b border-slate-200 pb-8">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-violet-200 bg-violet-50 text-2xl font-semibold text-violet-700">▦</div>
        <div>
          <h2 className="font-mono text-2xl font-semibold text-slate-950">
            {report.address.slice(0, 6)}...{report.address.slice(-4)}
          </h2>
          <p className="mt-1 text-slate-500">Public treasury portfolio and risk profile</p>
        </div>
      </div>
      <dl className="mt-8 flex flex-wrap gap-x-16 gap-y-5 text-sm">
        <div><dt className="text-slate-400">Portfolio value</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{usd(report.snapshot.totalValueUsd)}</dd></div>
        <div><dt className="text-slate-400">Positions</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{report.snapshot.positions.length}</dd></div>
        <div><dt className="text-slate-400">Report</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">Current snapshot</dd></div>
      </dl>
      <div className="mt-8 flex items-center gap-7 border-t border-slate-200 pt-6 text-sm font-medium text-violet-700">
        <Link href="/positions">Positions <span className="ml-1 text-slate-400">{report.snapshot.positions.length}</span></Link>
        <Link href="/stream">Activity</Link>
      </div>
    </section>
  );
}

function OverviewReport({
  report,
  primaryRisk,
  criticalRiskActive,
  largestPosition,
  exposure,
  riskV2,
}: {
  report: RiskReport;
  primaryRisk: RiskFactor | StressRiskFactor | null;
  criticalRiskActive: boolean;
  largestPosition: TreasuryPosition | null;
  exposure: number;
  riskV2: RiskReportV2 | null;
}) {
  const factors = riskV2?.compositeRisk.factors ?? [];
  return (
    <div className="space-y-14">
      <PortfolioIdentity report={report} />
      <section>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Portfolio overview</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{primaryRisk?.title ?? "Treasury snapshot"}</h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-500">{primaryRisk?.description ?? "Current balances, allocation, and risk signals for this treasury."}</p>
          </div>
          <Badge variant={criticalRiskActive ? "critical" : ratingVariant(report.score.rating)} className="normal-case">{criticalRiskActive ? "Critical" : report.score.rating}</Badge>
        </div>
        <dl className="mt-10 grid gap-6 border-y border-slate-200 py-7 sm:grid-cols-3">
          <div><dt className="text-sm text-slate-400">Total value</dt><dd className="mt-2 text-2xl font-semibold text-slate-950">{usd(report.snapshot.totalValueUsd)}</dd></div>
          <div><dt className="text-sm text-slate-400">Largest holding</dt><dd className="mt-2 text-2xl font-semibold text-slate-950">{largestPosition ? `${largestPosition.asset} · ${percent(exposure)}` : "—"}</dd></div>
          <div><dt className="text-sm text-slate-400">Risk drivers</dt><dd className="mt-2 text-2xl font-semibold text-slate-950">{factors.length}</dd></div>
        </dl>
      </section>
      <RiskAndSimulation riskV2={riskV2} report={report} />
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
        <Link href="/positions" className="text-sm font-medium text-violet-700 hover:text-violet-900">View full portfolio</Link>
        <Button asChild><Link href="/execution">Review execution <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
    </div>
  );
}

function EmptyOverview() {
  return (
    <section className="mx-auto max-w-xl py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Portfolio</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Choose a treasury to inspect.</h1>
      <p className="mt-4 text-slate-500">Start from the homepage and enter a public treasury address. TreasuryOS will load its current portfolio and risk profile here.</p>
      <Button asChild className="mt-8"><Link href="/">Inspect a treasury</Link></Button>
    </section>
  );
}

function TreasuryHealthCard({
  report,
  reportHash,
  primaryRisk,
  criticalRiskActive,
  recommendedAction,
  executionUnlocked,
  mode,
  executableActions,
  actionsLoading,
  actionsError,
  hasEthPosition,
  onSwitchToManage,
}: {
  report: RiskReport;
  reportHash?: string;
  primaryRisk: RiskFactor | StressRiskFactor | null;
  criticalRiskActive: boolean;
  recommendedAction: {
    title: string;
    description: string;
    cta: string | null;
    ctaHref: string;
  };
  executionUnlocked: boolean;
  mode: Mode;
  executableActions: Array<{ label: string; fromAsset: string; toAsset: string }>;
  actionsLoading: boolean;
  actionsError: string | null;
  hasEthPosition: boolean;
  onSwitchToManage: () => void;
}) {
  const riskGrade = criticalRiskActive
    ? "CRITICAL"
    : report.score.rating ?? "--";

  return (
    <Card className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Badge
              variant={
                criticalRiskActive
                  ? "critical"
                  : report
                    ? ratingVariant(report.score.rating)
                    : "default"
              }
              className="px-4 py-2 text-2xl font-bold"
            >
              {riskGrade}
            </Badge>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Treasury Health
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {primaryRisk?.title ?? "Scan a treasury to assess risk"}
              </p>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                {primaryRisk?.description ??
                  "Analyze any address read-only, then switch to Manage mode when you are ready to operate your own treasury."}
              </p>
              {criticalRiskActive && report ? (
                <p className="mt-2 text-xs text-amber-200">
                  Critical driver active. Base grade: {report.score.rating}.
                </p>
              ) : null}
            </div>
          </div>
          <HashValue label="Report hash" value={reportHash} compact />
        </div>

        <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
            {mode === "manage" ? "Recommended Action" : "Operator Insight"}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">
                {recommendedAction.title}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {recommendedAction.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={executionUnlocked ? "low" : "medium"}
                className="normal-case"
              >
                {executionUnlocked
                  ? "Execution available"
                  : "Execution locked"}
              </Badge>
              {recommendedAction.cta ? (
                <Button
                  variant="secondary"
                  size="sm"
                  asChild={recommendedAction.ctaHref !== "#"}
                >
                  {recommendedAction.ctaHref !== "#" ? (
                    <Link href={recommendedAction.ctaHref}>
                      {recommendedAction.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button type="button" onClick={onSwitchToManage}>
                      {recommendedAction.cta}
                    </button>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {actionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning for executable actions...
            </div>
          ) : actionsError ? (
            <div className="flex items-center gap-2 text-sm text-red-300">
              <TriangleAlert className="h-4 w-4" />
              {actionsError}
            </div>
          ) : executableActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {executableActions.map((action, index) => (
                <Link
                  key={index}
                  href="/execution"
                  className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200 transition hover:border-emerald-400/30 hover:bg-emerald-400/10"
                >
                  <Activity className="h-4 w-4" />
                  <span className="font-medium">
                    {action.label || `${action.fromAsset} → ${action.toAsset}`}
                  </span>
                  <span className="text-xs text-emerald-300/70">
                    route verified
                  </span>
                </Link>
              ))}
            </div>
          ) : hasEthPosition ? (
            <Link
              href="/execution"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            >
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="font-medium">Execution Plan</span>
              <span className="text-xs text-zinc-500">
                ETH detected — review plan for swap options
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Activity className="h-4 w-4" />
              <span>No executable action detected for this treasury</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PortfolioSummary({
  report,
  largestPosition,
  exposure,
  network,
  managedWallet,
  ownerVerified,
}: {
  report: RiskReport;
  largestPosition: TreasuryPosition | null;
  exposure: number;
  network: string;
  managedWallet: string | null;
  ownerVerified: boolean;
}) {
  const positions = report.snapshot.positions;
  const walletPositions = positions.filter((p) => p.protocol === "Wallet");
  const protocolPositions = positions.filter((p) => p.protocol !== "Wallet");

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Table2 className="h-5 w-5 text-cyan-300" />
          Portfolio Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase text-zinc-500">Total Value</p>
            <p className="font-mono text-2xl font-semibold text-zinc-100">
              {usd(report.snapshot.totalValueUsd)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-zinc-500">Network</p>
            <p className="text-sm font-medium text-zinc-300">{network}</p>
          </div>
        </div>

        {largestPosition && (
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase text-zinc-500">
                Largest Exposure
              </p>
              <p className="font-mono text-lg font-semibold text-zinc-100">
                {largestPosition.asset}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-zinc-500">Allocation</p>
              <p className="font-mono text-lg font-semibold text-zinc-100">
                {percent(exposure)}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-zinc-500">
              Managed Wallet
            </p>
            <p className="font-mono text-sm text-zinc-300">
              {managedWallet
                ? `${managedWallet.slice(0, 6)}...${managedWallet.slice(-4)}`
                : "--"}
            </p>
          </div>
          <StatusPill
            tone={ownerVerified ? "success" : "neutral"}
            className="normal-case"
          >
            {ownerVerified ? "Owner verified" : "Unverified"}
          </StatusPill>
        </div>

        <div className="flex items-center gap-4 pt-2 text-xs text-zinc-500">
          <span>{positions.length} positions</span>
          <span>·</span>
          <span>{walletPositions.length} wallet</span>
          <span>·</span>
          <span>{protocolPositions.length} protocol</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LifecycleStrip({
  mode,
  executionUnlocked,
  hasReport,
}: {
  mode: Mode;
  executionUnlocked: boolean;
  hasReport: boolean;
}) {
  const steps =
    mode === "manage" ? MANAGE_LIFECYCLE : ANALYZE_LIFECYCLE;

  let activeStep: string;
  let completedThrough: number;

  if (mode === "analyze") {
    activeStep = hasReport ? "Analyze" : "Discover";
    completedThrough = hasReport ? 1 : 0;
  } else {
    if (executionUnlocked) {
      activeStep = "Execute";
      completedThrough = 3;
    } else {
      activeStep = "Plan";
      completedThrough = 2;
    }
  }

  return (
    <div className="flex items-center gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Workflow
      </p>
      <div className="flex-1">
        <WorkflowStepper
          steps={steps}
          activeStep={activeStep}
          completedThrough={completedThrough}
        />
      </div>
    </div>
  );
}

function RiskAndSimulation({
  riskV2,
  report,
}: {
  riskV2: RiskReportV2 | null;
  report?: RiskReport;
}) {
  const factors = riskV2?.compositeRisk.factors ?? [];
  const [showAllFactors, setShowAllFactors] = useState(false);
  const visibleFactors = showAllFactors ? factors : factors.slice(0, 3);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <Card className="rounded-xl bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <TriangleAlert className="h-5 w-5 text-amber-300" />
            Risk Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniScore label="Concentration" value={report?.score.concentration} />
            <MiniScore label="Counterparty" value={report?.score.counterparty} />
            <MiniScore label="Liquidity" value={report?.score.liquidity} />
          </div>
          <div className="mt-5 divide-y divide-slate-200">
            {factors.length > 0 ? (
              visibleFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-start gap-3 py-4 first:pt-0"
                >
                  <Badge
                    variant={severityVariant(factor.severity)}
                    className="normal-case"
                  >
                    {factor.severity}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {factor.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {factor.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No risk drivers detected.</p>
            )}
          </div>
          {factors.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllFactors((value) => !value)}
              className="mt-5 text-sm font-medium text-violet-700 transition hover:text-violet-900"
            >
              {showAllFactors ? "Show fewer risk drivers" : `View full risk report (${factors.length} drivers)`}
            </button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-violet-300" />
            Stress Simulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="divide-y divide-slate-200">
              {report.stressResults
                .slice()
                .sort((a, b) => stressLoss(b) - stressLoss(a))
                .map((result) => (
                  <div
                    key={result.scenario}
                    className="flex items-center justify-between gap-3 py-4 first:pt-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-100">
                        {scenarioLabel(result.scenario)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-500">
                        {usd(result.currentValueUsd)} →{" "}
                        {usd(result.stressedValueUsd)}
                      </p>
                    </div>
                    <Badge variant={lossVariant(result)} className="normal-case">
                      -{percent(stressLoss(result))}
                    </Badge>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Stress results appear after scanning.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerformancePlaceholder() {
  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-400">
          Historical PnL and period comparisons are not available yet. TreasuryOS
          does not estimate performance from a single portfolio snapshot.
        </p>
      </CardContent>
    </Card>
  );
}

function StagedScanBanner({ activeStep }: { activeStep: (typeof LOADING_STEPS)[number] }) {
  const activeIndex = Math.max(LOADING_STEPS.indexOf(activeStep), 0);

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-violet-200 bg-white p-6 shadow-[0_18px_50px_rgba(76,29,149,0.08)] sm:p-8">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-100">
          <Loader2 className="h-5 w-5 animate-spin text-violet-700" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Preparing portfolio</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{activeStep}</p>
        </div>
      </div>
      <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-500"
          style={{ width: `${((activeIndex + 1) / LOADING_STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {LOADING_STEPS.map((step, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li key={step} className={cn("flex items-center gap-3 text-sm", current ? "font-medium text-violet-700" : complete ? "text-slate-700" : "text-slate-400")}>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs", complete ? "bg-emerald-100 text-emerald-700" : current ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400")}>
                {complete ? "✓" : index + 1}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-5 py-8 text-center">
      <div className="mb-3 rounded-xl border border-white/10 bg-zinc-950 p-2.5">
        <Icon className="h-5 w-5 text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value?: number }) {
  const score = value ?? 0;
  return (
    <div className="min-w-0 px-1 py-2 sm:border-r sm:border-slate-200 sm:px-4 sm:first:pl-1 sm:last:border-r-0">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs uppercase text-zinc-500">
          {label}
        </p>
        <p className="shrink-0 font-mono text-sm text-zinc-200">
          {value ?? "--"}
        </p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
        <div
          className={cn("h-1.5 rounded-full", severityColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatusBanner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "info" | "critical";
  icon: LucideIcon;
  children: ReactNode;
}) {
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
    setCopy(copy as string);
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

function severityVariant(
  severity: string
): "low" | "medium" | "high" | "critical" | "default" {
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
