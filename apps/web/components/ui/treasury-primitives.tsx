"use client";

import { useState, type ReactNode } from "react";
import { Check, Clipboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "ai";

const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-muted/30 text-muted-foreground",
  info: "border-accent/25 bg-secondary text-primary",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-400",
  danger: "border-red-400/25 bg-red-400/10 text-red-400",
  ai: "border-primary/25 bg-primary/10 text-primary",
};

export function StatusPill({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", toneClasses[tone], className)}>{children}</span>;
}

export function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: Tone }) {
  return (
    <div className={cn("rounded-xl border p-4", toneClasses[tone])}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground" title={value}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function HashValue({ label, value, compact = false }: { label: string; value?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const display = value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "Waiting for data";
  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-muted/20", compact ? "px-3 py-2" : "p-3")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums text-foreground" title={value}>{display}</span>
        {value ? <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy} aria-label={`Copy ${label}`}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />}</Button> : null}
      </div>
    </div>
  );
}

export function WorkflowStepper({ steps, activeStep, completedThrough = -1 }: { steps: readonly string[]; activeStep?: string; completedThrough?: number }) {
  return (
    <ol className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
      {steps.map((step, index) => {
        const isActive = activeStep === step;
        const isDone = index <= completedThrough;
        return <li key={step} aria-current={isActive ? "step" : undefined} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium", isActive ? toneClasses.info : isDone ? toneClasses.success : toneClasses.neutral)}><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current text-[10px] font-bold text-background">{isDone ? "✓" : String(index + 1).padStart(2, "0")}</span><span className="min-w-0 truncate">{step}</span></li>;
      })}
    </ol>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center"><div className="mb-3 rounded-xl border border-border bg-muted/20 p-2.5"><Icon className="h-5 w-5 text-muted-foreground" /></div><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}
