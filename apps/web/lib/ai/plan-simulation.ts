import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";
import type { TreasurySnapshot } from "@treasuryos/shared";

const KEEPERHUB_API_URL =
  process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com";

export type StepSimulationResult = {
  order: number;
  protocol: string;
  action: string;
  success: boolean;
  estimatedGas?: string;
  note?: string;
  error?: string;
  rawKeeperHubResponse?: Record<string, unknown>;
};

export type PlanSimulationResult = {
  steps: StepSimulationResult[];
  overallSuccess: boolean;
  projectedFinalState?: Record<string, unknown>;
  warnings: string[];
  rawKeeperHubResponse: Record<string, unknown>;
  snapshotWarning?: string;
};

export async function simulatePlanSteps(
  plan: ExecutionPlan,
  snapshot: TreasurySnapshot
): Promise<PlanSimulationResult> {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const steps: StepSimulationResult[] = [];
  const warnings: string[] = [];
  const rawResponses: Record<number, unknown> = {};

  for (const step of plan.steps) {
    if (step.protocol === "aave" && step.action === "repay") {
      const result = await simulateAaveRepay(step, snapshot, apiKey);
      steps.push(result);
      rawResponses[step.order] = result.rawKeeperHubResponse ?? {};
    } else if (step.protocol === "uniswap" && step.action === "collect-fees") {
      const result = await simulateUniswapCollect(step, snapshot, apiKey);
      steps.push(result);
      rawResponses[step.order] = result.rawKeeperHubResponse ?? {};
    } else if (step.protocol === "wallet" && step.action === "swap") {
      steps.push({
        order: step.order,
        protocol: step.protocol,
        action: step.action,
        success: false,
        note: "Swap simulation requires a configured DEX router address.",
        error: "NO_DEX_ROUTER_CONFIGURED",
      });
      warnings.push(
        `Step ${step.order}: Wallet swap simulation skipped — no DEX router configured.`
      );
    } else {
      steps.push({
        order: step.order,
        protocol: step.protocol,
        action: step.action,
        success: false,
        note: "Simulation not yet supported for this step type.",
        error: "UNSUPPORTED_STEP_TYPE",
      });
    }
  }

  const overallSuccess = steps.every((s) => s.success);

  return {
    steps,
    overallSuccess,
    projectedFinalState: buildProjectedFinalState(plan, steps),
    warnings,
    rawKeeperHubResponse: rawResponses,
  };
}

async function simulateAaveRepay(
  step: PlanStep,
  snapshot: TreasurySnapshot,
  apiKey?: string
): Promise<StepSimulationResult> {
  if (!apiKey) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      note: "Demo mode: KeeperHub API key not configured. Simulation skipped.",
      estimatedGas: "0.00042 ETH",
    };
  }

  const aavePositions = snapshot.positions.filter((p) => p.protocol === "Aave");
  const reserve = aavePositions.find(
    (p) => p.asset === step.asset && p.metadata?.positionType === "borrowed"
  );

  if (!reserve || !reserve.metadata?.underlying) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: false,
      error: "NO_BORROWED_POSITION_FOUND",
      note: `Cannot simulate repay: no borrowed ${step.asset} position found in snapshot.`,
    };
  }

  const underlyingAddress = (reserve.metadata as { underlying?: string }).underlying;
  const amount = BigInt(Math.round((step.amountUsd ?? 0) * 1e6));
  const onBehalfOf = snapshot.address as `0x${string}`;
  const contractAddress = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"; // Aave V3 Pool

  const abi = [
    {
      name: "repay",
      type: "function",
      inputs: [
        { name: "asset", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "onBehalfOf", type: "address" },
        { name: "referralCode", type: "uint16" },
      ],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "nonpayable",
    },
  ];

  try {
    const response = await callKeeperHubSimulate({
      contractAddress,
      functionName: "repay",
      functionArgs: [underlyingAddress, amount.toString(), onBehalfOf, 0],
      abi,
      apiKey,
    });

    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof response.gasEstimate === "string"
          ? response.gasEstimate
          : "0.00042 ETH",
      note:
        typeof response.message === "string"
          ? response.message
          : "Simulation successful.",
      rawKeeperHubResponse: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "SIMULATION_FAILED";
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: false,
      error: errorMessage,
      note: `Aave repay simulation failed: ${errorMessage}`,
      rawKeeperHubResponse: error instanceof Error && error.cause
        ? { cause: error.cause }
        : { message: errorMessage },
    };
  }
}

