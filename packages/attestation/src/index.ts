import { createHash, randomUUID } from "node:crypto";
import type {
  AttestationResult,
  AttestationSimulation,
  RiskReport,
} from "@treasuryos/shared";

const KEEPERHUB_API_URL =
  process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com";

export const ATTESTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "publishAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "treasury", type: "address" },
      { name: "reportHash", type: "bytes32" },
    ],
    outputs: [],
  },
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

export function hashRiskReport(report: RiskReport): `0x${string}` {
  return `0x${createHash("sha256")
    .update(stableStringify(report))
    .digest("hex")}`;
}

export async function simulateAttestation(input: {
  treasuryAddress: string;
  reportHash: `0x${string}`;
  registryAddress?: string;
  network?: string;
}): Promise<AttestationSimulation> {
  return callKeeperHub({
    ...input,
    simulate: true,
  });
}

export async function publishAttestation(input: {
  treasuryAddress: string;
  reportHash: `0x${string}`;
  registryAddress?: string;
  network?: string;
}): Promise<AttestationResult> {
  const execution = await callKeeperHub({
    ...input,
    simulate: false,
  });

  if (!execution.executionId) {
    throw new Error("KeeperHub did not return an executionId.");
  }

  return pollExecution(execution.executionId);
}

async function callKeeperHub(input: {
  treasuryAddress: string;
  reportHash: `0x${string}`;
  registryAddress?: string;
  network?: string;
  simulate: boolean;
}): Promise<AttestationSimulation & { executionId?: string }> {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const contractAddress =
    input.registryAddress ?? process.env.ATTESTATION_REGISTRY_ADDRESS;

  if (!apiKey || !contractAddress) {
    return {
      ok: true,
      status: input.simulate ? "simulated" : "demo",
      executionId: input.simulate ? undefined : `demo-${randomUUID()}`,
      message:
        "Demo mode: set KEEPERHUB_API_KEY and ATTESTATION_REGISTRY_ADDRESS for a live KeeperHub call.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (!input.simulate) {
    headers["Idempotency-Key"] = randomUUID();
  }

  const response = await fetch(
    `${KEEPERHUB_API_URL}/api/execute/contract-call`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        contractAddress,
        network: input.network ?? process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia",
        functionName: "publishAttestation",
        functionArgs: JSON.stringify([
          input.treasuryAddress,
          input.reportHash,
        ]),
        abi: JSON.stringify(ATTESTATION_REGISTRY_ABI),
        simulate: input.simulate,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? "KeeperHub call failed.");
  }

  return {
    ok: true,
    status: data.status ?? "submitted",
    executionId: data.executionId,
    message: data.message,
    gasEstimate: data.gasEstimate,
  };
}

async function pollExecution(executionId: string): Promise<AttestationResult> {
  if (executionId.startsWith("demo-")) {
    return {
      executionId,
      status: "completed",
      transactionHash: demoTransactionHash(executionId),
      transactionLink: undefined,
    };
  }

  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey) {
    throw new Error("KEEPERHUB_API_KEY is required to poll a live execution.");
  }

  let intervalMs = 1_000;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(
      `${KEEPERHUB_API_URL}/api/execute/${executionId}/status`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error ?? data.message ?? "KeeperHub status failed.");
    }

    if (data.status === "completed" || data.status === "failed") {
      return {
        executionId,
        status: data.status,
        transactionHash: data.transactionHash,
        transactionLink: data.transactionLink,
      };
    }

    const hint = response.headers.get("X-Poll-Interval-Hint");
    const hintedInterval = hint ? Number(hint) : Number.NaN;
    if (hintedInterval === 0) {
      return {
        executionId,
        status: data.status,
        transactionHash: data.transactionHash,
        transactionLink: data.transactionLink,
      };
    }
    if (Number.isFinite(hintedInterval) && hintedInterval > 0) {
      intervalMs = hintedInterval;
    }

    await delay(intervalMs);
  }

  throw new Error("KeeperHub execution did not finish before the poll timeout.");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function demoTransactionHash(seed: string): `0x${string}` {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
