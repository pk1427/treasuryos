import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatPercent } from "@/lib/utils";
import type { AnalyticsResult } from "@/types";
import {
  DollarSign,
  Clock,
  Target,
  AlertCircle,
  TrendingDown,
} from "lucide-react";

interface MetricsGridProps {
  analytics: AnalyticsResult;
}

export function MetricsGrid({ analytics }: MetricsGridProps) {
  const metrics = [
    {
      title: "Treasury Value",
      value: formatUsd(analytics.totalValue),
      icon: DollarSign,
      subtitle: "Total onchain assets",
    },
    {
      title: "Runway",
      value: analytics.runwayMonths
        ? `${analytics.runwayMonths.toFixed(1)} mo`
        : "N/A",
      icon: Clock,
      subtitle: `$${analytics.burnRate.toLocaleString()}/mo burn`,
    },
    {
      title: "Concentration",
      value: formatPercent(analytics.concentrationScore),
      icon: Target,
      subtitle: analytics.concentrationAsset,
    },
    {
      title: "Idle Capital",
      value: formatUsd(analytics.idleCapitalUsd),
      icon: TrendingDown,
      subtitle: `${analytics.idleCapitalDays} days unused`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ title, value, icon: Icon, subtitle }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              {title}
            </CardTitle>
            <Icon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{value}</div>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </CardContent>
        </Card>
      ))}

      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Risk Score
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-zinc-500" />
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Badge variant={analytics.riskScore} className="text-sm px-3 py-1">
            {analytics.riskScore}
          </Badge>
          <p className="text-sm text-zinc-400">
            Based on concentration, runway, idle capital, and transaction patterns
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
