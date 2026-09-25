import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { WalletProvider } from "@/components/wallet/context";
import { TreasurySessionProvider } from "@/components/treasury/session-context";
import { PublicNavbar } from "@/components/treasury/public-navbar";
import { BackgroundEffects } from "@/components/treasury/background-effects";

export const metadata: Metadata = {
  title: "TreasuryOS - DeFi Treasury Risk Intelligence",
  description:
    "Scan DeFi treasuries, score risk, run stress scenarios, and verify owner-controlled transactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <div className="nocturne-shell">
          <ToastProvider>
            <WalletProvider>
              <TreasurySessionProvider>
                <PublicNavbar />
                <BackgroundEffects />
                <div className="relative z-10 pt-28">
                  {children}
                </div>
              </TreasurySessionProvider>
            </WalletProvider>
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
