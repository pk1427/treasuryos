"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTreasurySession } from "@/components/treasury/session-context";
import { shortenHash } from "@/lib/utils";

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

  if (!treasuryAddress) return <main className="grid min-h-[calc(100vh-6rem)] place-items-center px-4"><section className="max-w-md text-center"><ReceiptText className="mx-auto h-8 w-8 text-violet-600" /><h1 className="mt-4 text-3xl font-semibold text-slate-950">Choose a treasury to view Activity.</h1><p className="mt-3 text-slate-500">Inspect a public treasury from Portfolio first.</p></section></main>;

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-12 sm:px-6"><h1 className="mb-10 text-4xl font-semibold tracking-tight text-violet-700">Activity</h1><section className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-6">{records.length ? records.map((record) => <article key={record.id} className="flex items-center justify-between gap-4 py-5"><div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-violet-600" /><div><p className="font-medium text-slate-950">Verified {record.protocol} execution</p><p className="mt-1 text-sm text-slate-500">Recorded {new Date(record.createdAt).toLocaleString()}</p></div></div><a className="flex items-center gap-1 font-mono text-sm text-violet-700" href={`https://sepolia.etherscan.io/tx/${record.txHash}`} target="_blank" rel="noreferrer">{shortenHash(record.txHash)} <ExternalLink className="h-3.5 w-3.5" /></a></article>) : <Card className="my-6 border-dashed shadow-none"><CardContent className="py-12 text-center text-sm text-slate-500">No verified executions for this treasury yet.</CardContent></Card>}</section></main>;
}
