import { getAddress, type Address } from "viem";

export type SupportedToken = {
  name: string;
  symbol: string;
  decimals: number;
  address: Address;
};

export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
    address: checksum("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
  },
  {
    name: "WETH",
    symbol: "WETH",
    decimals: 18,
    address: checksum("0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"),
  },
  {
    name: "DAI",
    symbol: "DAI",
    decimals: 18,
    address: checksum("0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357"),
  },
];

export function getSupportedToken(address: Address): SupportedToken | undefined {
  const normalized = address.toLowerCase();

  return SUPPORTED_TOKENS.find(
    (token) => token.address.toLowerCase() === normalized
  );
}

function checksum(address: string): Address {
  return getAddress(address.toLowerCase());
}
