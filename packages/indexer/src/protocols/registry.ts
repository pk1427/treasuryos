import type { Address } from "viem";
import type { TreasuryPosition } from "@treasuryos/shared";
import { aaveV3Adapter } from "./aave-v3";
import { uniswapV3Adapter } from "./uniswap-v3";
import type { TreasuryProtocolAdapter } from "./adapter";

const PROTOCOL_SCAN_TIMEOUT_MS = 45_000;

export const TREASURY_PROTOCOL_ADAPTERS: TreasuryProtocolAdapter[] = [
  uniswapV3Adapter,
  aaveV3Adapter,
];

export async function scanProtocolPositions(
  address: Address
): Promise<TreasuryPosition[]> {
  const results = await Promise.all(
    TREASURY_PROTOCOL_ADAPTERS.map(async (adapter) => {
      try {
        return await withTimeout(
          adapter.scan(address),
          PROTOCOL_SCAN_TIMEOUT_MS
        );
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Protocol scan timed out.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
