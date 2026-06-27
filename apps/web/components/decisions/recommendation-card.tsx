"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DashboardDecision } from "@/types";
import { executeDecisionAction } from "@/app/actions/treasury";
import { Loader2, Play, CheckCircle2 } from "lucide-react";

interface RecommendationCardProps {
  recommendation: DashboardDecision;
  walletAddress: string;
  index: number;
}

export function RecommendationCard({
  recommendation,
  walletAddress,
  index,
}: RecommendationCardProps) {
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(recommendation.status === "executed");
  const [txHash, setTxHash] = useState<string | null>(null);

  const decisionId = recommendation.id;
  const canExecute =
    recommendation.actionPlan.amountUsd > 0 && !executed;

  async function handleExecute() {
    setLoading(true);
    try {
      const result = await executeDecisionAction(decisionId, walletAddress);
      setTxHash(result.execution.txHash);
      setExecuted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base capitalize">
              {recommendation.type.replace("_", " ")}
            </CardTitle>
            <CardDescription className="mt-1">
              AI CFO Recommendation
            </CardDescription>
          </div>
          <Badge variant={recommendation.severity}>
            {recommendation.severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-zinc-300">{recommendation.explanation}</p>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
            Recommendation
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {recommendation.recommendation}
          </p>
        </div>

        {canExecute && (
          <Button
            onClick={handleExecute}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing via KeeperHub...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Execute — Transfer ${recommendation.actionPlan.amountUsd.toLocaleString()} {recommendation.actionPlan.tokenSymbol}
              </>
            )}
          </Button>
        )}

        {executed && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {txHash ? (
              <span>
                Executed — Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </span>
            ) : (
              <span>Executed successfully</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
