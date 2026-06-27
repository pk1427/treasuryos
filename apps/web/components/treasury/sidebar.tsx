"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  AlertTriangle,
  FileCheck,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/treasury", label: "Treasury", icon: Wallet },
  { href: "/decisions", label: "Risks", icon: AlertTriangle },
  { href: "/executions", label: "Attestations", icon: FileCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">TreasuryOS</h1>
          <p className="text-xs text-zinc-500">Risk attestations</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-emerald-600/10 text-emerald-400"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="rounded-lg bg-zinc-900 p-3">
          <p className="text-xs font-medium text-zinc-400">Network</p>
          <p className="text-sm font-semibold text-emerald-400">
            {process.env.NEXT_PUBLIC_CHAIN ?? "sepolia"}
          </p>
        </div>
      </div>
    </aside>
  );
}
