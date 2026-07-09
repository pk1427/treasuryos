import type { Address } from "viem";
import type { TreasuryPosition } from "@treasuryos/shared";
import { uniswapV3Adapter } from "./uniswap-v3";
import type { TreasuryProtocolAdapter } from "./adapter";

export const TREASURY_PROTOCOL_ADAPTERS: TreasuryProtocolAdapter[] = [
  uniswapV3Adapter,
];

export async function scanProtocolPositions(
  address: Address
): Promise<TreasuryPosition[]> {
  const results = await Promise.all(
    TREASURY_PROTOCOL_ADAPTERS.map(async (adapter) => {
      try {
        return await adapter.scan(address);
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}
