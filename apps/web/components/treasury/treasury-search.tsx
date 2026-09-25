"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/context";

export function TreasurySearch({
  size = "lg",
  autoOwn = false,
  placeholder = "Paste wallet or treasury address",
}: {
  size?: "md" | "lg";
  autoOwn?: boolean;
  placeholder?: string;
}) {
  const [address, setAddress] = useState("");
  const edited = useRef(false);
  const router = useRouter();
  const { address: walletAddress } = useWallet();

  useEffect(() => {
    if (autoOwn && walletAddress && !edited.current) setAddress(walletAddress);
  }, [autoOwn, walletAddress]);

  function inspect() {
    const value = address.trim();
    router.push(value ? `/dashboard?address=${encodeURIComponent(value)}` : "/dashboard");
  }

  const big = size === "lg";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        inspect();
      }}
      className={big ? "w-full max-w-2xl" : "w-full max-w-md"}
    >
      <label
        className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2 pl-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] focus-within:border-violet-500/60 focus-within:ring-4 focus-within:ring-violet-500/10 ${
          big ? "" : ""
        }`}
      >
        <Search className="h-5 w-5 shrink-0 text-zinc-500" />
        <input
          value={address}
          onChange={(e) => {
            edited.current = true;
            setAddress(e.target.value);
          }}
          placeholder={placeholder}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-500"
        />
        <Button type="submit" size={big ? "lg" : "sm"} className="shrink-0 rounded-xl">
          {big ? "Scan Treasury" : "Scan"}
        </Button>
      </label>
    </form>
  );
}
