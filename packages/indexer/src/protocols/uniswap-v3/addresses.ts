import { getAddress, type Address } from "viem";

export const UNISWAP_V3 = {
  sepolia: {
    factory: checksum("0x0227628f3F023bb0B980b67D528571c95c6DaC1c"),
    nonfungiblePositionManager: checksum(
      "0x1238536071E1c677A632429e3655c799b22cDA52"
    ),
    pools: [
      {
        token0: checksum("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
        token1: checksum("0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"),
        fee: 3000,
        pool: checksum("0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50"),
      },
    ],
  },
} as const;

function checksum(address: string): Address {
  return getAddress(address);
}
