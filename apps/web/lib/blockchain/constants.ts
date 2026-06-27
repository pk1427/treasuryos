import { base } from "viem/chains";

export const BASE_CHAIN_ID = base.id;

export const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const WETH_ADDRESS =
  "0x4200000000000000000000000000000000000006" as const;

export const CBBTC_ADDRESS =
  "0xcbB7C0000aB88B473b1f5aFd9ef8084cee7d268" as const;

export const DEMO_TREASURY_ADDRESS =
  "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as const;

export const DEMO_RESERVE_ADDRESS =
  "0x1234567890123456789012345678901234567890" as const;

export const TOKEN_METADATA: Record<
  string,
  { symbol: string; decimals: number; coingeckoId?: string }
> = {
  [USDC_ADDRESS.toLowerCase()]: {
    symbol: "USDC",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  [WETH_ADDRESS.toLowerCase()]: {
    symbol: "ETH",
    decimals: 18,
    coingeckoId: "ethereum",
  },
  [CBBTC_ADDRESS.toLowerCase()]: {
    symbol: "cbBTC",
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
  },
};

export const DEMO_MONTHLY_BURN_USD = 120_000;
