import {
  formatEther,
  formatUnits,
  getAddress,
  type Address,
} from "viem";
import { publicClient } from "./client";
import { SUPPORTED_TOKENS } from "./tokens";

const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const ZERO_BALANCE = BigInt(0);

export type NativeBalance = {
  symbol: "ETH";
  amount: string;
};

export type TokenBalance = {
  symbol: string;
  amount: string;
};

export async function getNativeBalance(
  address: Address
): Promise<NativeBalance | null> {
  const balance = await publicClient.getBalance({ address });

  if (balance === ZERO_BALANCE) return null;

  return {
    symbol: "ETH",
    amount: formatEther(balance),
  };
}

export async function getTokenBalances(
  address: Address
): Promise<TokenBalance[]> {
  const balances = await Promise.all(
    SUPPORTED_TOKENS.map(async (token) => {
      try {
        const [balance, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "decimals",
          }),
        ]);

        if (balance === ZERO_BALANCE) return null;

        return {
          symbol,
          amount: formatUnits(balance, decimals),
        };
      } catch {
        return null;
      }
    })
  );

  return balances.filter((balance): balance is TokenBalance => Boolean(balance));
}

export function normalizeAddress(address: string): Address {
  const trimmed = address.trim();

  try {
    return getAddress(trimmed);
  } catch {
    throw new Error("Expected an EVM address in 0x format.");
  }
}
