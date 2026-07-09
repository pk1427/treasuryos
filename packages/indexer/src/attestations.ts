import {
  decodeEventLog,
  getAddress,
  type Address,
  type Hash,
} from "viem";
import { publicClient } from "./client";

export const ATTESTATION_PUBLISHED_ABI = [
  {
    type: "event",
    name: "AttestationPublished",
    inputs: [
      { name: "treasury", type: "address", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: true },
      { name: "publisher", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;

export type IndexedAttestation = {
  network: string;
  treasury: Address;
  reportHash: Hash;
  publisher: Address;
  txHash: Hash;
  blockNumber: bigint;
  timestamp: Date;
};

export async function indexAttestationTransaction({
  txHash,
  registryAddress = process.env.ATTESTATION_REGISTRY_ADDRESS,
  network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia",
}: {
  txHash: Hash;
  registryAddress?: string;
  network?: string;
}): Promise<IndexedAttestation[]> {
  const registry = registryAddress ? normalizeAddress(registryAddress) : null;
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const timestamp = new Date(Number(block.timestamp) * 1000);

  return receipt.logs
    .filter((log) => !registry || getAddress(log.address) === registry)
    .map((log) =>
      decodeAttestationLog({
        address: log.address,
        topics: log.topics,
        data: log.data,
        txHash,
        blockNumber: receipt.blockNumber,
        timestamp,
        network,
      })
    )
    .filter(
      (attestation): attestation is IndexedAttestation =>
        attestation !== null
    );
}

export async function getAttestationEvents({
  registryAddress = process.env.ATTESTATION_REGISTRY_ADDRESS,
  fromBlock,
  toBlock,
  network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia",
}: {
  registryAddress?: string;
  fromBlock: bigint;
  toBlock?: bigint;
  network?: string;
}): Promise<IndexedAttestation[]> {
  if (!registryAddress) {
    throw new Error("ATTESTATION_REGISTRY_ADDRESS is required to index events.");
  }

  const logs = await publicClient.getContractEvents({
    address: normalizeAddress(registryAddress),
    abi: ATTESTATION_PUBLISHED_ABI,
    eventName: "AttestationPublished",
    fromBlock,
    toBlock,
  });

  const blockTimestamps = new Map<bigint, Date>();
  const events: IndexedAttestation[] = [];

  for (const log of logs) {
    if (!log.transactionHash || !log.blockNumber) continue;
    const { treasury, reportHash, publisher } = log.args;
    if (!treasury || !reportHash || !publisher) continue;

    let timestamp = blockTimestamps.get(log.blockNumber);
    if (!timestamp) {
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
      timestamp = new Date(Number(block.timestamp) * 1000);
      blockTimestamps.set(log.blockNumber, timestamp);
    }

    events.push({
      network,
      treasury: getAddress(treasury),
      reportHash,
      publisher: getAddress(publisher),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp,
    });
  }

  return events;
}

export function watchAttestationPublished({
  registryAddress = process.env.ATTESTATION_REGISTRY_ADDRESS,
  network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia",
  onEvent,
}: {
  registryAddress?: string;
  network?: string;
  onEvent: (attestation: IndexedAttestation) => void | Promise<void>;
}) {
  if (!registryAddress) {
    throw new Error("ATTESTATION_REGISTRY_ADDRESS is required to watch events.");
  }

  return publicClient.watchContractEvent({
    address: normalizeAddress(registryAddress),
    abi: ATTESTATION_PUBLISHED_ABI,
    eventName: "AttestationPublished",
    onLogs: async (logs) => {
      for (const log of logs) {
        if (!log.transactionHash || !log.blockNumber) continue;
        const { treasury, reportHash, publisher } = log.args;
        if (!treasury || !reportHash || !publisher) continue;

        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        await onEvent({
          network,
          treasury: getAddress(treasury),
          reportHash,
          publisher: getAddress(publisher),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: new Date(Number(block.timestamp) * 1000),
        });
      }
    },
  });
}

function decodeAttestationLog(input: {
  address: Address;
  topics: readonly [] | readonly [`0x${string}`, ...`0x${string}`[]];
  data: Hash;
  txHash: Hash;
  blockNumber: bigint;
  timestamp: Date;
  network: string;
}): IndexedAttestation | null {
  try {
    const event = decodeEventLog({
      abi: ATTESTATION_PUBLISHED_ABI,
      eventName: "AttestationPublished",
      topics: [...input.topics] as [
        signature: `0x${string}`,
        ...args: `0x${string}`[],
      ],
      data: input.data,
    });

    const { treasury, reportHash, publisher } = event.args;
    if (!treasury || !reportHash || !publisher) return null;

    return {
      network: input.network,
      treasury: getAddress(treasury),
      reportHash,
      publisher: getAddress(publisher),
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      timestamp: input.timestamp,
    };
  } catch {
    return null;
  }
}

function normalizeAddress(address: string): Address {
  return getAddress(address);
}
