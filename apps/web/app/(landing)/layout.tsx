import { WalletProvider } from "@/components/wallet/context";
import { TreasurySessionProvider } from "@/components/treasury/session-context";
import { PublicNavbar } from "@/components/treasury/public-navbar";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <TreasurySessionProvider>
        <PublicNavbar />
        {children}
      </TreasurySessionProvider>
    </WalletProvider>
  );
}
