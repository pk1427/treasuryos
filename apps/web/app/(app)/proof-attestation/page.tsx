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

export default function ProofAttestationPage() {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [state, setState] = useState<"done" | "error">("done");

  useEffect(() => {
    fetch("/api/execute?scope=public", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ history }) => setRecords(history))
      .then(() => setState("done"))
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-violet-700">Proofs</h1>
        {state === "error" ? (
          <Empty message="Execution records could not be loaded." />
        ) : records.length === 0 ? (
          <Empty message="No public execution records have been verified yet." />
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <Card key={record.id} className="bg-zinc-900/70"><CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Transaction" value={shortenHash(record.txHash)} link={`https://sepolia.etherscan.io/tx/${record.txHash}`} />
                <Detail label="Report hash" value={shortenHash(record.reportHash)} />
                <Detail label="Verification" value={record.status === "success" ? "Verified" : record.status} />
                <Detail label="Recorded" value={new Date(record.createdAt).toLocaleString()} />
              </CardContent></Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value, link }: { label: string; value: string; link?: string }) {
  return <div><p className="text-xs uppercase text-zinc-500">{label}</p><div className="mt-1 flex items-center gap-2"><span className="font-mono text-sm text-zinc-200">{value}</span>{link ? <Button asChild variant="ghost" size="icon"><a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button> : null}</div></div>;
}

function Empty({ message }: { message: string }) {
  return <Card className="border-dashed border-zinc-700"><CardContent className="flex flex-col items-center py-16 text-center"><RadioTower className="h-7 w-7 text-zinc-500" /><p className="mt-3 text-sm text-zinc-400">{message}</p></CardContent></Card>;
}
