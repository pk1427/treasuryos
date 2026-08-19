import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full bg-[#fbfbfd] text-[#101828]">
        {children}
      </body>
    </html>
  );
}
