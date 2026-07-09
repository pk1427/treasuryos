import {
  createPublicClient,
  formatUnits,
  http,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import type { TokenBalance } from "@/types";
import {
  BASE_CHAIN_ID,
  DEMO_MONTHLY_BURN_USD,
  DEMO_RESERVE_ADDRESS,
  DEMO_TREASURY_ADDRESS,
  TOKEN_METADATA,
} from "./constants";

const erc20BalanceOfAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.SEPOLIA_RPC_URL ?? "https://mainnet.base.org"),
});

const FALLBACK_PRICES: Record<string, number> = {
  USDC: 1,
  ETH: 3400,
  cbBTC: 98000,
};

async function fetchTokenPrices(): Promise<Record<string, number>> {
  try {
    const ids = Object.values(TOKEN_METADATA)
      .map((m) => m.coingeckoId)
      .filter(Boolean)
      .join(",");

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return FALLBACK_PRICES;

    const data = (await res.json()) as Record<string, { usd: number }>;
    const prices: Record<string, number> = { ...FALLBACK_PRICES };

    for (const meta of Object.values(TOKEN_METADATA)) {
      if (meta.coingeckoId && data[meta.coingeckoId]) {
        prices[meta.symbol] = data[meta.coingeckoId].usd;
      }
    }
    return prices;
  } catch {
    return FALLBACK_PRICES;
  }
}

async function getOnchainBalance(
  walletAddress: Address,
  tokenAddress: Address,
  symbol: string,
  decimals: number,
  priceUsd: number
): Promise<TokenBalance | null> {
  try {
    const raw = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    const amount = formatUnits(raw, decimals);
    const numericAmount = parseFloat(amount);
    if (numericAmount === 0) return null;

    return {
      tokenAddress,
      symbol,
      amount,
      decimals,
      usdValue: numericAmount * priceUsd,
    };
  } catch {
    return null;
  }
}

export async function getBalances(
  walletAddress: string
): Promise<TokenBalance[]> {
  const prices = await fetchTokenPrices();
  const address = walletAddress as Address;
  const balances: TokenBalance[] = [];

  for (const [tokenAddr, meta] of Object.entries(TOKEN_METADATA)) {
    const balance = await getOnchainBalance(
      address,
      tokenAddr as Address,
      meta.symbol,
      meta.decimals,
      prices[meta.symbol] ?? 0
    );
    if (balance) balances.push(balance);
  }

  return balances;
}

export async function getTokenPrices(): Promise<Record<string, number>> {
  return fetchTokenPrices();
}

export async function getTransactions(): Promise<
  Array<{
    hash: Hash;
    value: string;
    timestamp: Date;
    to: string;
    from: string;
  }>
> {
  // Placeholder for block explorer API integration
  return [];
}

export function getDemoTreasuryConfig() {
  return {
    walletAddress: DEMO_TREASURY_ADDRESS,
    reserveWalletAddress: DEMO_RESERVE_ADDRESS,
    chainId: BASE_CHAIN_ID,
    monthlyBurnUsd: DEMO_MONTHLY_BURN_USD,
    protocolName: "Demo Protocol",
  };
}

export { publicClient, BASE_CHAIN_ID };
