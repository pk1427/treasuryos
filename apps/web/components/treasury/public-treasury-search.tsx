"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/context";

export function PublicTreasurySearch() {
  const [address, setAddress] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const editedAddress = useRef(false);
  const router = useRouter();
  const { address: walletAddress } = useWallet();

  useEffect(() => {
    if (walletAddress && !editedAddress.current) setAddress(walletAddress);
  }, [walletAddress]);

  function inspect() {
    const value = address.trim();
    router.push(value ? `/dashboard?address=${encodeURIComponent(value)}` : "/dashboard");
  }

  return <form className="w-full max-w-3xl" onSubmit={(event) => { event.preventDefault(); inspect(); }}>
    <label className="flex h-16 items-center gap-3 rounded-2xl border border-slate-300 bg-white p-2 pl-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
      <Search className="h-5 w-5 shrink-0 text-slate-400" />
      <input value={address} onChange={(event) => { editedAddress.current = true; setAddress(event.target.value); setNotice(null); }} placeholder="Search address / Web3 ID" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400" />
      <Button type="submit" size="lg" className="h-12 shrink-0 rounded-xl px-6">Inspect portfolio</Button>
    </label>
    {notice ? <p role="alert" className="mt-3 text-center text-sm text-violet-700">{notice}</p> : <p className="mt-3 text-center text-sm text-slate-500">Inspect any supported public treasury. Connect a wallet only when you are ready to execute.</p>}
  </form>;
}
