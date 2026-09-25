import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { severityClasses } from "@/components/ui/severity";
import type { Recommendation } from "@treasuryos/shared";

export function RecommendationCard({
  rec,
  currentState,
  ctaHref = "/execution",
}: {
  rec: Recommendation;
  currentState?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border-0 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${severityClasses(
              rec.priority
            )}`}
          >
            {rec.priority}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Recommendation
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Block label="Risk finding" value={rec.action} />
        {currentState ? (
          <Block label="Current state" value={currentState} />
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why it matters
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">{rec.reason}</p>
        </div>
        <div className="rounded-xl border border-accent/20 bg-secondary p-4">
          <div className="flex items-center gap-2 text-primary">
            <Lightbulb className="h-4 w-4" />
            <p className="text-sm font-medium">Suggested action</p>
          </div>
          <p className="mt-1 text-sm text-foreground">{rec.action}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Expected impact is computed when you review the action — TreasuryOS
            does not estimate it up front.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Link href={ctaHref}>
          <Button size="sm">
            Review Action <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
