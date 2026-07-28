import { WalletProvider } from "@/components/wallet/context";
import { TreasurySessionProvider } from "@/components/treasury/session-context";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <TreasurySessionProvider>
        {children}
      </TreasurySessionProvider>
    </WalletProvider>
  );
}