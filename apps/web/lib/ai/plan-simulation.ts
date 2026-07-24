import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { ExecutionPlan, PlanStep } from "@/lib/ai/plan-types";
import type { TreasurySnapshot } from "@treasuryos/shared";

const KEEPERHUB_API_URL =
  process.env.KEEPERHUB_API_URL ?? "https://app.keeperhub.com";

const viemClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
});

const AAVE_POOL = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";
const UNISWAP_SWAP_ROUTER = "0x68b3465833fb72A70ecF484E0b4C990D5";
const USDC_SEPOLIA = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";

const UNISWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
  },
];

export type StepSimulationResult = {
  order: number;
  protocol: string;
  action: string;
  success: boolean;
  estimatedGas?: string;
  note?: string;
  error?: string;
  rawKeeperHubResponse?: Record<string, unknown>;
  rawViemResponse?: Record<string, unknown>;
};

export type PlanSimulationResult = {
  steps: StepSimulationResult[];
  overallSuccess: boolean;
  projectedFinalState?: Record<string, unknown>;
  warnings: string[];
  rawKeeperHubResponse: Record<string, unknown>;
  snapshotWarning?: string;
  simulationMode: "keeperhub" | "viem-user-context";
};

export async function simulatePlanSteps(
  plan: ExecutionPlan,
  snapshot: TreasurySnapshot,
  connectedWallet?: string
): Promise<PlanSimulationResult> {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  const steps: StepSimulationResult[] = [];
  const warnings: string[] = [];
  const rawResponses: Record<number, unknown> = {};
  const rawViemResponses: Record<number, unknown> = {};
  let simulationMode: PlanSimulationResult["simulationMode"] = "keeperhub";

  for (const step of plan.steps) {
    if (step.protocol === "aave" && step.action === "repay") {
      const result = await simulateAaveRepay(step, snapshot, apiKey, connectedWallet);
      steps.push(result);
      rawResponses[step.order] = result.rawKeeperHubResponse ?? {};
      rawViemResponses[step.order] = result.rawViemResponse ?? {};
      if (result.rawViemResponse) simulationMode = "viem-user-context";
    } else if (step.protocol === "uniswap" && step.action === "collect-fees") {
      const result = await simulateUniswapCollect(step, snapshot, apiKey, connectedWallet);
      steps.push(result);
      rawResponses[step.order] = result.rawKeeperHubResponse ?? {};
      rawViemResponses[step.order] = result.rawViemResponse ?? {};
      if (result.rawViemResponse) simulationMode = "viem-user-context";
} else if (step.protocol === "wallet" && step.action === "swap") {
       const result = await simulateWalletSwap(step, snapshot, apiKey, connectedWallet);
       steps.push(result);
       rawResponses[step.order] = result.rawKeeperHubResponse ?? {};
       rawViemResponses[step.order] = result.rawViemResponse ?? {};
       if (result.rawViemResponse) simulationMode = "viem-user-context";
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
    snapshotWarning: undefined,
    simulationMode,
  };
}

async function simulateAaveRepay(
  step: PlanStep,
  snapshot: TreasurySnapshot,
  apiKey?: string,
  connectedWallet?: string
): Promise<StepSimulationResult> {
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
  const fromAddress = (connectedWallet ?? snapshot.address) as `0x${string}`;

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

  const keeperhubArgs = [underlyingAddress, amount.toString(), onBehalfOf, 0] as unknown[];

  const keeperhubResult = apiKey
    ? await callKeeperHubSimulate({
        contractAddress: AAVE_POOL,
        functionName: "repay",
        functionArgs: keeperhubArgs,
        abi,
        apiKey,
      }).catch((error) => ({ error: error instanceof Error ? error.message : "KEEPERHUB_FAILED" }))
    : null;

  let viemResult: Record<string, unknown> | null = null;
  try {
    const viemResultRaw = await viemClient.simulateContract({
      address: AAVE_POOL,
      abi,
      functionName: "repay",
      args: [underlyingAddress, amount, onBehalfOf, 0],
      account: fromAddress,
    });
    viemResult = { success: true, result: viemResultRaw };
  } catch (error) {
    viemResult = {
      success: false,
      error: error instanceof Error ? error.message : "VIEM_SIMULATION_FAILED",
    };
  }

  const viemSucceeded = viemResult && (viemResult as { success?: boolean }).success !== false;
  const keeperhubSucceeded = keeperhubResult && !(keeperhubResult as { error?: string }).error;

  if (viemSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (viemResult as { result?: { gas?: bigint } }).result?.gas === "bigint"
          ? (viemResult as { result: { gas: bigint } }).result.gas.toString()
          : "0.00042 ETH",
      note: `Simulation successful from ${fromAddress}.`,
      rawViemResponse: viemResult,
      rawKeeperHubResponse: keeperhubResult ?? undefined,
    };
  }

  if (keeperhubSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (keeperhubResult as Record<string, unknown>).gasEstimate === "string"
          ? (keeperhubResult as { gasEstimate: string }).gasEstimate
          : "0.00042 ETH",
      note:
        typeof (keeperhubResult as Record<string, unknown>).message === "string"
          ? (keeperhubResult as { message: string }).message
          : "Simulation successful.",
      rawKeeperHubResponse: keeperhubResult,
    };
  }

  return {
    order: step.order,
    protocol: step.protocol,
    action: step.action,
    success: false,
    error: viemResult && (viemResult as { error?: string }).error
      ? (viemResult as { error: string }).error
      : "SIMULATION_FAILED",
    note: `Aave repay simulation failed: ${(viemResult && (viemResult as { error?: string }).error) || (keeperhubResult && (keeperhubResult as { error?: string }).error) || "Unknown error"}`,
    rawViemResponse: viemResult,
    rawKeeperHubResponse: keeperhubResult ?? undefined,
  };
}

