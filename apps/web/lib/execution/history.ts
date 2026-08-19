import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { PreparedTransaction } from "./types";
import { executionHistoryRepo } from "@/server/repositories";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
});

export async function persistExecutionHistory(input: {
  planId: string;
  wallet: string;
  txHash: `0x${string}`;
  protocol: string;
  reportHash: `0x${string}`;
  expectedTransaction: PreparedTransaction;
}) {
  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) throw new Error("Execution receipt was not verified on Sepolia.");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: input.txHash,
  });
  if (receipt.status !== "success") throw new Error("Execution transaction reverted; history was not recorded.");
  const transaction = await publicClient.getTransaction({ hash: input.txHash });
  if (
    transaction.from.toLowerCase() !== input.wallet.toLowerCase() ||
    transaction.to?.toLowerCase() !== input.expectedTransaction.to.toLowerCase() ||
    transaction.input.toLowerCase() !== input.expectedTransaction.data.toLowerCase() ||
    transaction.value !== BigInt(input.expectedTransaction.value)
  ) throw new Error("Mined transaction does not match the prepared execution plan.");

  const history = await executionHistoryRepo.create({
    planId: input.planId,
    wallet: input.wallet,
    txHash: input.txHash,
    reportHash: input.reportHash,
    chain: "sepolia",
    protocol: input.protocol,
    status: receipt.status,
  });

  return {
    history,
    receipt,
    proof: {
      reportHash: input.reportHash,
      transactionHash: input.txHash,
      verification: "verified",
    },
  };
}
