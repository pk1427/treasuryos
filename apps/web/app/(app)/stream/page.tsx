"use client";

import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { useTreasurySession } from "@/components/treasury/session-context";
import { ActivityFeed, type ActivityEvent } from "@/components/activity/activity-feed";

type ExecutionRecord = { id: string; txHash: string; protocol: string; createdAt: string };

export default function StreamPage() {
  const { reportResponse } = useTreasurySession();
  const treasuryAddress = reportResponse?.report.address;
  const [records, setRecords] = useState<ExecutionRecord[]>([]);

  useEffect(() => {
    if (!treasuryAddress) return;
    fetch(`/api/execute?wallet=${treasuryAddress}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { history: [] }))
      .then(({ history }) => setRecords(history ?? []))
      .catch(() => setRecords([]));
  }, [treasuryAddress]);

  const events: ActivityEvent[] = records.map((record) => ({
    id: record.id,
    kind: "execution",
    title: `Verified ${record.protocol} execution`,
    detail: `Recorded ${new Date(record.createdAt).toLocaleString()}`,
    timestamp: record.createdAt,
    href: `https://sepolia.etherscan.io/tx/${record.txHash}`,
  }));

  if (!treasuryAddress) {
    return (
      <main className="grid min-h-[calc(100vh-6rem)] place-items-center bg-transparent px-4">
        <section className="max-w-md text-center">
          <ReceiptText className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Choose a treasury to view Activity.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Inspect a public treasury from Overview first.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-transparent px-4 py-12 sm:px-6">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground">Activity</h1>
      <ActivityFeed events={events} />
    </main>
  );
}
