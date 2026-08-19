"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/context";

export function PublicNavbar() {
  const { address, isConnecting, connect } = useWallet();
  const router = useRouter();
  const [openConnectedTreasury, setOpenConnectedTreasury] = useState(false);

  useEffect(() => {
    if (!openConnectedTreasury || !address) return;
    router.push(`/dashboard?address=${encodeURIComponent(address)}`);
  }, [address, openConnectedTreasury, router]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600"><Shield className="h-5 w-5 text-white" /></span>
          <span className="text-2xl font-bold tracking-tight text-slate-950">TreasuryOS</span>
        </Link>
        <nav className="hidden items-center gap-9 text-sm font-medium text-slate-500 md:flex">
          <Link href="/dashboard" className="transition hover:text-violet-700">Portfolio</Link>
          <Link href="/proof-attestation" className="transition hover:text-violet-700">Proofs</Link>
          <Link href="/how-it-works" className="transition hover:text-violet-700">How it works</Link>
        </nav>
        {address ? (
          <Link href={`/dashboard?address=${encodeURIComponent(address)}`} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 font-mono text-xs text-violet-700">{address.slice(0, 6)}...{address.slice(-4)}</Link>
        ) : (
          <Button size="sm" onClick={() => { setOpenConnectedTreasury(true); void connect(); }} disabled={isConnecting}>
            <Wallet className="h-4 w-4" />{isConnecting ? "Connecting" : "Connect Wallet"}
          </Button>
        )}
      </div>
    </header>
  );
}
