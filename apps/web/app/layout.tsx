import type { Metadata } from "next";
import { Navbar } from "@/components/treasury/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "TreasuryOS - DeFi Treasury Risk Intelligence",
  description:
    "Scan DeFi treasuries, score risk, run stress scenarios, and publish onchain risk attestations through KeeperHub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
