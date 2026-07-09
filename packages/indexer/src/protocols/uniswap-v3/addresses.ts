import { getAddress, type Address } from "viem";

export const UNISWAP_V3 = {
  sepolia: {
    factory: checksum("0x0227628f3F023bb0B980b67D528571c95c6DaC1c"),
    nonfungiblePositionManager: checksum(
      "0x1238536071E1c677A632429e3655c799b22cDA52"
    ),
  },
} as const;

function checksum(address: string): Address {
  return getAddress(address);
}
