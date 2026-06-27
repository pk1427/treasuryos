import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

const variants: Record<RiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: RiskLevel | "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const style =
    variant === "default"
      ? "bg-zinc-800 text-zinc-300 border-zinc-700"
      : variant === "outline"
        ? "border border-zinc-700 text-zinc-400"
        : variants[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        style,
        className
      )}
      {...props}
    />
  );
}
