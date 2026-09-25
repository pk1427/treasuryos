import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { severityClasses } from "@/components/ui/severity";

type BadgeVariant = RiskLevel | "default" | "secondary" | "outline" | "destructive" | "ghost";

const base = cn(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
  "transition-shadow duration-200",
);

const variants: Record<Exclude<BadgeVariant, RiskLevel>, string> = {
  default: "border border-border bg-muted text-muted-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border border-input text-foreground",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground",
  ghost: "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const isRisk =
    variant === "low" || variant === "medium" || variant === "high" || variant === "critical";

  const style = isRisk
    ? severityClasses(variant)
    : variants[variant as keyof typeof variants];

  return (
    <span
      className={cn(base, style, className)}
      {...props}
    />
  );
}
