import { Check, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "analyze" | "manage";

interface TrustRailProps {
  mode: Mode;
  ownerVerified: boolean;
}

export function TrustRail({ mode, ownerVerified }: TrustRailProps) {
  const items =
    mode === "analyze"
      ? ["Read-only: no wallet required", "No execution capability in Analyze mode", "Analyze any public address safely"]
      : [
          "Your wallet remains the only signer and transaction broadcaster",
          ownerVerified ? "Verified ownership enables owner-only workflows" : "Execution stays locked until the connected wallet matches the treasury",
          "Simulation is read-only",
          "Intent signature is not execution",
        ];

  return (
    <Card className="rounded-xl bg-zinc-900/70">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          Trust & Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm text-zinc-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
