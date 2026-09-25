import type { RiskReport, RiskReportV2 } from "@treasuryos/shared";
import { RatingBadge } from "@/components/risk/rating-badge";
import { RiskFactorList } from "@/components/risk/risk-factor-list";
import { StressScenarioCard } from "@/components/risk/stress-scenario-card";
import { ratingLabel } from "@/components/ui/severity";

export function RiskOverview({
  report,
  riskV2,
}: {
  report: RiskReport;
  riskV2: RiskReportV2;
}) {
  const score = riskV2.compositeRisk.score;
  const rating = riskV2.compositeRisk.rating;
  const factors = riskV2.compositeRisk.factors;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreDial score={score} rating={rating} />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Treasury Risk
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {score} / 100
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{ratingLabel(rating)}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              The composite score is derived from concentration, counterparty,
              liquidity, protocol, and stress exposure. It explains
              <span className="text-foreground"> why</span> the treasury is risky —
              not just that it is.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)]">
        <h3 className="text-sm font-semibold text-foreground font-display">Key risk factors</h3>
        <div className="mt-4">
          <RiskFactorList factors={factors} />
        </div>
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)]">
        <h3 className="text-sm font-semibold text-foreground font-display">Stress scenarios</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Projected value under adverse conditions, using current on-chain
          state.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {report.stressResults.map((r) => (
            <StressScenarioCard key={r.scenario} result={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreDial({ score, rating }: { score: number; rating: string }) {
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dash = progress * circumference;

  return (
    <div className="relative grid h-24 w-24 shrink-0 place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
            stroke="var(--nocturne-cyan)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
          </svg>
       <div className="absolute text-center">
        <p className="font-mono text-xl font-semibold text-foreground">{score}</p>
        <RatingBadge rating={rating as RiskReportV2["compositeRisk"]["rating"]} compact />
      </div>
    </div>
  );
}
