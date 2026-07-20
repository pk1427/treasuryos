import { publicClient } from "./client";

/**
 * Live onchain token pricing via Chainlink Data Feeds.
 *
 * Replaces the previous hardcoded price table. Every USD figure downstream
 * (position values, total treasury value, composite risk, stress simulator)
 * depends on this, so a wrong or missing price here is not cosmetic.
 *
 * IMPORTANT — feed address coverage:
 * Only the ETH/USD feed address below has been independently verified
 * (cross-checked against Chainlink's own docs and GitHub issue history).
 * The USDC/USD, DAI/USD and USDT/USD Sepolia feed addresses could not be
 * confirmed reliably (Chainlink's address table renders client-side and
 * isn't scrapable), and wrong contract addresses would silently produce
 * wrong attestation data — worse than not having them. Copy the correct
 * addresses from https://docs.chain.link/data-feeds/price-feeds/addresses
 * (Sepolia Testnet section) and paste them into CHAINLINK_FEEDS_SEPOLIA
 * below. Until then, those symbols fall back to an explicit $1 peg (see
 * PEGGED_STABLECOIN_FALLBACK) rather than a fake precise-looking number.
 */

const AGGREGATOR_V3_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

type FeedAddress = `0x${string}`;

// Sepolia Chainlink price feed proxy addresses, keyed by token symbol.
const CHAINLINK_FEEDS_SEPOLIA: Partial<Record<string, FeedAddress>> = {
  // Verified: Chainlink docs (docs.chain.link/data-feeds/getting-started) and
  // smartcontractkit/chainlink GitHub issue #8905.
  ETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  WETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // WETH tracks ETH/USD 1:1

  // TODO: paste the verified Sepolia proxy addresses for these from
  // https://docs.chain.link/data-feeds/price-feeds/addresses (filter to
  // "Sepolia Testnet"). Until filled in, these symbols use the stablecoin
  // peg fallback below instead of a live feed.
  // USDC: "0x...",
  // DAI:  "0x...",
  // USDT: "0x...",
};

// Fallback for symbols with no configured Chainlink feed. Only appropriate
// for assets designed to hold a $1 peg — this does NOT reflect a live
// market price and will NOT catch a de-peg event. Every price this function
// returns reports its `source` so callers can distinguish a live oracle
// read from this fallback (e.g. surface a "peg assumed" indicator) instead
// of treating both as equally trustworthy.
const PEGGED_STABLECOIN_FALLBACK = new Set(["USDC", "USDT", "DAI"]);

const PRICE_CACHE_TTL_MS = 60_000;
// Reject feed data older than this — a stale Chainlink answer is worse than
// an explicit failure, since a stale ETH price during a crash would understate
// risk exactly when accuracy matters most.
const STALENESS_LIMIT_SECONDS = 24 * 60 * 60;

export type PriceSource = "chainlink" | "stablecoin-peg" | "unavailable";

export type PriceResult = {
  price: number;
  source: PriceSource;
};

type CacheEntry = {
  result: PriceResult;
  fetchedAt: number;
};

const priceCache = new Map<string, CacheEntry>();

export async function getTokenPrice(symbol: string): Promise<PriceResult> {
  const key = symbol.toUpperCase();

  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.result;
  }

  const feed = CHAINLINK_FEEDS_SEPOLIA[key];
  if (feed) {
    try {
      const price = await readChainlinkPrice(feed);
      const result: PriceResult = { price, source: "chainlink" };
      priceCache.set(key, { result, fetchedAt: Date.now() });
      return result;
    } catch (error) {
      console.warn(
        `[prices] Chainlink read failed for ${key} (${feed}): ${
          error instanceof Error ? error.message : String(error)
        }. Falling back.`
      );
      // Fall through — do not silently reuse a possibly-stale cache entry
      // for a hard failure.
    }
  }

  if (PEGGED_STABLECOIN_FALLBACK.has(key)) {
    const result: PriceResult = { price: 1, source: "stablecoin-peg" };
    priceCache.set(key, { result, fetchedAt: Date.now() });
    return result;
  }

  console.warn(
    `[prices] No price source configured for ${key}. Treating as $0 — ` +
      `any balance in this asset will be excluded from the treasury value.`
  );
  const result: PriceResult = { price: 0, source: "unavailable" };
  priceCache.set(key, { result, fetchedAt: Date.now() });
  return result;
}

async function readChainlinkPrice(feed: FeedAddress): Promise<number> {
  const [decimals, roundData] = await Promise.all([
    publicClient.readContract({
      address: feed,
      abi: AGGREGATOR_V3_ABI,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: feed,
      abi: AGGREGATOR_V3_ABI,
      functionName: "latestRoundData",
    }),
  ]);

  const [, answer, , updatedAt] = roundData;

  if (answer <= BigInt(0)) {
    throw new Error("feed returned a non-positive answer");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(updatedAt);
  if (ageSeconds > STALENESS_LIMIT_SECONDS) {
    throw new Error(`feed data is stale (${ageSeconds}s old)`);
  }

  return Number(answer) / 10 ** decimals;
}