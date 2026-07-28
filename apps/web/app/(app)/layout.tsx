import { Navbar } from "@/components/treasury/navbar";
import { TreasurySessionProvider } from "@/components/treasury/session-context";
import { WalletProvider } from "@/components/wallet/context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <TreasurySessionProvider>
        <Navbar />
        <main className="min-h-screen">{children}</main>
      </TreasurySessionProvider>
    </WalletProvider>
  );
}