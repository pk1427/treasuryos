import type { Metadata } from "next";
import { Sidebar } from "@/components/treasury/sidebar";
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
        <Sidebar />
        <main className="ml-64 min-h-screen p-8">{children}</main>
      </body>
    </html>
  );
}
