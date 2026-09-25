import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      {Icon ? (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
