import type { TreasuryPosition } from "@treasuryos/shared";
import type { Address } from "viem";

export type TreasuryProtocolAdapter = {
  id: string;
  name: string;
  scan(address: Address): Promise<TreasuryPosition[]>;
};