async function simulateUniswapCollect(
  step: PlanStep,
  _snapshot: TreasurySnapshot,
  apiKey?: string,
  connectedWallet?: string
): Promise<StepSimulationResult> {
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
  const fromAddress = (connectedWallet ?? _snapshot.address) as `0x${string}`;

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

  const keeperhubResult = apiKey
    ? await callKeeperHubSimulate({
        contractAddress: UNISWAP_SWAP_ROUTER,
        functionName: "collect",
        functionArgs: [
          tokenId,
          recipient,
          BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
          BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
        ],
        abi,
        apiKey,
      }).catch((error) => ({ error: error instanceof Error ? error.message : "KEEPERHUB_FAILED" }))
    : null;

  let viemResult: Record<string, unknown> | null = null;
  try {
    const viemResultRaw = await viemClient.simulateContract({
      address: UNISWAP_SWAP_ROUTER,
      abi,
      functionName: "collect",
      args: [
        BigInt(tokenId),
        recipient,
        BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
        BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
      ],
      account: fromAddress,
    });
    viemResult = { success: true, result: viemResultRaw };
  } catch (error) {
    viemResult = {
      success: false,
      error: error instanceof Error ? error.message : "VIEM_SIMULATION_FAILED",
    };
  }

  const viemSucceeded = viemResult && (viemResult as { success?: boolean }).success !== false;
  const keeperhubSucceeded = keeperhubResult && !(keeperhubResult as { error?: string }).error;

  if (viemSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (viemResult as { result?: { gas?: bigint } }).result?.gas === "bigint"
          ? (viemResult as { result: { gas: bigint } }).result.gas.toString()
          : "0.00018 ETH",
      note: `Simulation successful from ${fromAddress}.`,
      rawViemResponse: viemResult,
      rawKeeperHubResponse: keeperhubResult ?? undefined,
    };
  }

  if (keeperhubSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (keeperhubResult as Record<string, unknown>).gasEstimate === "string"
          ? (keeperhubResult as { gasEstimate: string }).gasEstimate
          : "0.00018 ETH",
      note:
        typeof (keeperhubResult as Record<string, unknown>).message === "string"
          ? (keeperhubResult as { message: string }).message
          : "Simulation successful.",
      rawKeeperHubResponse: keeperhubResult,
    };
  }

  return {
    order: step.order,
    protocol: step.protocol,
    action: step.action,
    success: false,
    error: viemResult && (viemResult as { error?: string }).error
      ? (viemResult as { error: string }).error
      : "SIMULATION_FAILED",
    note: `Uniswap collect simulation failed: ${(viemResult && (viemResult as { error?: string }).error) || (keeperhubResult && (keeperhubResult as { error?: string }).error) || "Unknown error"}`,
    rawViemResponse: viemResult,
    rawKeeperHubResponse: keeperhubResult ?? undefined,
  };
}

