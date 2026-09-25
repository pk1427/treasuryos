"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Shield, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/wallet/context";
import { useToast } from "@/components/ui/toast";

const NETWORK = process.env.NEXT_PUBLIC_CHAIN ?? "sepolia";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", requiresWallet: true },
  { href: "/how-it-works", label: "How it works" },
  { href: "/verification", label: "Verification" },
];

const customStyles: Record<string, React.CSSProperties> = {
  glassPanel: {
    background: "var(--nocturne-panel)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid var(--nocturne-border)",
  },
  appHeader: {
    background: "var(--nocturne-panel)",
    border: "1px solid var(--nocturne-border)",
    borderRadius: "16px",
    padding: "10px 12px",
    width: "95%",
    maxWidth: "1240px",
    height: "64px",
    boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)",
  },
};

export function PublicNavbar() {
  const { address, isConnecting, connect, disconnect, isConnected } = useWallet();
  const { show } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const redirectAfterConnect = useRef(false);

  const routerPathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!walletMenuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!redirectAfterConnect.current || !address) return;
    redirectAfterConnect.current = false;
    router.push(`/dashboard?address=${encodeURIComponent(address)}`);
  }, [address, router]);

  const connectAndOpenPortfolio = async () => {
    redirectAfterConnect.current = true;
    try {
      await connect();
    } catch {
      redirectAfterConnect.current = false;
    }
  };

  const handleNavClick = (href: string, requiresWallet?: boolean) => {
    if (requiresWallet && !isConnected) {
      show("Connect wallet first to access the overview.", {
        actionLabel: "Connect",
        actionPerformed: () => {
          void connectAndOpenPortfolio();
        },
      });
      return false;
    }
    return true;
  };

  const useAppHeader = routerPathname !== "/dashboard";

  return (
    <header
      className="transition-all duration-500"
      style={{
        position: "fixed",
        top: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        ...(useAppHeader ? customStyles.appHeader : {
          ...customStyles.glassPanel,
          borderRadius: "9999px",
          width: "95%",
          maxWidth: "1200px",
          padding: "10px 12px",
        }),
        boxShadow: "0 8px 28px -10px rgba(0,0,0,0.55)",
      }}
    >
      <div className="flex h-full w-full items-center justify-between overflow-visible">
        <div className="flex items-center gap-9">
          <Link
            href={address ? `/dashboard?address=${encodeURIComponent(address)}` : "/"}
            className="flex items-center gap-2"
            aria-label={address ? "Open your portfolio" : "Go to TreasuryOS homepage"}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-lg font-bold tracking-tight text-foreground font-display">
              TreasuryOS
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-bold tracking-widest text-muted-foreground md:flex font-display">
            {NAV_ITEMS.map((item) => {
              const active = routerPathname.startsWith(item.href);
              const href = item.requiresWallet && address
                ? `${item.href}?address=${encodeURIComponent(address)}`
                : item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  onMouseEnter={() => setHovered(item.href)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (!handleNavClick(item.href, item.requiresWallet)) {
                      e.preventDefault();
                    }
                  }}
                  className="transition-all relative flex flex-col items-center justify-center h-full px-2"
                  style={{
                    color: active ? "var(--foreground)" : hovered === item.href ? "var(--foreground)" : "var(--muted-foreground)",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    fontWeight: active ? "700" : "500",
                  }}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute bottom-[-6px] left-1/2 h-0.5 w-full -translate-x-1/2"
                      style={{
                        background: "var(--nocturne-cyan)",
                        boxShadow: "0 0 10px rgba(34, 211, 238, 0.6)",
                        borderRadius: "2px",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <NetworkStatus />
          <div className="inline-flex items-center justify-end min-w-[176px]">
            {address ? (
              <div ref={walletMenuRef} className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground font-mono-ui hover:bg-accent transition-colors"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" />
                  {address.slice(0, 6)}...{address.slice(-4)}
                  <ChevronDown className={cn("h-3.5 w-3.5 opacity-50 transition-transform", menuOpen && "rotate-180")} />
                </button>
                {menuOpen ? (
                  <div role="menu" className="absolute right-0 top-full z-[101] mt-3 w-40 rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        disconnect();
                        if (routerPathname.startsWith("/dashboard")) router.replace("/");
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" /> Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => void connectAndOpenPortfolio()}
                disabled={isConnecting}
                className="relative inline-flex h-10 overflow-hidden rounded-full p-px font-display"
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
                    className="inline-flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
                    style={{
                      padding: "4px 16px",
                      backdropFilter: "blur(24px)",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {isConnecting ? "Connecting" : "Connect Wallet"}
                  </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function NetworkStatus() {
  const online = false;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider",
        online
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          online
            ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : "bg-foreground/40"
        )}
      />
      {(NETWORK.charAt(0).toUpperCase() + NETWORK.slice(1)).toUpperCase()}
    </span>
  );
}
