import { ExternalLink, ShieldCheck } from "lucide-react";
import { shortenHash } from "@/lib/utils";

export type TransactionRow = {
  id: string;
  txHash: string;
  protocol: string;
  createdAt: string;
  status: string;
  explorer: string;
};

export function TransactionTable({ rows }: { rows: TransactionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="text-base font-semibold text-foreground">
          No transactions recorded
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Executions performed through TreasuryOS appear here with their receipt
          and verification status. Asset and amount detail is recorded by the
          connected wallet at execution time.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Protocol</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Verification</th>
            <th className="px-4 py-3 font-medium">Transaction</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="bg-card">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-foreground">Swap</td>
              <td className="px-4 py-3 text-muted-foreground">{row.protocol}</td>
              <td className="px-4 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  {row.status === "success" ? "Verified" : "Recorded"}
                </span>
              </td>
              <td className="px-4 py-3">
                <a
                  href={row.explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:text-primary"
                >
                  {shortenHash(row.txHash)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "success";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
        ok
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
