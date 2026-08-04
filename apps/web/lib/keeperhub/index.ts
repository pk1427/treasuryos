import type {
  ActionPlan,
  ExecutionResult,
  SimulationResult,
} from "@/types";

const KEEPERHUB_API_URL =
  process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com";
const KEEPERHUB_POLL_ATTEMPTS = 30;
const KEEPERHUB_POLL_INTERVAL_MS = 1_000;

async function keeperhubRequest(
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const res = await fetch(`${KEEPERHUB_API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error:
          (data as { error?: string }).error ??
          `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function simulate(
  actionPlan: ActionPlan
): Promise<SimulationResult> {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey) {
    console.error("[keeperhub:simulate] Missing KEEPERHUB_API_KEY");
    return {
      success: false,
      gasEstimate: BigInt(0),
      gasCostUsd: 0,
      message: "KEEPERHUB_API_KEY is not configured.",
    };
  }

  const contractAddress =
    actionPlan.contractAddress ??
    process.env.UNISWAP_SWAP_ROUTER_ADDRESS ??
    "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

  const functionName = actionPlan.functionName ?? "exactInputSingle";
  const functionArgs = actionPlan.functionArgs ?? "[]";
  const abi = actionPlan.abi ?? "[]";

  const result = await keeperhubRequest("/api/execute/contract-call", {
    contractAddress,
    chainId: actionPlan.chainId,
    functionName,
    functionArgs,
    abi,
    simulate: true,
    value: actionPlan.value ?? "0",
  }, apiKey);

  const isWouldRevert =
    result.status === 400 &&
    (result.data as { wouldRevert?: boolean }).wouldRevert === true;

  if (result.ok && result.status === 200) {
    const data = result.data as {
      success?: boolean;
      gasEstimate?: string;
      gasCostUsd?: number;
      message?: string;
      wouldRevert?: boolean;
      revertReason?: string;
    };

    if (data.wouldRevert) {
      console.error(
        `[keeperhub:simulate] Simulation would revert: ${data.revertReason ?? "unknown reason"}`
      );
      return {
        success: false,
        gasEstimate: BigInt(0),
        gasCostUsd: 0,
        message: `Simulation would revert: ${data.revertReason ?? "unknown reason"}`,
        wouldRevert: true,
        revertReason: data.revertReason,
      };
    }

    return {
      success: data.success ?? true,
      gasEstimate: BigInt(data.gasEstimate ?? 150_000),
      gasCostUsd: data.gasCostUsd ?? 0.05,
      message: data.message ?? "Simulation successful",
    };
  }

  if (isWouldRevert) {
    const data = result.data as {
      success?: boolean;
      revertReason?: string;
      error?: string;
    };
    console.error(
      `[keeperhub:simulate] Would-revert (HTTP ${result.status}): ${data.revertReason ?? data.error ?? "unknown"}`
    );
    return {
      success: false,
      gasEstimate: BigInt(0),
      gasCostUsd: 0,
      message: `Simulation would revert: ${data.revertReason ?? data.error ?? "unknown reason"}`,
      wouldRevert: true,
      revertReason: data.revertReason ?? data.error,
    };
  }

  console.error(
    `[keeperhub:simulate] API error: status=${result.status}, error=${result.error ?? "unknown"}, body=${JSON.stringify(result.data)}`
  );
  return {
    success: false,
    gasEstimate: BigInt(0),
    gasCostUsd: 0,
    message: `KeeperHub simulation failed: ${result.error ?? `HTTP ${result.status}`}`,
  };
}

export async function estimateGas(
  actionPlan: ActionPlan
): Promise<{ gasEstimate: bigint; gasCostUsd: number }> {
  const result = await simulate(actionPlan);
  return {
    gasEstimate: result.gasEstimate,
    gasCostUsd: result.gasCostUsd,
  };
}

export async function execute(
  actionPlan: ActionPlan
): Promise<ExecutionResult> {
  const simulation = await simulate(actionPlan);

  if (!simulation.success) {
    return {
      txHash: "",
      status: "failed",
    };
  }

  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey) {
    console.error("[keeperhub:execute] Missing KEEPERHUB_API_KEY");
    return {
      txHash: "",
      status: "failed",
      gasUsed: simulation.gasEstimate,
    };
  }

  const contractAddress =
    actionPlan.contractAddress ??
    process.env.UNISWAP_SWAP_ROUTER_ADDRESS ??
    "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

  const functionName = actionPlan.functionName ?? "exactInputSingle";
  const functionArgs = actionPlan.functionArgs ?? "[]";
  const abi = actionPlan.abi ?? "[]";

  const result = await keeperhubRequest("/api/execute/contract-call", {
    contractAddress,
    chainId: actionPlan.chainId,
    functionName,
    functionArgs,
    abi,
    simulate: false,
    value: actionPlan.value ?? "0",
  }, apiKey);

  if (result.ok && (result.status === 200 || result.status === 202)) {
    const data = result.data as KeeperHubExecutionStatus;
    const finalResult = !data.transactionHash && data.executionId
      ? await pollExecutionStatus(data.executionId, apiKey, data)
      : data;
    const chainId = typeof finalResult.result?.chainId === "string"
      ? parseInt(finalResult.result.chainId, 10)
      : finalResult.result?.chainId;
    const status = finalResult.status === "failed"
      ? "failed"
      : finalResult.transactionHash && (finalResult.status === "completed" || finalResult.status === "confirmed")
        ? "confirmed"
        : "pending";

    return {
      executionId: finalResult.executionId ?? data.executionId,
      txHash: finalResult.transactionHash ?? "",
      status,
      gasUsed: finalResult.gasUsed ? BigInt(finalResult.gasUsed) : simulation.gasEstimate,
      explorerUrl: finalResult.transactionLink,
      chainId,
      sponsored: finalResult.sponsored ?? false,
      executionMode: "keeperhub" as const,
    };
  }

  const apiError = result.error ?? `HTTP ${result.status}`;
  console.error(
    `[keeperhub:execute] API error: status=${result.status}, error=${apiError}, body=${JSON.stringify(result.data)}`
  );
  return {
    txHash: "",
    status: "failed",
    gasUsed: simulation.gasEstimate,
  };
}

type KeeperHubExecutionStatus = {
  executionId?: string;
  status?: string;
  transactionHash?: string;
  gasUsed?: string;
  transactionLink?: string;
  sponsored?: boolean;
  result?: { chainId?: string | number };
};

async function pollExecutionStatus(
  executionId: string,
  apiKey: string,
  initial: KeeperHubExecutionStatus
): Promise<KeeperHubExecutionStatus> {
  let latest = initial;

  for (let attempt = 0; attempt < KEEPERHUB_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${KEEPERHUB_API_URL}/api/execute/${executionId}/status`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json().catch(() => ({})) as KeeperHubExecutionStatus;
    if (!response.ok) {
      throw new Error(`KeeperHub status request failed with HTTP ${response.status}.`);
    }

    latest = { ...latest, ...data, executionId };
    if (latest.status === "failed" || latest.transactionHash) return latest;
    await delay(KEEPERHUB_POLL_INTERVAL_MS);
  }

  return latest;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
