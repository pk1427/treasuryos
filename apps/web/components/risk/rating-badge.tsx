import type { RiskRating } from "@treasuryos/shared";
import { ratingClasses } from "@/components/ui/severity";

export function RatingBadge({
  rating,
  compact = false,
}: {
  rating: RiskRating;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${ratingClasses(
        rating
      )} ${compact ? "mt-0.5" : ""}`}
    >
      {rating}
    </span>
  );
}
