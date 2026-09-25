"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { shortenHash } from "@/lib/utils";

type ExecutionRecord = {
  id: string;
  wallet: string;
  txHash: string;
  reportHash: string;
  chain: string;
  protocol: string;
  status: string;
  createdAt: string;
};

export default function VerificationPage() {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    fetch("/api/execute?scope=public", { cache: "no-store" })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("load failed"))
      )
      .then((data: { history: ExecutionRecord[] }) =>
        setRecords(data.history ?? [])
      )
      .then(() => setState("done"))
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground font-display">
          Verification
        </h1>

        {state === "loading" ? (
          <ul className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="privacy-card rounded-xl border border-border h-28" />
            ))}
          </ul>
        ) : state === "error" ? (
          <Empty message="Execution records could not be loaded." />
        ) : records.length === 0 ? (
          <Empty message="No public execution records have been verified yet." />
        ) : (
          <ul className="space-y-3">
            {records.map((record) => (
              <Card key={record.id} className="privacy-card border-border">
                <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail
                    label="Transaction"
                    value={shortenHash(record.txHash)}
                    link={`https://sepolia.etherscan.io/tx/${record.txHash}`}
                  />
                  <Detail
                    label="Report hash"
                    value={shortenHash(record.reportHash)}
                  />
                  <Detail
                    label="Verification"
                    value={
                      record.status === "success"
                        ? "Verified"
                        : record.status
                    }
                    tone={record.status === "success" ? "low" : "medium"}
                  />
                  <Detail
                    label="Recorded"
                    value={new Date(record.createdAt).toLocaleString()}
                  />
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Detail({
  label,
  value,
  link,
  tone,
}: {
  label: string;
  value: string;
  link?: string;
  tone?: "low" | "medium" | "critical";
}) {
  const toneClass =
    tone === "low"
      ? "text-(--risk-low)"
      : tone === "medium"
        ? "text-(--risk-medium)"
        : tone === "critical"
          ? "text-(--risk-critical)"
          : "text-foreground";
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`font-mono text-sm ${toneClass}`}>{value}</span>
        {link ? (
          <Button asChild variant="ghost" size="sm" className="h-6 w-6 px-1.5">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${label} on Etherscan`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <Card className="privacy-card border-dashed border-border">
      <CardContent className="flex flex-col items-center py-16 text-center">
        <RadioTower className="h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
