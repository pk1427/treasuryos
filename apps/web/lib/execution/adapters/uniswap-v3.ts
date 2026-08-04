import { createPublicClient, encodeFunctionData, formatUnits, http, parseEther } from "viem";
import { sepolia } from "viem/chains";
import type { PlanStep } from "@/lib/ai/plan-types";
import type { ExecutableAction, ExecutionAdapter, ExecutionQuote } from "../types";
import { summarizeSnapshot, tracePipeline } from "@/lib/debug/pipeline-trace";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FACTORY = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c" as const;
const ROUTER = (process.env.UNISWAP_SWAP_ROUTER_ADDRESS ?? "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E") as `0x${string}`;
const QUOTER = (process.env.UNISWAP_QUOTER_V2_ADDRESS ?? "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3") as `0x${string}`;
const WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as const;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const;
const FEE = Number(process.env.UNISWAP_SWAP_POOL_FEE ?? 3000);
const SLIPPAGE_BPS = Number(process.env.UNISWAP_SLIPPAGE_BPS ?? 50);
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com") });

const factoryAbi = [{ name: "getPool", type: "function", stateMutability: "view", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" }], outputs: [{ name: "pool", type: "address" }] }] as const;
const exactInputSingleAbi = [{ name: "exactInputSingle", type: "function", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "fee", type: "uint24" }, { name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }], outputs: [{ name: "amountOut", type: "uint256" }] }] as const;
const quoterAbi = [{ name: "quoteExactInputSingle", type: "function", stateMutability: "nonpayable", inputs: [{ name: "params", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }], outputs: [{ name: "amountOut", type: "uint256" }, { name: "sqrtPriceX96After", type: "uint160" }, { name: "initializedTicksCrossed", type: "uint32" }, { name: "gasEstimate", type: "uint256" }] }] as const;

function inputAmount(step: PlanStep) {
  const amount = step.amountToken?.match(/^([0-9]+(?:\.[0-9]+)?)/)?.[1];
  if (!amount) throw new Error("Swap plan is missing an ETH input amount.");
  return parseEther(amount);
}

function assertSwap(step: PlanStep) {
  if (step.protocol !== "uniswap-v3" || step.action !== "swap" || step.fromAsset !== "ETH" || step.toAsset !== "USDC") throw new Error("Unsupported Uniswap V3 execution step.");
}

export const uniswapV3ExecutionAdapter: ExecutionAdapter = {
  id: "uniswap-v3",
  async discover(snapshot) {
    const eth = snapshot.positions.filter((position) => position.protocol === "Wallet" && position.asset === "ETH").reduce((sum, position) => sum + position.amountUsd, 0);
    if (eth <= 0) {
      tracePipeline("uniswap-action-discovery", {
        snapshot: summarizeSnapshot(snapshot),
        ethExposureUsd: eth,
        actions: [],
        reason: "No ETH wallet balance is available for a swap.",
      });
      return [];
    }
    const pool = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getPool", args: [WETH, USDC, FEE] });
    if (pool.toLowerCase() === ZERO_ADDRESS) {
      tracePipeline("uniswap-action-discovery", {
        snapshot: summarizeSnapshot(snapshot),
        ethExposureUsd: eth,
        actions: [],
        reason: "The configured ETH/USDC pool does not exist.",
      });
      return [];
    }
    const actions = [{ adapterId: "uniswap-v3", action: "swap", fromAsset: "ETH", toAsset: "USDC", availableUsd: eth, label: "Swap ETH to USDC" } satisfies ExecutableAction];
    tracePipeline("uniswap-action-discovery", {
      snapshot: summarizeSnapshot(snapshot),
      ethExposureUsd: eth,
      actions,
      reason: "Any positive ETH balance is currently surfaced as a swap opportunity.",
    });
    return actions;
  },
  async quote(step) {
    assertSwap(step);
    const amountIn = inputAmount(step);
    const quoteResponse = await client.simulateContract({ address: QUOTER, abi: quoterAbi, functionName: "quoteExactInputSingle", args: [{ tokenIn: WETH, tokenOut: USDC, amountIn, fee: FEE, sqrtPriceLimitX96: BigInt(0) }] });
    const amountOut = (quoteResponse.result as readonly [bigint, bigint, number, bigint])[0];
    return { adapterId: "uniswap-v3", amountIn: amountIn.toString(), amountOut: amountOut.toString(), amountOutUsd: Number(formatUnits(amountOut, 6)), amountOutMinimum: (amountOut * BigInt(10_000 - SLIPPAGE_BPS) / BigInt(10_000)).toString(), slippageBps: SLIPPAGE_BPS, route: `WETH/USDC/${FEE}` } satisfies ExecutionQuote;
  },
  buildTransaction(step, walletAddress) {
    assertSwap(step);
    const quote = step.quote;
    if (!quote || quote.adapterId !== "uniswap-v3") throw new Error("Swap plan is missing a Uniswap quote.");
    const amountIn = BigInt(quote.amountIn);
    return { to: ROUTER, data: encodeFunctionData({ abi: exactInputSingleAbi, functionName: "exactInputSingle", args: [{ tokenIn: WETH, tokenOut: USDC, fee: FEE, recipient: walletAddress, amountIn, amountOutMinimum: BigInt(quote.amountOutMinimum), sqrtPriceLimitX96: BigInt(0) }] }), value: `0x${amountIn.toString(16)}`, chainId: "0xaa36a7" };
  },
  async simulate(step, walletAddress) {
    try {
      const transaction = this.buildTransaction(step, walletAddress);
      const gas = await client.estimateGas({ account: walletAddress, to: transaction.to, data: transaction.data, value: BigInt(transaction.value) });
      return { success: true, estimatedGas: gas.toString(), note: "Wallet-context simulation passed for the quoted transaction." };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "UNISWAP_SIMULATION_FAILED", note: "Wallet-context simulation failed for the quoted transaction." };
    }
  },
};
