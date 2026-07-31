import { createPublicClient, encodePacked, http, keccak256 } from "viem";
import { sepolia } from "viem/chains";
import type { PreparedTransaction } from "./types";
import { publishAttestation } from "@treasuryos/attestation";
import { executionHistoryRepo } from "@/server/repositories";
import { indexPublishedAttestationTransaction } from "@/server/services/attestation-indexer-service";

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
  if (receipt.status !== "success") throw new Error("Execution transaction reverted; history and attestation were not recorded.");
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
    chain: "sepolia",
    protocol: input.protocol,
    status: receipt.status,
  });

  const executionProofHash = keccak256(
    encodePacked(["bytes32", "bytes32"], [input.reportHash, input.txHash])
  );
  const attestation = await publishExecutionAttestation({
    wallet: input.wallet,
    executionProofHash,
  });

  return {
    history,
    receipt,
    attestation: { ...attestation, executionProofHash },
  };
}

async function publishExecutionAttestation(input: {
  wallet: string;
  executionProofHash: `0x${string}`;
}) {
  const result = await publishAttestation({
    treasuryAddress: input.wallet,
    reportHash: input.executionProofHash,
    network: "sepolia",
  });

  if (result.transactionHash) {
    await indexPublishedAttestationTransaction(result.transactionHash);
  }

  return result;
}
