"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileJson,
  Loader2,
  RadioTower,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  AttestationResult,
  AttestationSimulation,
  RiskRating,
  RiskReport,
} from "@treasuryos/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, shortenHash } from "@/lib/utils";

const DEMO_ADDRESS = "0x4f9f8a4f5e2c1d5f0e6a8b7c9d0e1f2a3b4c5d6e";
const LOADING_STEPS = [
  "Scanning treasury...",
  "Loading positions...",
  "Calculating risk score...",
  "Running stress simulations...",
  "Generating report hash...",
];
const FLOW_STEPS = ["Scan", "Score", "Simulate", "Publish", "Verified"] as const;
const ATTESTATION_STORAGE_KEY = "treasuryos.attestations.v1";

type ReportResponse = {
  report: RiskReport;
  reportHash: `0x${string}`;
};

type StepState = "idle" | "loading" | "done" | "error";
type FlowStep = (typeof FLOW_STEPS)[number];

export function V1Dashboard() {
  const [address, setAddress] = useState(DEMO_ADDRESS);
  const [reportResponse, setReportResponse] = useState<ReportResponse | null>(
    null
  );
  const [simulation, setSimulation] = useState<AttestationSimulation | null>(
    null
  );
  const [attestation, setAttestation] = useState<AttestationResult | null>(null);
  const [reportState, setReportState] = useState<StepState>("idle");
  const [simulateState, setSimulateState] = useState<StepState>("idle");
  const [publishState, setPublishState] = useState<StepState>("idle");
  const [loadingCopy, setLoadingCopy] = useState(LOADING_STEPS[0]);
  const [error, setError] = useState<string | null>(null);

  const report = reportResponse?.report;
  const reportHash = reportResponse?.reportHash;
  const network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";

  const activeStep = getActiveStep(reportState, simulateState, publishState);
  const largestPosition = useMemo(() => {
    if (!report) return null;
    return [...report.snapshot.positions].sort(
      (a, b) => b.amountUsd - a.amountUsd
    )[0];
  }, [report]);

  async function generateReport() {
    setError(null);
    setReportState("loading");
    setSimulateState("idle");
    setPublishState("idle");
    setReportResponse(null);
    setSimulation(null);
    setAttestation(null);

    try {
      const responsePromise = fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const [response] = await Promise.all([
        responsePromise,
        playLoadingSequence(setLoadingCopy),
      ]);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Report generation failed");
      }

      setReportResponse(data);
      setReportState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report failed");
      setReportState("error");
    }
  }

  async function simulate() {
    if (!report || !reportHash) return;

    setError(null);
    setSimulateState("loading");
    setPublishState("idle");
    setSimulation(null);
    setAttestation(null);

    try {
      const response = await fetch("/api/attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "simulate",
          treasuryAddress: report.address,
          reportHash,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "KeeperHub simulation failed");
      }

      setSimulation(data);
      setSimulateState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
      setSimulateState("error");
    }
  }

  async function publish() {
    if (!report || !reportHash || !simulation) return;

    setError(null);
    setPublishState("loading");

    try {
      const response = await fetch("/api/attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "publish",
          treasuryAddress: report.address,
          reportHash,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "KeeperHub publish failed");
      }

      setAttestation(data);
      setPublishState("done");
      persistAttestation({
        treasuryAddress: report.address,
        rating: report.score.rating,
        reportHash,
        transactionHash: data.transactionHash,
        transactionLink: data.transactionLink,
        status: data.status,
        network,
        publishedAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish failed");
      setPublishState("error");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.15),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(139,92,246,0.13),transparent_32%),#09090b]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">TreasuryOS v1</p>
            <h1 className="mt-1 text-4xl font-bold leading-tight text-zinc-100">
              Treasury Risk Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Analyze treasury risk and publish immutable attestations onchain.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Badge variant={report ? ratingVariant(report.score.rating) : "default"}>
              {report ? `Rating ${report.score.rating}` : `${network} ready`}
            </Badge>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur-xl sm:p-5">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Scan pipeline
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Scan, score, simulate, publish, and verify in one read-only flow.
              </p>
            </div>
            <FlowStepper activeStep={activeStep} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase text-zinc-500">
                Treasury address
              </span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="h-12 rounded-xl border border-white/10 bg-zinc-950/80 px-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-9 border-emerald-400/20 px-3 text-emerald-300">
                {network}
              </Badge>
              {attestation?.transactionHash ? (
                <Badge variant="low" className="h-9 px-3 normal-case">
                  Recent tx {shortenHash(attestation.transactionHash)}
                </Badge>
              ) : null}
              <Button
                className="h-12 px-5"
                onClick={generateReport}
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

          <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Total value"
              value={report ? usd(report.snapshot.totalValueUsd) : "No treasury scanned yet"}
            />
            <Metric
              label="Composite risk"
              value={
                report
                  ? `${report.score.composite}/100`
                  : "Scan a treasury to calculate risk"
              }
            />
            <Metric
              label="Largest exposure"
              value={
                largestPosition
                  ? `${largestPosition.asset} ${percent(
                      largestPosition.amountUsd /
                        report!.snapshot.totalValueUsd
                    )}`
                  : "Enter an address and click Scan"
              }
            />
            <Metric
              label="Risk rating"
              value={report ? report.score.rating : "Generated after scanning"}
            />
          </div>
        </section>

      {reportState === "loading" ? (
        <div className="flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingCopy}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-300" />
                Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {report.snapshot.positions.map((position) => (
                    <div
                      key={`${position.protocol}-${position.asset}`}
                      className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-zinc-100">
                            {position.asset}
                          </p>
                          <ProtocolBadge protocol={position.protocol} />
                        </div>
                        <p className="text-right font-mono text-lg font-bold text-zinc-100">
                          {usd(position.amountUsd)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ScanLine} text="Enter an address and click Scan" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-amber-400" />
                Stress simulator
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report ? (
                <div className="grid gap-3">
                  {report.stressResults.map((result) => (
                    <div
                      key={result.scenario}
                      className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.04]"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-zinc-100">
                          {scenarioLabel(result.scenario)}
                        </p>
                        <Badge variant={lossVariant(result)} className="normal-case">
                          {percent(
                            (result.currentValueUsd - result.stressedValueUsd) /
                              result.currentValueUsd
                          )}{" "}
                          loss
                        </Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-zinc-500">Value</p>
                          <p className="mt-1 font-mono text-sm">
                            <span className="text-zinc-500 line-through">
                              {usd(result.currentValueUsd)}
                            </span>
                            <span className="mx-2 text-zinc-600">-&gt;</span>
                            <span className="font-bold text-zinc-100">
                              {usd(result.stressedValueUsd)}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-zinc-500">Runway</p>
                          <p className="mt-1 flex items-center gap-2 font-mono text-sm text-zinc-100">
                            {result.runwayMonthsBefore} mo
                            <ArrowDown className="h-3 w-3 text-red-400" />
                            {result.runwayMonthsAfter} mo
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={TriangleAlert}
                  text="Stress results appear after report generation"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-cyan-300" />
                Risk report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                    Rating
                  </p>
                  <Badge
                    variant={ratingVariant(report.score.rating)}
                    className="px-4 py-2 text-3xl font-bold"
                  >
                    {report.score.rating}
                  </Badge>
                </div>
              ) : (
                <EmptyState icon={FileJson} text="Generated after scanning" />
              )}
              <div className="grid gap-3">
                <ScoreRow
                  label="Concentration"
                  value={report?.score.concentration}
                  explanation="Exposure concentration across treasury positions."
                />
                <ScoreRow
                  label="Counterparty"
                  value={report?.score.counterparty}
                  explanation="Protocol and counterparty dependency risk."
                />
                <ScoreRow
                  label="Liquidity"
                  value={report?.score.liquidity}
                  explanation="Liquidity and stressed-exit sensitivity."
                />
              </div>
              <HashPanel
                label="Report hash"
                value={reportHash}
                empty="Generated after scanning"
                generatedAt={report?.generatedAt}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-cyan-300" />
                KeeperHub attestation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step
                title="Simulate"
                body={simulation?.message ?? simulation?.status}
                state={simulateState}
              />
              <Step
                title="Publish"
                body={attestation?.transactionHash ?? attestation?.status}
                state={publishState}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={simulate}
                  disabled={!report || simulateState === "loading"}
                >
                  {simulateState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Simulate
                </Button>
                <Button
                  onClick={publish}
                  disabled={
                    !simulation ||
                    publishState === "loading" ||
                    simulateState !== "done"
                  }
                >
                  {publishState === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Publish
                </Button>
              </div>
              {attestation?.transactionHash ? (
                <HashPanel
                  label="Transaction hash"
                  value={attestation.transactionHash}
                  link={attestation.transactionLink}
                />
              ) : null}
              {attestation?.transactionHash && publishState === "done" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="low" className="normal-case">
                    Attested Onchain
                  </Badge>
                  {attestation.transactionLink ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={attestation.transactionLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View on Etherscan
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      </div>
    </div>
  );
}

function FlowStepper({ activeStep }: { activeStep: FlowStep }) {
  const activeIndex = FLOW_STEPS.indexOf(activeStep);

  return (
    <div className="grid min-w-full gap-2 sm:min-w-[520px] sm:grid-cols-5">
      {FLOW_STEPS.map((step, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div
            key={step}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition",
              complete
                ? "bg-emerald-500/10 text-emerald-300"
                : active
                  ? "bg-cyan-500/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                  : "text-zinc-500"
            )}
          >
            {index > 0 ? (
              <span className="absolute right-[calc(100%-2px)] top-1/2 hidden h-px w-3 bg-white/10 sm:block" />
            ) : null}
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                complete
                  ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                  : active
                    ? "border-cyan-400 text-cyan-200"
                    : "border-zinc-700 text-zinc-500"
              )}
            >
              {complete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {step}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 min-h-14 text-2xl font-semibold leading-tight text-zinc-100">
          {value}
      </p>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  explanation,
}: {
  label: string;
  value?: number;
  explanation: string;
}) {
  const score = value ?? 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200">{value ?? "--"}/100</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", severityColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{explanation}</p>
    </div>
  );
}

function Step({
  title,
  body,
  state,
}: {
  title: string;
  body?: string;
  state: StepState;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-zinc-100">{title}</p>
        <Badge variant={state === "done" ? "low" : state === "error" ? "critical" : "default"}>
          {state}
        </Badge>
      </div>
      <p className="mt-2 break-all text-sm text-zinc-500">
        {body ?? "Waiting"}
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: LucideIcon;
  text: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 px-4 text-center text-sm text-zinc-500">
      <Icon className="h-6 w-6" />
      {text}
    </div>
  );
}

function HashPanel({
  label,
  value,
  empty = "Waiting",
  link,
  generatedAt,
}: {
  label: string;
  value?: string;
  empty?: string;
  link?: string;
  generatedAt?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase text-zinc-500">{label}</p>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-xs text-zinc-300">
          {value ? shortenHash(value) : empty}
        </p>
        {value ? <CopyButton value={value} label={`Copy ${label}`} /> : null}
        {link ? (
          <Button asChild variant="ghost" size="icon" aria-label={`Open ${label}`}>
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>
      {generatedAt ? (
        <p className="mt-2 text-xs text-zinc-500">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
    </Button>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const key = protocol.toLowerCase();
  const className = key.includes("aave")
    ? "border-sky-400/30 bg-sky-500/10 text-sky-300"
    : key.includes("uniswap")
      ? "border-pink-400/30 bg-pink-500/10 text-pink-300"
      : "border-violet-400/30 bg-violet-500/10 text-violet-300";

  return (
    <span
      className={cn(
        "mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {protocol}
    </span>
  );
}

function getActiveStep(
  reportState: StepState,
  simulateState: StepState,
  publishState: StepState
): FlowStep {
  if (publishState === "done") return "Verified";
  if (publishState === "loading") return "Publish";
  if (simulateState === "done" || simulateState === "loading") return "Simulate";
  if (reportState === "done") return "Score";
  return "Scan";
}

async function playLoadingSequence(setCopy: (copy: string) => void) {
  for (const copy of LOADING_STEPS) {
    setCopy(copy);
    await delay(475);
  }
}

function persistAttestation(entry: {
  treasuryAddress: string;
  rating: RiskRating;
  reportHash: string;
  transactionHash?: string;
  transactionLink?: string;
  status: string;
  network: string;
  publishedAt: string;
}) {
  if (typeof window === "undefined" || !entry.transactionHash) return;

  const current = JSON.parse(
    window.localStorage.getItem(ATTESTATION_STORAGE_KEY) ?? "[]"
  ) as typeof entry[];
  const next = [
    entry,
    ...current.filter((item) => item.transactionHash !== entry.transactionHash),
  ];
  window.localStorage.setItem(ATTESTATION_STORAGE_KEY, JSON.stringify(next));
}

function ratingVariant(rating: RiskReport["score"]["rating"]) {
  if (rating === "A" || rating === "B") return "low";
  if (rating === "C") return "medium";
  if (rating === "D") return "high";
  return "critical";
}

function lossVariant(result: RiskReport["stressResults"][number]) {
  const loss = (result.currentValueUsd - result.stressedValueUsd) / result.currentValueUsd;
  if (loss < 0.15) return "low";
  if (loss < 0.3) return "medium";
  if (loss < 0.5) return "high";
  return "critical";
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
