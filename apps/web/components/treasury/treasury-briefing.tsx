"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2 } from "lucide-react";
import { StatusPill } from "@/components/ui/treasury-primitives";
import type { TreasuryBriefing } from "@/lib/ai/prompts";

type Props = {
  address: string;
};

export function TreasuryBriefing({ address }: Props) {
  const [briefing, setBriefing] = useState<TreasuryBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateBriefing() {
    setLoading(true);
    setError(null);
    setBriefing(null);

    try {
      const response = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate briefing");
      }

      setBriefing(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Briefing failed");
    } finally {
      setLoading(false);
    }
  }

  if (!briefing && !loading && !error) {
    return (
      <Card className="border-violet-400/20 bg-violet-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Treasury Analyst
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">
            Turn the scanned data into a concise operator brief. AI can explain findings, but it cannot move funds or submit transactions.
          </p>
          <Button
            onClick={generateBriefing}
            className="mt-4"
            variant="secondary"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate Briefing
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-violet-400/20 bg-violet-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Treasury Analyst
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing treasury data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-violet-400/20 bg-violet-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" />
            AI Treasury Analyst
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">{error}</p>
          <Button
            onClick={generateBriefing}
            className="mt-3"
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-violet-400/20 bg-violet-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-300" />
          AI Treasury Analyst
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 p-3">
          <StatusPill tone="ai"><Brain className="h-3.5 w-3.5" /> AI analysis · read-only</StatusPill>
          <Badge variant={briefing?.confidence === "high" ? "low" : briefing?.confidence === "medium" ? "medium" : "critical"} className="normal-case">
            Confidence: {briefing?.confidence ?? "medium"}
          </Badge>
        </div>

        {briefing?.summary ? (
          <div className="rounded-xl border border-violet-400/15 bg-zinc-950/50 p-4">
            <p className="text-sm font-medium uppercase text-zinc-500 mb-2">
              Summary
            </p>
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {briefing.summary}
            </p>
          </div>
        ) : null}

        {briefing?.keyRisks && briefing.keyRisks.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
              Key Risks
            </p>
            <div className="space-y-2">
              {briefing.keyRisks.map((risk, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-950/50 p-3"
                >
                  <Badge
                    variant={severityVariant(risk.severity)}
                    className="normal-case"
                  >
                    {risk.severity}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {risk.title}
                    </p>
                    <p className="text-xs text-zinc-500">{risk.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {briefing?.recommendations && briefing.recommendations.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
              Recommendations
            </p>
            <div className="space-y-2">
              {briefing.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-950/50 p-3"
                >
                  <Badge
                    variant={severityVariant(rec.priority)}
                    className="normal-case"
                  >
                    {rec.priority}
                  </Badge>
                  <div>
                    <p className="text-sm text-zinc-200">{rec.action}</p>
                    <p className="text-xs text-zinc-500">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            onClick={generateBriefing}
            variant="outline"
            size="sm"
          >
            Regenerate
          </Button>
          <span className="text-xs text-violet-200/75">AI is advisory only; the connected owner controls every transaction.</span>
        </div>
      </CardContent>
    </Card>
  );
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
