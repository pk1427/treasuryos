"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
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
  RiskReport,
} from "@treasuryos/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DEMO_ADDRESS = "0x4f9f8a4f5e2c1d5f0e6a8b7c9d0e1f2a3b4c5d6e";

type ReportResponse = {
  report: RiskReport;
  reportHash: `0x${string}`;
};

type StepState = "idle" | "loading" | "done" | "error";

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
  const [error, setError] = useState<string | null>(null);

  const report = reportResponse?.report;
  const reportHash = reportResponse?.reportHash;

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
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish failed");
      setPublishState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400">TreasuryOS v1</p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-100">
            Treasury risk intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Scan a treasury, score its risk, stress the portfolio, hash the JSON
            report, and attest it through KeeperHub.
          </p>
        </div>
        <Badge variant={report ? ratingVariant(report.score.rating) : "default"}>
          {report ? `Rating ${report.score.rating}` : "Base Sepolia ready"}
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row">
          <label className="flex flex-1 flex-col gap-2">
            <span className="text-xs font-medium uppercase text-zinc-500">
              Treasury address
            </span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="h-11 rounded-lg border border-zinc-800 bg-zinc-950 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
          <Button
            className="self-end"
            onClick={generateReport}
            disabled={reportState === "loading"}
          >
            {reportState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            Scan
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <TriangleAlert className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Metric
              label="Total value"
              value={report ? usd(report.snapshot.totalValueUsd) : "--"}
            />
            <Metric
              label="Composite risk"
              value={report ? `${report.score.composite}/100` : "--"}
            />
            <Metric
              label="Largest exposure"
              value={
                largestPosition
                  ? `${largestPosition.asset} ${percent(
                      largestPosition.amountUsd /
                        report!.snapshot.totalValueUsd
                    )}`
                  : "--"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report ? (
                <div className="space-y-3">
                  {report.snapshot.positions.map((position) => (
                    <div
                      key={`${position.protocol}-${position.asset}`}
                      className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-zinc-800 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-zinc-100">
                          {position.asset}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {position.protocol}
                        </p>
                      </div>
                      <p className="font-mono text-sm text-zinc-200">
                        {usd(position.amountUsd)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ScanLine} text="Run a scan to load positions." />
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
                      className="grid gap-2 rounded-lg border border-zinc-800 p-4 md:grid-cols-[1fr_auto_auto]"
                    >
                      <p className="font-medium text-zinc-100">
                        {scenarioLabel(result.scenario)}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {usd(result.currentValueUsd)}
                        <ArrowRight className="mx-2 inline h-3 w-3" />
                        {usd(result.stressedValueUsd)}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {result.runwayMonthsAfter} months runway
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={TriangleAlert}
                  text="Stress results appear after report generation."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-emerald-400" />
                Risk report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <ScoreRow label="Concentration" value={report?.score.concentration} />
                <ScoreRow label="Counterparty" value={report?.score.counterparty} />
                <ScoreRow label="Liquidity" value={report?.score.liquidity} />
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                  Report hash
                </p>
                <p className="break-all font-mono text-xs text-zinc-300">
                  {reportHash ?? "0x..."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-emerald-400" />
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
              {attestation?.transactionLink ? (
                <a
                  className="block text-sm text-emerald-400 hover:text-emerald-300"
                  href={attestation.transactionLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200">{value ?? "--"}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
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
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-zinc-100">{title}</p>
        <Badge variant={state === "done" ? "low" : "default"}>
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
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 text-center text-sm text-zinc-500">
      <Icon className="h-6 w-6" />
      {text}
    </div>
  );
}

function ratingVariant(rating: RiskReport["score"]["rating"]) {
  return rating === "A" || rating === "B" ? "low" : "high";
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
