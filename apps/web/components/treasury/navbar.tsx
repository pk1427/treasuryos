"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Shield, X, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";

const navItems = [
  { href: "/dashboard", label: "Portfolio", sectionPaths: ["/dashboard", "/positions", "/stream", "/execution"] },
  { href: "/proof-attestation", label: "Proofs" },
  { href: "/how-it-works", label: "How it works" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { address, isConnected, isConnecting, error, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-sm">
            <Shield className="h-5 w-5 text-white" />
          </span>
          <span className="text-2xl font-bold tracking-tight text-slate-950">TreasuryOS</span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {navItems.map((item) => {
            const active = (item.sectionPaths ?? [item.href]).some((path) => pathname.startsWith(path));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b-2 py-1 text-sm font-medium transition",
                  active
                    ? "border-violet-600 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-950"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 font-mono text-xs text-violet-700">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <Button
                variant="outline"
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
                variant="default"
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
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            {isConnected && address ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-mono text-xs text-slate-700">
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
                  variant="default"
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
