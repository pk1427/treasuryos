"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type WalletState = {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<{ signature: string; address: string } | null>;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;

      if (!ethereum) {
        throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.");
      }

      const timeoutMs = 15_000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Wallet connection timed out. The wallet extension may be unresponsive. Try refreshing or using a different wallet.")), timeoutMs)
      );

      const accountsPromise = ethereum.request({
        method: "eth_requestAccounts",
      }) as Promise<string[]>;

      const accounts = await Promise.race([accountsPromise, timeoutPromise]);

      if (accounts.length === 0) {
        throw new Error("No accounts found. Please unlock your wallet.");
      }

      const chain = (await ethereum.request({
        method: "eth_chainId",
      })) as string;

      setAddress(accounts[0]);
      setChainId(parseInt(chain, 16));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setAddress(null);
      setChainId(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<{ signature: string; address: string } | null> => {
      if (!address) return null;

      try {
        const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
        if (!ethereum) throw new Error("Wallet not connected");

        const signature = (await ethereum.request({
          method: "personal_sign",
          params: [message, address],
        })) as string;

        return { signature, address };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sign message");
        return null;
      }
    },
    [address]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected: !!address,
        isConnecting,
        error,
        connect,
        disconnect,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
