"use client";

import { useEffect, useState } from "react";
import { useTreasurySession } from "@/components/treasury/session-context";
import { TransactionTable, type TransactionRow } from "@/components/transactions/transaction-table";

type ExecutionHistoryEntry = {
  id: string;
  txHash: string;
  protocol: string;
  createdAt: string;
  status: string;
  explorer: string;
};

export default function TransactionsPage() {
  const { reportResponse } = useTreasurySession();
  const treasuryAddress = reportResponse?.report.address;
  const [rows, setRows] = useState<TransactionRow[]>([]);

  useEffect(() => {
    if (!treasuryAddress) return;
    fetch(`/api/execute?wallet=${treasuryAddress}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { history: [] }))
      .then(({ history }) =>
        setRows(
          (history as ExecutionHistoryEntry[] | undefined)?.map((entry) => ({
            id: entry.id,
            txHash: entry.txHash,
            protocol: entry.protocol,
            createdAt: entry.createdAt,
            status: entry.status,
            explorer: entry.explorer,
          })) ?? []
        )
      )
      .catch(() => setRows([]));
  }, [treasuryAddress]);

  if (!treasuryAddress) {
    return (
      <main className="mx-auto max-w-6xl bg-transparent px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground">Transactions</h1>
        <p className="text-sm text-muted-foreground">Inspect a treasury from Overview to view its transaction history.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl bg-transparent px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight text-foreground">Transactions</h1>
      <TransactionTable rows={rows} />
    </main>
  );
}
