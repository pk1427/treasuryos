import { getConnectedWallet, getDashboardAction } from "@/app/actions/treasury";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectWallet } from "@/components/treasury/connect-wallet";
import { shortenHash } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function ExecutionsPage() {
  const wallet = await getConnectedWallet();

  if (!wallet) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <ConnectWallet />
      </div>
    );
  }

  const data = await getDashboardAction(wallet);
  const executions = data.executions ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Executions</h1>
        <p className="text-zinc-400">
          KeeperHub transaction history and audit trail
        </p>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Clock className="mb-4 h-10 w-10" />
            <p>No executions yet. Execute a recommendation to see transactions here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {executions.map((entry, i) => {
            const status = entry.status ?? "confirmed";
            const txHash = entry.txHash;
            const decision = entry.decision;

            return (
              <Card key={entry.id ?? i}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {decision?.type?.replace("_", " ") ?? "Treasury Action"}
                    </CardTitle>
                    <p className="text-xs text-zinc-500">
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      status === "confirmed"
                        ? "low"
                        : status === "failed"
                          ? "critical"
                          : "medium"
                    }
                  >
                    {status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {decision && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-zinc-500">Risk</p>
                        <p className="text-sm text-zinc-300 capitalize">
                          {decision.type?.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500">Reason</p>
                        <p className="text-sm text-zinc-300">{decision.explanation}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500">Action</p>
                        <p className="text-sm text-zinc-300">{decision.recommendation}</p>
                      </div>
                    </>
                  )}
                  {txHash && (
                    <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 p-3">
                      {status === "confirmed" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-400" />
                      )}
                      <div>
                        <p className="text-xs text-zinc-500">Transaction</p>
                        <p className="font-mono text-sm text-zinc-200">
                          {shortenHash(txHash)}
                        </p>
                      </div>
                      {entry.gasUsed && (
                        <div className="ml-auto text-right">
                          <p className="text-xs text-zinc-500">Gas Used</p>
                          <p className="text-sm text-zinc-300">{entry.gasUsed}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
