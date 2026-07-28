import { encodeFunctionData, parseEther, parseUnits } from "viem";
import type { PlanStep } from "@/lib/ai/plan-types";

const UNISWAP_SWAP_ROUTER =
  process.env.UNISWAP_SWAP_ROUTER_ADDRESS ??
  "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
const UNISWAP_POOL_FEE = Number(process.env.UNISWAP_SWAP_POOL_FEE ?? 3000);
const WETH_SEPOLIA = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const swapRouterAbi = [
  {
    name: "exactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

export type PreparedSwapTransaction = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  chainId: `0x${string}`;
};

export function buildEthToUsdcSwapTransaction(
  step: PlanStep,
  walletAddress: string
): PreparedSwapTransaction {
  const amountIn = parseEthStepAmount(step);

  const data = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH_SEPOLIA,
        tokenOut: USDC_SEPOLIA,
        fee: UNISWAP_POOL_FEE,
        recipient: walletAddress as `0x${string}`,
        amountIn,
        amountOutMinimum: BigInt(0),
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  return {
    to: UNISWAP_SWAP_ROUTER as `0x${string}`,
    data,
    value: `0x${amountIn.toString(16)}`,
    chainId: "0xaa36a7",
  };
}

function parseEthStepAmount(step: PlanStep): bigint {
  const match = step.amountToken?.match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    return parseEther(match[1]);
  }

  if (typeof step.amountUsd === "number" && step.amountUsd > 0) {
    return parseUnits(step.amountUsd.toFixed(18), 18);
  }

  throw new Error("Execution preconditions failed.");
}
