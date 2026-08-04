"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  FileJson,
  Loader2,
  ScanLine,
  ShieldCheck,
  Table2,
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
import { TreasuryBriefing } from "@/components/treasury/treasury-briefing";
import {
  HashValue,
  StatusPill,
  WorkflowStepper,
} from "@/components/ui/treasury-primitives";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";

const LOADING_STEPS = [
  "Scanning wallet balances",
  "Reading DeFi positions",
  "Running stress scenarios",
  "Calculating risk drivers",
  "Generating report hash",
] as const;
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
    isKeeperHubManaged,
  } = session;
  const [reportState, setReportState] = useState<StepState>("idle");
  const [loadingCopy, setLoadingCopy] = useState(LOADING_STEPS[0]);
  const [error, setError] = useState<string | null>(null);
  const [executableActions, setExecutableActions] = useState<
    Array<{ label: string; fromAsset: string; toAsset: string }>
  >([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);

  const report = reportResponse?.report;
  const reportHash = reportResponse?.reportHash;
  const network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";
  const ownerVerified =
    isKeeperHubManaged ||
    (Boolean(wallet.address && report?.address) &&
      wallet.address!.toLowerCase() === report!.address.toLowerCase());
  const executionUnlocked = mode === "manage" && ownerVerified;

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

  const hasEthPosition = useMemo(() => {
    if (!report) return false;
    return report.snapshot.positions.some(
      (p) => p.protocol === "Wallet" && p.asset === "ETH" && p.amountUsd > 0
    );
  }, [report]);

  async function fetchExecutableActions(targetAddress: string) {
    setActionsLoading(true);
    setActionsError(null);
    try {
      const response = await fetch("/api/executable-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to discover actions");
      }
      setExecutableActions(data.actions ?? []);
    } catch (caught) {
      setActionsError(
        caught instanceof Error ? caught.message : "Action discovery failed"
      );
      setExecutableActions([]);
    } finally {
      setActionsLoading(false);
    }
  }

  useEffect(() => {
    if (!report?.address) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExecutableActions(report.address);
  }, [report?.address, reportResponse]);

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
    setExecutableActions([]);
    setActionsError(null);

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

  const recommendedAction = useMemo(() => {
    if (criticalRiskActive && primaryRisk) {
      return {
        title: `Address critical risk: ${primaryRisk.title}`,
        description: primaryRisk.description,
        cta: executionUnlocked ? "Review execution plan" : "Switch to Manage mode",
        ctaHref: executionUnlocked ? "/execution" : "#",
      };
    }
    if (primaryRisk) {
      return {
        title: `Review ${primaryRisk.title}`,
        description: primaryRisk.description,
        cta: executionUnlocked ? "Review execution plan" : "Switch to Manage mode",
        ctaHref: executionUnlocked ? "/execution" : "#",
      };
    }
    if (report && largestPosition) {
      return {
        title: `Monitor ${largestPosition.asset} exposure`,
        description: `This position represents ${percent(exposure)} of the portfolio. Review concentration and consider rebalancing if risk thresholds are breached.`,
        cta: executionUnlocked ? "Review execution plan" : "Switch to Manage mode",
        ctaHref: executionUnlocked ? "/execution" : "#",
      };
    }
    return {
      title: "Scan a treasury to assess risk",
      description:
        "Analyze any address read-only, then switch to Manage mode when you are ready to operate your own treasury.",
      cta: null,
      ctaHref: "#",
    };
  }, [
    criticalRiskActive,
    primaryRisk,
    report,
    largestPosition,
    exposure,
    executionUnlocked,
  ]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                TreasuryOS Command Center
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                Institutional treasury intelligence and execution
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={mode === "analyze" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("analyze")}
              >
                <ScanLine className="h-4 w-4" />
                Analyze
              </Button>
              <Button
                type="button"
                variant={mode === "manage" ? "secondary" : "ghost"}
                size="sm"
                onClick={async () => {
                  if (!isKeeperHubManaged && !wallet.address) await wallet.connect();
                  if (mode === "analyze") setMode("manage");
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                {isKeeperHubManaged
                  ? "KeeperHub · managed"
                  : ownerVerified
                    ? "Manage · owner verified"
                    : "Manage"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex-1">
                <span className="text-xs font-medium uppercase text-zinc-500">
                  {mode === "analyze"
                    ? "Analyze treasury address"
                    : "Managed treasury address"}
                </span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Paste any Ethereum address"
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-cyan-400"
                />
              </label>
              <div className="flex items-center gap-2">
                <StatusPill tone="info">Sepolia testnet</StatusPill>
                <Button
                  onClick={() => generateReport()}
                  disabled={reportState === "loading"}
                >
                  {reportState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                  Scan Treasury
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {reportState === "loading" ? (
          <StagedScanBanner activeStep={loadingCopy} />
        ) : error ? (
          <StatusBanner tone="critical" icon={TriangleAlert}>
            {error}
          </StatusBanner>
        ) : report ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <LifecycleStrip
                mode={mode}
                executionUnlocked={executionUnlocked}
                hasReport={Boolean(report)}
                hasSimulation={Boolean(session.keeperHubSimulation)}
                hasAttestation={Boolean(session.attestation)}
              />

              <TreasuryHealthCard
                report={report}
                reportHash={reportHash}
                primaryRisk={primaryRisk}
                criticalRiskActive={criticalRiskActive}
                recommendedAction={recommendedAction}
                executionUnlocked={executionUnlocked}
                mode={mode}
                executableActions={executableActions}
                actionsLoading={actionsLoading}
                actionsError={actionsError}
                hasEthPosition={hasEthPosition}
                onSwitchToManage={() => setMode("manage")}
              />

              <RiskAndSimulation riskV2={riskV2} report={report} />
            </div>

            <aside className="space-y-6">
              <PortfolioSummary
                report={report}
                largestPosition={largestPosition}
                exposure={exposure}
                network={network}
                managedWallet={wallet.address}
                ownerVerified={ownerVerified}
              />

              <Card className="rounded-xl bg-zinc-900/70">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileJson className="h-5 w-5 text-violet-300" />
                    AI Treasury Brief
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TreasuryBriefing address={report.address} />
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : (
          <EmptyState
            icon={ScanLine}
            title="No treasury scanned"
            body="Paste an Ethereum address above and click Scan Treasury to generate a risk report, stress scenarios, and execution options."
          />
        )}
      </main>
    </div>
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
                  onClick={recommendedAction.ctaHref === "#" ? onSwitchToManage : undefined}
                >
                  {recommendedAction.ctaHref !== "#" ? (
                    <Link href={recommendedAction.ctaHref}>
                      {recommendedAction.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span>{recommendedAction.cta}</span>
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
  hasSimulation,
  hasAttestation,
}: {
  mode: Mode;
  executionUnlocked: boolean;
  hasReport: boolean;
  hasSimulation: boolean;
  hasAttestation: boolean;
}) {
  const steps =
    mode === "manage" ? MANAGE_LIFECYCLE : ANALYZE_LIFECYCLE;

  let activeStep: string;
  let completedThrough: number;

  if (mode === "analyze") {
    activeStep = hasReport ? "Analyze" : "Discover";
    completedThrough = hasReport ? 1 : 0;
  } else {
    if (hasAttestation) {
      activeStep = "Attest";
      completedThrough = 4;
    } else if (hasSimulation) {
      activeStep = "Execute";
      completedThrough = 3;
    } else if (executionUnlocked) {
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-xl bg-zinc-900/70">
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
          <div className="mt-4 space-y-2">
            {factors.length > 0 ? (
              factors.slice(0, 5).map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3"
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
        </CardContent>
      </Card>

      <Card className="rounded-xl bg-zinc-900/70">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-violet-300" />
            Stress Simulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <div className="space-y-2">
              {report.stressResults
                .slice()
                .sort((a, b) => stressLoss(b) - stressLoss(a))
                .map((result) => (
                  <div
                    key={result.scenario}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950/50 p-3"
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

function StagedScanBanner({ activeStep }: { activeStep: (typeof LOADING_STEPS)[number] }) {
  const activeIndex = Math.max(LOADING_STEPS.indexOf(activeStep), 0);

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        {activeStep}
      </div>
      <div className="mt-4">
        <WorkflowStepper
          steps={LOADING_STEPS}
          activeStep={activeStep}
          completedThrough={activeIndex - 1}
        />
      </div>
    </div>
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
    <div className="min-w-0 rounded-lg border border-white/10 bg-zinc-950/50 p-3">
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
