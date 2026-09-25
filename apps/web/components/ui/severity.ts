import type { RiskRating } from "@treasuryos/shared";

export type Severity = "low" | "medium" | "high" | "critical";

/**
 * Color-only risk tint (background / foreground / border), driven by the
 * `--risk-*` CSS tokens defined in globals.css. Theme-aware.
 *
 * Each entry now includes a subtle ring matching the risk border color at
 * full strength — not a glow, but a 1px definition line that makes the badge
 * read as a status indicator with a slight halo on dark surfaces.
 *
 * These strings are static (no interpolation) so Tailwind's JIT extractor
 * detects them.
 */
const riskClasses: Record<Severity, string> = {
  low: "bg-(--risk-low-bg) text-(--risk-low) border-(--risk-low-border) ring-(--risk-low-border) ring-1 ring-offset-0",
  medium:
    "bg-(--risk-medium-bg) text-(--risk-medium) border-(--risk-medium-border) ring-(--risk-medium-border) ring-1 ring-offset-0",
  high:
    "bg-(--risk-high-bg) text-(--risk-high) border-(--risk-high-border) ring-(--risk-high-border) ring-1 ring-offset-0",
  critical:
    "bg-(--risk-critical-bg) text-(--risk-critical) border-(--risk-critical-border) ring-(--risk-critical-border) ring-1 ring-offset-0",
};

export function severityClasses(sev: Severity): string {
  return riskClasses[sev] ?? riskClasses.low;
}

const ratingPill: Record<RiskRating, string> = {
  A: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 ring-emerald-500/40 ring-1 ring-offset-0",
  B: "bg-lime-500/10 text-lime-300 border-lime-500/20 ring-lime-500/40 ring-1 ring-offset-0",
  C: "bg-amber-500/10 text-amber-300 border-amber-500/20 ring-amber-500/40 ring-1 ring-offset-0",
  D: "bg-orange-500/10 text-orange-300 border-orange-500/20 ring-orange-500/40 ring-1 ring-offset-0",
  F: "bg-rose-500/10 text-rose-300 border-rose-500/20 ring-rose-500/40 ring-1 ring-offset-0",
  "N/A": "border-border bg-muted text-muted-foreground ring-border ring-1 ring-offset-0",
};

export function ratingClasses(rating: RiskRating): string {
  return ratingPill[rating] ?? "border-border bg-muted text-muted-foreground ring-border ring-1 ring-offset-0";
}

export function ratingLabel(rating: RiskRating): string {
  if (rating === "N/A") return "Insufficient data";
  return (
    { A: "Strong", B: "Sound", C: "Moderate", D: "Elevated", F: "Critical" }[
      rating
    ] ?? rating
  );
}

export function severityRank(sev: string): number {
  if (sev === "critical") return 4;
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  if (sev === "low") return 1;
  return 0;
}
