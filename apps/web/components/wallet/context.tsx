"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const WALLET_SESSION_KEY = "treasuryos-wallet-session";
const WALLET_ADDRESS_KEY = "treasuryos-wallet-address";

type WalletState = {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<{ signature: string; address: string } | null>;
  sendTransaction: (transaction: {
    to: string;
    data: string;
    value?: string;
    chainId?: string;
  }) => Promise<string | null>;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedAddress = window.sessionStorage.getItem(WALLET_ADDRESS_KEY);
    if (storedAddress) {
      window.queueMicrotask(() => setAddress(storedAddress));
    }
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem(WALLET_SESSION_KEY) !== "connected") return;
    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
    if (!ethereum) return;
    Promise.all([
      ethereum.request({ method: "eth_accounts" }) as Promise<string[]>,
      ethereum.request({ method: "eth_chainId" }) as Promise<string>,
    ])
      .then(([accounts, chain]) => {
        if (!accounts[0]) return;
        setAddress(accounts[0]);
        window.sessionStorage.setItem(WALLET_ADDRESS_KEY, accounts[0]);
        setChainId(parseInt(chain, 16));
      })
      .catch(() => {
        window.sessionStorage.removeItem(WALLET_SESSION_KEY);
        window.sessionStorage.removeItem(WALLET_ADDRESS_KEY);
      });
  }, []);

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
      window.sessionStorage.setItem(WALLET_SESSION_KEY, "connected");
      window.sessionStorage.setItem(WALLET_ADDRESS_KEY, accounts[0]);
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
    window.sessionStorage.removeItem(WALLET_SESSION_KEY);
    window.sessionStorage.removeItem(WALLET_ADDRESS_KEY);
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

  const sendTransaction = useCallback(
    async (transaction: {
      to: string;
      data: string;
      value?: string;
      chainId?: string;
    }): Promise<string | null> => {
      if (!address) return null;

      try {
        const ethereum = (window as unknown as {
          ethereum?: {
            request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
          };
        }).ethereum;
        if (!ethereum) throw new Error("Wallet not connected");

        const currentChain = (await ethereum.request({
          method: "eth_chainId",
          params: [],
        })) as string;

        if (currentChain.toLowerCase() !== SEPOLIA_CHAIN_ID_HEX) {
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
            });
          } catch (switchError) {
            const errorCode = (switchError as { code?: number }).code;
            if (errorCode === 4902) {
              await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: SEPOLIA_CHAIN_ID_HEX,
                    chainName: "Sepolia",
                    nativeCurrency: {
                      name: "Sepolia Ether",
                      symbol: "SepoliaETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  },
                ],
              });
            } else {
              throw switchError;
            }
          }

          setChainId(parseInt(SEPOLIA_CHAIN_ID_HEX, 16));
        }

        const txHash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: transaction.to,
              data: transaction.data,
              value: transaction.value ?? "0x0",
              chainId: transaction.chainId,
            },
          ],
        })) as string;

        return txHash;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to send transaction";
        setError(message);
        throw new Error(message);
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
        sendTransaction,
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
