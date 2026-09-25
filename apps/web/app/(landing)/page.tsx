"use client";

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicTreasurySearch } from "@/components/treasury/public-treasury-search";
import { useWallet } from "@/components/wallet/context";


function HeroSection() {
  const { address, isConnecting, connect } = useWallet();

  return (
    <section
      className="relative z-10 flex w-full flex-col items-center gap-16 px-6 md:px-12"
      style={{ minHeight: "100vh", maxWidth: "1440px", paddingTop: "128px", paddingBottom: "80px", margin: "0 auto" }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-8 flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            border: "1px solid rgba(14, 165, 233, 0.2)",
            background: "rgba(14, 165, 233, 0.1)",
            animation: "slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--nocturne-cyan)", opacity: 0.75, animation: "pulse 1s cubic-bezier(0, 0, 0.2, 1) infinite" }}
            />
            <span
              className="relative inline-block h-2 w-2 rounded-full"
              style={{ background: "var(--nocturne-cyan)" }}
            />
          </span>
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--nocturne-cyan)" }}
          >
            Private DeFi Risk Intelligence
          </span>
        </div>

        <h1
          className="text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          style={{
            lineHeight: 1.1,
            animation: "slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards",
            opacity: 0,
          }}
        >
          <span className="block text-foreground">One address.</span>
          <span
            className="block text-foreground"
            style={{
              background: "linear-gradient(to right, var(--nocturne-cyan), var(--foreground), var(--chart-2))",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "var(--foreground)",
            }}
          >
            Balances, exposure, and a risk score.
          </span>
        </h1>

        <p
          className="mt-6 max-w-lg text-lg font-light leading-relaxed text-muted-foreground"
          style={{
            animation: "slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 200ms forwards",
            opacity: 0,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          Scan any public treasury for holdings and the edge cases that move the score.
        </p>

        <div
          className="mt-12 flex w-full max-w-3xl flex-col items-center gap-6"
          style={{
            animation: "slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 300ms forwards",
            opacity: 0,
          }}
        >
          <PublicTreasurySearch />

          {!address && (
            <>
              <p className="text-sm text-muted-foreground">
                or connect a wallet to execute
              </p>
              <Button
                size="sm"
                disabled={isConnecting}
                onClick={() => void connect()}
                className="relative inline-flex h-10 overflow-hidden rounded-full p-px font-display"
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
            </>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div
        className="grid w-full grid-cols-1 gap-6 md:grid-cols-3"
        style={{
          animation: "slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 400ms forwards",
          opacity: 0,
        }}
      >
        <FeatureCard
          title="Risk Scoring"
          desc="Automated risk assessment covering concentration, runway, and execution exposure."
          iconColor="var(--nocturne-cyan)"
        />
        <FeatureCard
          title="Portfolio Exposure"
          desc="Token-level and protocol-level breakdown across all holdings."
          iconColor="#6366f1"
        />
        <FeatureCard
          title="Verification"
          desc="On-chain attestation and audit trail for owner-controlled actions."
          iconColor="var(--xyra-emerald)"
        />
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  desc,
  iconColor,
}: {
  title: string;
  desc: string;
  iconColor: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:bg-card/40"
    >
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted"
        style={{ color: iconColor }}
      >
        <Shield className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-foreground font-display">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-transparent text-foreground">
      <HeroSection />
    </main>
  );
}
