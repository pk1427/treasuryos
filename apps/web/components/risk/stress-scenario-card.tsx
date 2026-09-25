import type { StressResult } from "@treasuryos/shared";
import { formatUsd } from "@/lib/utils";
import { severityClasses } from "@/components/ui/severity";

function scenarioLabel(scenario: string): string {
  return scenario
    .replace("ETH_-50", "ETH −50%")
    .replace("STABLE_DEPEG_-10", "Stablecoin depeg −10%")
    .replace("PROTOCOL_FAILURE", "Protocol failure");
}

function lossPercent(result: StressResult): number {
  return result.currentValueUsd > 0
    ? (result.currentValueUsd - result.stressedValueUsd) /
        result.currentValueUsd
    : 0;
}

export function StressScenarioCard({ result }: { result: StressResult }) {
  const loss = lossPercent(result);
  const severity =
    loss >= 0.5 ? "critical" : loss >= 0.3 ? "high" : loss >= 0.15 ? "medium" : "low";

  return (
    <div className="rounded-xl bg-background/45 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {scenarioLabel(result.scenario)}
        </p>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${severityClasses(
            severity
          )}`}
        >
          −{Math.round(loss * 100)}%
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{formatUsd(result.currentValueUsd)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-foreground">{formatUsd(result.stressedValueUsd)}</span>
      </div>
    </div>
  );
}
