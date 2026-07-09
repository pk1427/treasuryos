const TOKEN_PRICES_USD: Record<string, number> = {
  ETH: 3500,
  WETH: 3500,
  USDC: 1,
  USDT: 1,
  DAI: 1,
};

export function getTokenPrice(symbol: string): number {
  return TOKEN_PRICES_USD[symbol.toUpperCase()] ?? 0;
}
