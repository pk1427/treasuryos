"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectTreasuryAction } from "@/app/actions/treasury";
import { DEMO_TREASURY_ADDRESS } from "@/lib/blockchain/constants";
import { truncateAddress } from "@/lib/utils";
import { Wallet, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ConnectWallet() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function connectDemo() {
    setLoading(true);
    try {
      await connectTreasuryAction(DEMO_TREASURY_ADDRESS, "Demo Protocol");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10">
          <Wallet className="h-7 w-7 text-emerald-400" />
        </div>
        <CardTitle>Connect Treasury Wallet</CardTitle>
        <p className="text-sm text-zinc-400">
          Link your protocol treasury on Base to begin analysis
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={connectDemo}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing Treasury...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Connect Demo Treasury
            </>
          )}
        </Button>
        <p className="text-center text-xs text-zinc-500">
          Demo wallet: {truncateAddress(DEMO_TREASURY_ADDRESS)}
        </p>
      </CardContent>
    </Card>
  );
}
