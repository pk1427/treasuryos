"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: number;
  message: string;
  actionLabel?: string;
  actionPerformed?: () => void;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (
    message: string,
    options?: { actionLabel?: string; actionPerformed?: () => void },
  ) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (
      message: string,
      options?: { actionLabel?: string; actionPerformed?: () => void },
    ) => {
      const id = Date.now();
      const toast: Toast = {
        id,
        message,
        actionLabel: options?.actionLabel,
        actionPerformed: options?.actionPerformed,
      };
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "rounded-lg border border-border",
            "bg-popover p-4 text-sm text-popover-foreground shadow-xl",
            "animate-in slide-in-from-right-full duration-300",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 break-words">{toast.message}</div>
            {toast.actionLabel && toast.actionPerformed ? (
              <button
                type="button"
                onClick={() => {
                  toast.actionPerformed?.();
                  onDismiss(toast.id);
                }}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className={cn(
                "shrink-0 rounded p-1 text-muted-foreground",
                "hover:text-foreground hover:bg-muted",
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
