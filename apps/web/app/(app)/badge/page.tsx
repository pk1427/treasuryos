"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTreasurySession } from "@/components/treasury/session-context";
import { RatingBadge } from "@/components/risk/rating-badge";
import { severityClasses } from "@/components/ui/severity";
import type { RiskRating, RiskSeverity } from "@treasuryos/shared";

export default function BadgePage() {
  const session = useTreasurySession();
  const { reportResponse, riskV2, isOwnerVerified } = session;
  const report = reportResponse?.report;

  const rating = riskV2?.compositeRisk.rating ?? report?.score.rating ?? "N/A";
  const score = riskV2?.compositeRisk.score ?? report?.score.composite ?? null;
  const factors = useMemo(() => riskV2?.compositeRisk.factors ?? [], [riskV2?.compositeRisk.factors]);
  const topFactor = useMemo(() => {
    if (factors.length === 0) return null;
    return [...factors].sort((a, b) => {
      const rank: Record<RiskSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
    })[0];
  }, [factors]);

  if (!report) {
    return (
      <main className="mx-auto max-w-6xl bg-transparent px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground">Badge</h1>
        <p className="text-sm text-muted-foreground">Inspect a treasury from Overview to view its verification badge.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl bg-transparent px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground">Badge</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-0 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Owner Verified</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {isOwnerVerified ? "Yes" : "No"}
                </p>
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  isOwnerVerified
                    ? severityClasses("low")
                    : severityClasses("medium")
                }`}
              >
                {isOwnerVerified ? "Verified" : "Unverified"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Address</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {report.address.slice(0, 10)}…{report.address.slice(-8)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Network</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {process.env.NEXT_PUBLIC_CHAIN ?? "sepolia"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Risk Badge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Composite Rating</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {rating}
                </p>
              </div>
              <RatingBadge rating={rating as RiskRating} />
            </div>
            {score !== null && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Risk Score</p>
                  <p className="mt-1 font-mono text-sm text-foreground">
                    {score} / 100
                  </p>
                </div>
              </div>
            )}
            {topFactor && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Top Risk Driver</p>
                  <p className="mt-1 font-mono text-sm text-foreground">
                    {topFactor.title}
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${severityClasses(
                    topFactor.severity as RiskSeverity
                  )}`}
                >
                  {topFactor.severity}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