async function simulateUniswapCollect(
  step: PlanStep,
  _snapshot: TreasurySnapshot,
  apiKey?: string
): Promise<StepSimulationResult> {
  if (!apiKey) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      note: "Demo mode: KeeperHub API key not configured. Simulation skipped.",
      estimatedGas: "0.00018 ETH",
    };
  }

  const uniswapPositions = _snapshot.positions.filter((p) => p.protocol === "Uniswap");
  const position = uniswapPositions[0];

  if (!position || !position.metadata) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: false,
      error: "NO_UNISWAP_POSITION_FOUND",
      note: "Cannot simulate collect: no Uniswap position found in snapshot.",
    };
  }

  const metadata = position.metadata as { tokenId?: string };
  const tokenId = metadata.tokenId ?? "0";
  const recipient = _snapshot.address as `0x${string}`;
  const contractAddress = "0x1238536071E1c677A632429e3655c799b22cDA52"; // NonfungiblePositionManager

  const abi = [
    {
      name: "collect",
      type: "function",
      inputs: [
        { name: "tokenId", type: "uint256" },
        { name: "recipient", type: "address" },
        { name: "maxAmount0", type: "uint256" },
        { name: "maxAmount1", type: "uint256" },
      ],
      outputs: [
        { name: "amount0", type: "uint256" },
        { name: "amount1", type: "uint256" },
      ],
      stateMutability: "nonpayable",
    },
  ];

  try {
    const response = await callKeeperHubSimulate({
      contractAddress,
      functionName: "collect",
      functionArgs: [tokenId, recipient, "115792089237316195423570985008687907853269984665640564039457584007913129639935", "115792089237316195423570985008687907853269984665640564039457584007913129639935"],
      abi,
      apiKey,
    });

    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof response.gasEstimate === "string"
          ? response.gasEstimate
          : "0.00018 ETH",
      note:
        typeof response.message === "string"
          ? response.message
          : "Simulation successful.",
      rawKeeperHubResponse: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "SIMULATION_FAILED";
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: false,
      error: errorMessage,
      note: `Uniswap collect simulation failed: ${errorMessage}`,
      rawKeeperHubResponse: error instanceof Error && error.cause
        ? { cause: error.cause }
        : { message: errorMessage },
    };
  }
}

async function callKeeperHubSimulate(input: {
  contractAddress: string;
  functionName: string;
  functionArgs: unknown[];
  abi: unknown[];
  apiKey: string;
}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${input.apiKey}`,
  };

  const response = await fetch(
    `${KEEPERHUB_API_URL}/api/execute/contract-call`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        contractAddress: input.contractAddress,
        network: process.env.NEXT_PUBLIC_CHAIN ?? "base-sepolia",
        functionName: input.functionName,
        functionArgs: JSON.stringify(input.functionArgs),
        abi: JSON.stringify(input.abi),
        simulate: true,
      }),
    }
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      (data.error as string) ??
        (data.message as string) ??
        "KeeperHub simulation failed."
    );
  }

  return data;
}

function buildProjectedFinalState(
  plan: ExecutionPlan,
  stepResults: StepSimulationResult[]
): Record<string, unknown> {
  const healthFactorBefore = plan.expectedOutcome.healthFactorBefore;
  const healthFactorAfter = plan.expectedOutcome.healthFactorAfter;
  const allSuccessful = stepResults.every((s) => s.success);
  const ethExposure = allSuccessful
    ? plan.expectedOutcome.ethExposureAfter
    : plan.expectedOutcome.ethExposureBefore;
  const stablecoinRatio = allSuccessful
    ? plan.expectedOutcome.stablecoinRatioAfter
    : plan.expectedOutcome.stablecoinRatioBefore;

  return {
    healthFactor: allSuccessful
      ? healthFactorAfter ?? healthFactorBefore ?? "N/A"
      : healthFactorBefore ?? "N/A",
    ethExposure: `${((ethExposure ?? 0) * 100).toFixed(1)}%`,
    stablecoinRatio: `${((stablecoinRatio ?? 0) * 100).toFixed(1)}%`,
    allStepsSuccessful: allSuccessful,
    failedSteps: stepResults
      .filter((s) => !s.success)
      .map((s) => ({ order: s.order, action: s.action, error: s.error })),
  };
}
