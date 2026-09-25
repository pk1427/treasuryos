"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  RiskReport,
  RiskReportV2,
} from "@treasuryos/shared";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useTreasurySession } from "@/components/treasury/session-context";
import { useToast } from "@/components/ui/toast";
import { TreasuryHeader } from "@/components/treasury/treasury-header";
import { AssetAllocation } from "@/components/portfolio/asset-allocation";
import { ProtocolAllocation } from "@/components/portfolio/protocol-allocation";
import { PositionsTable } from "@/components/portfolio/positions-table";
import { PerformanceCard } from "@/components/performance/performance-card";
import { RiskOverview } from "@/components/risk/risk-overview";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState } from "@/components/ui/treasury-primitives";
import { Button } from "@/components/ui/button";

const LOADING_STEPS = [
  "Restoring session",
  "Scanning wallet balances",
  "Reading DeFi positions",
  "Running stress scenarios",
  "Calculating risk drivers",
  "Generating report hash",
] as const;
const REPORT_REQUEST_TIMEOUT_MS = 60_000;

type StepState = "idle" | "loading" | "done" | "error";

export function V1Overview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const wallet = useWallet();
  const { show: showToast } = useToast();
  const session = useTreasurySession();
  const {
    mode,
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
  const inFlight = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [hasStoredReport, setHasStoredReport] = useState(false);

  const report = reportResponse?.report;
  const searchAddress = searchParams.get("address") ?? "";

  // Restore the last requested address from session storage on first mount.
  useEffect(() => {
    const raw = window.localStorage.getItem("treasuryos.session.v1");
    if (raw) {
      try {
        const stored = JSON.parse(raw) as { analyzedAddress?: string; reportResponse?: { report: unknown } | null };
        requestedAddress.current = stored?.analyzedAddress ?? null;
        if (stored?.reportResponse) {
          window.queueMicrotask(() => {
            setHasStoredReport(true);
            setReportState("done");
          });
        }
      } catch {}
    }
  }, []);

  // Give session + wallet time to hydrate from storage before checking redirect.
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 200);
    return () => window.clearTimeout(timer);
  }, []);

  // Redirect to homepage when there's no address to show and no wallet —
  // the homepage is where search actually lives.
  useEffect(() => {
    if (!hydrated) return;
    if (!searchAddress && !address && !wallet.address && !report && !hasStoredReport) {
      showToast("Search a treasury from the homepage to view its overview.");
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, searchAddress, address, wallet.address, report, hasStoredReport]);

  // When wallet connects with no scanned treasury yet, the session provider
  // sets mode="manage" and analyzedAddress=walletAddress. Auto-trigger report
  // generation so the user lands straight in a report, not an empty page.
  useEffect(() => {
    if (!hydrated) return;
    if (mode !== "manage" || !address || reportState !== "idle") return;
    if (searchAddress) return; // URL param takes priority; let the main effect handle it.
    if (report) return; // Report already exists from session restore; don't re-scan.
    if (requestedAddress.current === address.toLowerCase()) return;
    requestedAddress.current = address.toLowerCase();
    void generateReport(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, mode, address, reportState]);

  async function generateReport(inputAddress = address) {
    if (!inputAddress.trim()) {
      setError("Enter a treasury address to analyze.");
      return;
    }
    // Prevent duplicate in-flight report requests from StrictMode
    // double-effects, route remounts, or rapid Refresh clicks.
    if (inFlight.current) return;
    inFlight.current = true;

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
    } finally {
      inFlight.current = false;
    }
  }

  const handleRefresh = () => {
    if (address.trim()) {
      void generateReport(address.trim());
    }
  };

  useEffect(() => {
    const target = searchAddress.trim();
    if (!target || reportState !== "idle") return;
    if (report?.address?.toLowerCase() === target.toLowerCase()) return;
    if (requestedAddress.current === target.toLowerCase()) return;
    requestedAddress.current = target.toLowerCase();
    void generateReport(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAddress, report?.address, reportState]);

  const isRefreshing = reportState === "loading";

  return (
    <div className="relative z-10 min-h-screen bg-transparent">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {reportState === "loading" ? (
          <StagedScanBanner activeStep={loadingCopy} />
        ) : error ? (
          <div className="space-y-4">
            <StatusBanner tone="critical" icon={TriangleAlert}>
              {error}
            </StatusBanner>
            <div className="flex flex-wrap gap-3">
              {address.trim() ? (
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Retry scan
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">Back to search</Link>
              </Button>
            </div>
          </div>
        ) : report ? (
          <PortfolioComposition
            report={report}
            riskV2={riskV2}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
          />
        ) : hasStoredReport || !hydrated ? (
          <StagedScanBanner activeStep="Restoring session" />
        ) : (
          <EmptyState
            icon={Search}
            title="No treasury selected"
            body="Search any public treasury from the homepage, or connect your wallet to inspect your own portfolio. Returning here keeps your existing report — only Refresh creates a new one."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button size="sm" asChild>
                  <Link href="/">Search a treasury</Link>
                </Button>
                {!wallet.address ? (
                  <Button size="sm" variant="outline" onClick={() => void wallet.connect()} disabled={wallet.isConnecting}>
                    {wallet.isConnecting ? "Connecting" : "Connect wallet"}
                  </Button>
                ) : null}
              </div>
            }
          />
        )}
      </main>
    </div>
  );
}

function PortfolioComposition({
  report,
  riskV2,
  onRefresh,
  refreshing,
}: {
  report: RiskReport;
  riskV2: RiskReportV2 | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const session = useTreasurySession();
  const network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";
  const positions = report.snapshot.positions;

  const ethExposure = useMemo(() => {
    const ethValue = positions
      .filter((p) => p.asset === "ETH" || p.asset === "WETH")
      .reduce((sum, p) => sum + p.amountUsd, 0);
    return report.snapshot.totalValueUsd > 0
      ? (ethValue / report.snapshot.totalValueUsd) * 100
      : 0;
  }, [positions, report.snapshot.totalValueUsd]);

  const recommendations = riskV2?.recommendations ?? [];

  return (
    <div className="space-y-10">
      <TreasuryHeader
        address={report.address}
        network={network}
        totalValueUsd={report.snapshot.totalValueUsd}
        riskScore={riskV2?.compositeRisk.score}
        riskRating={riskV2?.compositeRisk.rating}
        lastUpdated={report.generatedAt}
        isOwner={session.isOwnerVerified}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Portfolio</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border-0 bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset Allocation</h3>
            <AssetAllocation
              positions={positions}
              totalValueUsd={report.snapshot.totalValueUsd}
            />
          </div>
          <div className="rounded-xl border-0 bg-card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Protocol Allocation</h3>
            <ProtocolAllocation
              positions={positions}
              totalValueUsd={report.snapshot.totalValueUsd}
            />
          </div>
          <PerformanceCard totalValueUsd={report.snapshot.totalValueUsd} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Positions</h2>
        <PositionsTable
          positions={positions}
          totalValue={report.snapshot.totalValueUsd}
        />
      </section>

      {riskV2 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Risk</h2>
          <RiskOverview report={report} riskV2={riskV2} />
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recommendations</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.map((rec, i) => (
              <RecommendationCard
                key={i}
                rec={rec}
                currentState={
                  rec.action.toLowerCase().includes("eth")
                    ? `ETH exposure: ${ethExposure.toFixed(1)}%`
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StagedScanBanner({ activeStep }: { activeStep: (typeof LOADING_STEPS)[number] }) {
  const activeIndex = Math.max(LOADING_STEPS.indexOf(activeStep), 0);

  return (
      <section className="mx-auto max-w-3xl rounded-2xl border-0 bg-card p-6 shadow-lg sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-accent/30 bg-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Preparing portfolio</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{activeStep}</p>
        </div>
      </div>
      <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${((activeIndex + 1) / LOADING_STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {LOADING_STEPS.map((step, index) => {
          const complete = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li key={step} className={cn("flex items-center gap-3 text-sm", current ? "font-medium text-primary" : complete ? "text-muted-foreground" : "text-muted-foreground/60")}>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-xs", complete ? "bg-emerald-500/10 text-emerald-400" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/60")}>
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

function StatusBanner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "info" | "critical";
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
          tone === "info"
            ? "border-accent/30 bg-secondary text-foreground"
            : "border-destructive/30 bg-destructive/10 text-destructive"
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
