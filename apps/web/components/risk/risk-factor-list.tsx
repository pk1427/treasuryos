import type { RiskFactor, StressRiskFactor } from "@treasuryos/shared";
import { severityClasses, severityRank } from "@/components/ui/severity";

export function RiskFactorList({
  factors,
  emptyLabel = "No significant risk factors detected.",
}: {
  factors: Array<RiskFactor | StressRiskFactor>;
  emptyLabel?: string;
}) {
  if (factors.length === 0) {
    return     <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const sorted = [...factors].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );

  return (
    <ul className="divide-y divide-white/[0.06]">
      {sorted.map((factor) => (
        <li key={factor.id} className="flex items-start gap-3 py-4 first:pt-0">
          <span
            className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${severityClasses(
              factor.severity
            )}`}
          >
            {factor.severity}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{factor.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {factor.description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
