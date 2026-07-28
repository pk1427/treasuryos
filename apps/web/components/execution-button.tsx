"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/components/wallet/context";

type Props = {
  planId: string;
  walletAddress: string;
  disabled?: boolean;
  onExecuted?: (result: ExecuteCompleteResponse) => void;
};

type ExecutePrepareResponse = {
  success: true;
  status: "ready";
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId: string;
  };
};

type ExecuteCompleteResponse = {
  success: true;
  txHash: string;
  explorer: string;
  status: string;
  historyId: string;
  attestation?: {
    transactionHash?: string;
    transactionLink?: string;
    status?: string;
  };
};

export function ExecutionButton({
  planId,
  walletAddress,
  disabled,
  onExecuted,
}: Props) {
  const { address, sendTransaction } = useWallet();
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteCompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function executePlan() {
    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      if (!address || address.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Wallet ownership mismatch.");
      }

      const prepared = await postExecute<ExecutePrepareResponse>({
        phase: "prepare",
        planId,
        walletAddress: address,
      });

      const txHash = await sendTransaction(prepared.transaction);
      if (!txHash) {
        throw new Error("Wallet did not return a transaction hash.");
      }

      const completed = await postExecute<ExecuteCompleteResponse>({
        phase: "complete",
        planId,
        walletAddress: address,
        txHash,
      });

      setResult(completed);
      onExecuted?.(completed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution failed.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={executePlan}
        disabled={disabled || executing}
        variant="default"
      >
        {executing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Execute
      </Button>
      {result ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="low" className="normal-case">
              {result.status}
            </Badge>
            <a
              href={result.explorer}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-300 hover:text-cyan-200"
            >
              View transaction
            </a>
          </div>
          <p className="font-mono text-xs text-zinc-300 break-all">
            {result.txHash}
          </p>
          {result.attestation?.transactionHash ? (
            <p className="mt-2 font-mono text-xs text-emerald-300 break-all">
              Attestation: {result.attestation.transactionHash}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm font-medium text-red-300">
            Execution failed
          </p>
          <p className="mt-1 text-xs text-red-200">{error}</p>
        </div>
      ) : null}
    </div>
  );
}

async function postExecute<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Execution preconditions failed.");
  }

  return data as T;
}
