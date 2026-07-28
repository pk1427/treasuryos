import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
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
}) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: input.txHash,
  });

  const history = await executionHistoryRepo.create({
    planId: input.planId,
    wallet: input.wallet,
    txHash: input.txHash,
    chain: "sepolia",
    protocol: input.protocol,
    status: receipt.status,
  });

  const attestation = await publishExecutionAttestation({
    wallet: input.wallet,
    reportHash: input.reportHash,
  });

  return {
    history,
    receipt,
    attestation,
  };
}

async function publishExecutionAttestation(input: {
  wallet: string;
  reportHash: `0x${string}`;
}) {
  const result = await publishAttestation({
    treasuryAddress: input.wallet,
    reportHash: input.reportHash,
    network: "sepolia",
  });

  if (result.transactionHash) {
    await indexPublishedAttestationTransaction(result.transactionHash);
  }

  return result;
}
