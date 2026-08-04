import { createPublicClient, formatUnits, http, parseEther } from "viem";
import { sepolia } from "viem/chains";
import type { ActionPlan } from "@/types";
import type { PlanStep } from "@/lib/ai/plan-types";
import type { ExecutableAction, ExecutionQuote, ExecutionAdapter, PreparedTransaction } from "@/lib/execution/types";
import { encodeExactInputSingle, exactInputSingleAbi } from "./encoder";
import { simulate as keeperhubSimulate } from "@/lib/keeperhub";

const ZERO_ADDRESS = "0x00000000000000000000000000000000000000" as const;
const FACTORY = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c" as const;
const WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as const;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const;
const ROUTER = (process.env.UNISWAP_SWAP_ROUTER_ADDRESS ?? "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E") as `0x${string}`;
const FEE = Number(process.env.UNISWAP_SWAP_POOL_FEE ?? 3000);
const SLIPPAGE_BPS = 50;

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
});

function inputAmount(step: PlanStep) {
  const amount = step.amountToken?.match(/^([0-9]+(?:\.[0-9]+)?)/)?.[1];
  if (!amount) throw new Error("Swap plan is missing an ETH input amount.");
  return parseEther(amount);
}

export function planStepToActionPlan(step: PlanStep, walletAddress: string): ActionPlan {
  const amount = step.amountToken?.match(/^([0-9]+(?:\.[0-9]+)?)/)?.[1] ?? "0";
  const amountIn = parseEther(amount);
  return {
    action: "transfer",
    tokenSymbol: step.toAsset ?? step.asset ?? "USDC",
    tokenAddress: USDC,
    amount,
    amountUsd: step.amountUsd ?? 0,
    from: walletAddress,
    to: ROUTER,
    chainId: 11155111,
    contractAddress: ROUTER,
    functionName: "exactInputSingle",
    functionArgs: JSON.stringify([
      {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: FEE,
        recipient: walletAddress,
        amountIn: amountIn.toString(),
        amountOutMinimum: "0",
        sqrtPriceLimitX96: "0",
      },
    ]),
    abi: JSON.stringify(exactInputSingleAbi),
    value: formatUnits(amountIn, 18),
  };
}

export const keeperhubExecutionAdapter: ExecutionAdapter & {
  routing?: "public" | "private";
  gasStrategy?: "standard" | "smart-backoff";
  gasSponsored?: boolean;
  auditTrailRef?: string;
} = {
  id: "keeperhub",

  async discover(snapshot) {
    const eth = snapshot.positions
      .filter((position) => position.protocol === "Wallet" && position.asset === "ETH")
      .reduce((sum, position) => sum + position.amountUsd, 0);

    if (eth <= 0) return [];

    const pool = await client.readContract({
      address: FACTORY,
      abi: [
        {
          name: "getPool",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "tokenA", type: "address" },
            { name: "tokenB", type: "address" },
            { name: "fee", type: "uint24" },
          ],
          outputs: [{ name: "pool", type: "address" }],
        },
      ],
      functionName: "getPool",
      args: [WETH, USDC, FEE],
    });

    if (pool.toLowerCase() === ZERO_ADDRESS) return [];

    return [
      {
        adapterId: "keeperhub",
        action: "swap",
        fromAsset: "ETH",
        toAsset: "USDC",
        availableUsd: eth,
        label: "Swap ETH to USDC via KeeperHub",
      } satisfies ExecutableAction,
    ];
  },

  async quote(step) {
    if (step.quote) {
      return {
        ...step.quote,
        adapterId: "keeperhub",
      } satisfies ExecutionQuote;
    }

    const amountIn = inputAmount(step);

    return {
      adapterId: "keeperhub",
      amountIn: amountIn.toString(),
      amountOut: "0",
      amountOutUsd: 0,
      amountOutMinimum: "0",
      slippageBps: SLIPPAGE_BPS,
      route: "keeperhub",
    } satisfies ExecutionQuote;
  },

  buildTransaction(step, walletAddress) {
    const quote = step.quote;
    if (!quote) throw new Error("Plan step is missing a quote.");

    const amountIn = BigInt(quote.amountIn);

    return {
      to: ROUTER,
      data: encodeExactInputSingle({
        tokenIn: WETH,
        tokenOut: USDC,
        fee: FEE,
        recipient: walletAddress,
        amountIn,
        amountOutMinimum: BigInt(quote.amountOutMinimum),
        sqrtPriceLimitX96: BigInt(0),
      }),
      value: `0x${amountIn.toString(16)}`,
      chainId: "0xaa36a7",
    } satisfies PreparedTransaction;
  },

  async simulate(step, walletAddress) {
    try {
      const actionPlan = planStepToActionPlan(step, walletAddress);
      const result = await keeperhubSimulate(actionPlan);

      return {
        success: result.success,
        estimatedGas: result.gasEstimate?.toString(),
        note: result.message,
        error: result.success ? undefined : "KEEPERHUB_SIMULATION_FAILED",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "KEEPERHUB_SIMULATION_FAILED",
        note: "KeeperHub simulation failed.",
      };
    }
  },

  routing: "private",
  gasStrategy: "smart-backoff",
  gasSponsored: true,
};
