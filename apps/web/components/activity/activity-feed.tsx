import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  RadioTower,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export type ActivityEvent = {
  id: string;
  kind:
    | "scan"
    | "risk"
    | "execution"
    | "recommendation"
    | "exposure"
    | "stress";
  title: string;
  detail?: string;
  timestamp?: string;
  href?: string;
};

const ICONS: Record<ActivityEvent["kind"], ReactNode> = {
  scan: <Wallet className="h-4 w-4" />,
  risk: <AlertTriangle className="h-4 w-4" />,
  execution: <RadioTower className="h-4 w-4" />,
  recommendation: <ArrowRight className="h-4 w-4" />,
  exposure: <Activity className="h-4 w-4" />,
  stress: <ShieldCheck className="h-4 w-4" />,
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <Activity className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-base font-semibold text-foreground">
          Nothing has changed yet
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          As the treasury is scanned, executed, or its risk shifts, events will
          appear here. This feed only shows real on-chain activity.
        </p>
      </div>
    );
  }

  return (
    <ul className="relative space-y-px">
      {events.map((event) => {
        const body = (
          <div className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition hover:bg-accent">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground">
              {ICONS[event.kind]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              {event.detail ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{event.detail}</p>
              ) : null}
            </div>
            {event.timestamp ? (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            ) : null}
          </div>
        );
        return (
          <li key={event.id}>
            {event.href ? (
              <a href={event.href} className="block">
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
