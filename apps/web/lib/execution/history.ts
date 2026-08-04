import { createPublicClient, encodePacked, formatUnits, http, keccak256 } from "viem";
import { sepolia } from "viem/chains";
import type { PreparedTransaction } from "./types";
import { publishAttestation } from "@treasuryos/attestation";
import { executionHistoryRepo } from "@/server/repositories";
import { indexPublishedAttestationTransaction } from "@/server/services/attestation-indexer-service";
import { scanTreasury } from "@treasuryos/indexer";

const USDC_ADDRESS = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
  const actualOutput = findUsdcTransferToWallet(receipt.logs, input.wallet);

  const executionProofHash = keccak256(
    encodePacked(["bytes32", "bytes32"], [input.reportHash, input.txHash])
  );
  const attestation = await publishExecutionAttestation({
    wallet: input.wallet,
    executionProofHash,
  });
  const postExecutionSnapshot = await scanTreasury(input.wallet).catch((error) => {
    console.warn(
      "[execution] Post-confirmation treasury scan failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  });

  return {
    history,
    receipt,
    actualOutput,
    postExecutionSnapshot,
    attestation: { ...attestation, executionProofHash },
  };
}

function findUsdcTransferToWallet(
  logs: Array<{ address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }>,
  wallet: string
) {
  const normalizedWallet = wallet.toLowerCase();
  const amount = logs.reduce((total, log) => {
    const recipientTopic = log.topics[2];
    const recipient = recipientTopic
      ? `0x${recipientTopic.slice(-40)}`.toLowerCase()
      : null;
    const isUsdcTransfer =
      log.address.toLowerCase() === USDC_ADDRESS &&
      log.topics[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC &&
      recipient === normalizedWallet;

    return isUsdcTransfer ? total + BigInt(log.data) : total;
  }, BigInt(0));

  return amount > 0 ? { asset: "USDC" as const, amount: formatUnits(amount, 6) } : null;
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