async function simulateWalletSwap(
  step: PlanStep,
  _snapshot: TreasurySnapshot,
  apiKey?: string,
  connectedWallet?: string
): Promise<StepSimulationResult> {
  const fromAsset = (step.fromAsset ?? step.asset ?? "").toUpperCase();
  const toAsset = (step.toAsset ?? "").toUpperCase();
  const fromAddress = (connectedWallet ?? _snapshot.address) as `0x${string}`;
  const amountUsd = step.amountUsd ?? 0;
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const isEthInput = fromAsset === "ETH" || fromAsset === "WETH";
  const isUsdcOutput = toAsset === "USDC";
  const isUsdcInput = fromAsset === "USDC";
  const isEthOutput = toAsset === "ETH" || toAsset === "WETH";

  let keeperhubResult: Record<string, unknown> | undefined = undefined;
  let viemResult: Record<string, unknown> | null = null;

  if (apiKey) {
    try {
      keeperhubResult = await callKeeperHubSimulate({
        contractAddress: UNISWAP_SWAP_ROUTER,
        functionName: "exactInputSingle",
        functionArgs: [
          {
            sender: fromAddress,
            tokenIn: isEthInput
              ? "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeE"
              : USDC_SEPOLIA,
            tokenOut: isEthOutput
              ? "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeE"
              : USDC_SEPOLIA,
            fee: 500,
            recipient: fromAddress,
            deadline,
            amountIn: isEthInput ? BigInt(Math.round(amountUsd * 1e18)).toString() : "1",
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          },
        ],
        abi: UNISWAP_ROUTER_ABI,
        apiKey,
      }).catch((error) => ({ error: error instanceof Error ? error.message : "KEEPERHUB_FAILED" }));
    } catch {
      keeperhubResult = undefined;
    }
  }

  try {
    if (isEthInput && isUsdcOutput) {
      const viemRes = await viemClient.simulateContract({
        address: UNISWAP_SWAP_ROUTER,
        abi: UNISWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            sender: fromAddress,
            tokenIn: "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeE" as `0x${string}`,
            tokenOut: USDC_SEPOLIA as `0x${string}`,
            fee: 500,
            recipient: fromAddress,
            deadline: BigInt(deadline),
            amountIn: BigInt(Math.round(amountUsd * 1e18)),
            amountOutMinimum: BigInt(0),
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
        account: fromAddress,
        value: BigInt(Math.round(amountUsd * 1e18)),
      });
      viemResult = { success: true, result: viemRes };
    } else if (isUsdcInput && isEthOutput) {
      const viemRes = await viemClient.simulateContract({
        address: UNISWAP_SWAP_ROUTER,
        abi: UNISWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            sender: fromAddress,
            tokenIn: USDC_SEPOLIA as `0x${string}`,
            tokenOut: "0xEeeeeEeeeEeEeEeEeEeEEEeeeeEeeeeeeeEEeE" as `0x${string}`,
            fee: 500,
            recipient: fromAddress,
            deadline: BigInt(deadline),
            amountIn: BigInt(Math.round(amountUsd * 1e6)),
            amountOutMinimum: BigInt(0),
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
        account: fromAddress,
      });
      viemResult = { success: true, result: viemRes };
    } else {
      viemResult = {
        success: false,
        error: "UNSUPPORTED_SWAP_PAIR",
      };
    }
  } catch (error) {
    viemResult = {
      success: false,
      error: error instanceof Error ? error.message : "VIEM_SIMULATION_FAILED",
    };
  }

  const viemSucceeded = viemResult && (viemResult as { success?: boolean }).success === true;
  const keeperhubSucceeded = keeperhubResult && !(keeperhubResult as { error?: string }).error;

  if (viemSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (viemResult as { result?: { gas?: bigint } }).result?.gas === "bigint"
          ? (viemResult as { result: { gas: bigint } }).result.gas.toString()
          : "0.00042 ETH",
      note: `Swap simulation successful from ${fromAddress}.`,
      rawViemResponse: viemResult,
      rawKeeperHubResponse: keeperhubResult ?? undefined,
    };
  }

  if (keeperhubSucceeded) {
    return {
      order: step.order,
      protocol: step.protocol,
      action: step.action,
      success: true,
      estimatedGas:
        typeof (keeperhubResult as Record<string, unknown>).gasEstimate === "string"
          ? (keeperhubResult as { gasEstimate: string }).gasEstimate
          : "0.00042 ETH",
      note:
        typeof (keeperhubResult as Record<string, unknown>).message === "string"
          ? (keeperhubResult as { message: string }).message
          : "Simulation successful.",
      rawKeeperHubResponse: keeperhubResult,
    };
  }

  return {
    order: step.order,
    protocol: step.protocol,
    action: step.action,
    success: false,
    error: viemResult && (viemResult as { error?: string }).error
      ? (viemResult as { error: string }).error
      : "SIMULATION_FAILED",
    note: `Wallet swap simulation failed: ${(viemResult && (viemResult as { error?: string }).error) || (keeperhubResult && (keeperhubResult as { error?: string }).error) || "Unknown error"}`,
    rawViemResponse: viemResult,
    rawKeeperHubResponse: keeperhubResult ?? undefined,
  };
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
