"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/context";

export function PublicTreasurySearch() {
  const [address, setAddress] = useState("");
  const editedAddress = useRef(false);
  const prevWallet = useRef<string | null>(null);
  const router = useRouter();
  const { address: walletAddress } = useWallet();

  useEffect(() => {
    if (walletAddress && !editedAddress.current) setAddress(walletAddress);
  }, [walletAddress]);

  // Auto-navigate to dashboard when wallet connects and the user hasn't
  // manually edited the field — they signed in to inspect their own treasury,
  // so start scanning immediately.
  useEffect(() => {
    if (walletAddress && !editedAddress.current && prevWallet.current !== walletAddress) {
      prevWallet.current = walletAddress;
      router.push(
        `/dashboard?address=${encodeURIComponent(walletAddress)}`,
      );
    }
  }, [walletAddress, router]);

  function inspect() {
    const value = address.trim();
    router.push(
      value ? `/dashboard?address=${encodeURIComponent(value)}` : "/dashboard"
    );
  }

  return (
    <form
      className="w-full max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        inspect();
      }}
    >
      <label className="flex h-16 items-center gap-3 rounded-2xl border border-input privacy-card px-2 pl-5 text-foreground shadow-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={address}
          onChange={(event) => {
            editedAddress.current = true;
            setAddress(event.target.value);
          }}
          placeholder="Search address / Web3 ID"
          className="min-w-0 flex-1 bg-transparent font-mono-ui text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="lg"
          className="relative inline-flex h-12 shrink-0 overflow-hidden rounded-xl p-px font-display"
          style={{ padding: "1px" }}
        >
          <span
            className="absolute inset-[-1000%] anim-spin-slow"
            style={{
              background:
                "conic-gradient(from 90deg at 50% 50%, var(--background) 0%, var(--nocturne-cyan) 50%, var(--background) 100%)",
            }}
          />
          <span
            className="inline-flex h-full w-full items-center justify-center rounded-xl bg-secondary px-6 text-sm font-medium text-foreground"
            style={{
              padding: "0 16px",
              backdropFilter: "blur(24px)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Search className="h-4 w-4" />
            Inspect portfolio
          </span>
        </Button>
      </label>
    </form>
  );
}
