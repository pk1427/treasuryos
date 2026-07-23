"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Shield, X, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/attestations", label: "Attestations" },
  { href: "/how-it-works", label: "How it Works" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const network = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";
  const { address, isConnected, isConnecting, error, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 shadow-[0_0_28px_rgba(99,102,241,0.35)]">
            <Shield className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold text-zinc-100">TreasuryOS</span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            {network}
          </span>
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-300">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
                className="text-xs"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={connect}
                disabled={isConnecting}
              >
                <Wallet className="h-4 w-4 mr-2" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
              {error ? (
                <span className="max-w-[200px] truncate text-xs text-red-400" title={error}>
                  {error}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-zinc-950/95 px-4 py-4 md:hidden">
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Network: {network}
            </div>
            {isConnected && address ? (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="font-mono text-xs text-zinc-300">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={disconnect}
                  className="text-xs"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={connect}
                  disabled={isConnecting}
                  className="w-full"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
                {error ? (
                  <span className="max-w-[200px] truncate text-xs text-red-400" title={error}>
                    {error}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
