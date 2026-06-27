import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RiskItem } from "@/types";
import { AlertTriangle } from "lucide-react";

interface RiskListProps {
  risks: RiskItem[];
}

export function RiskList({ risks }: RiskListProps) {
  if (risks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-zinc-500">
          No active risks detected
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {risks.map((risk) => (
        <Card key={risk.type}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-base">{risk.title}</CardTitle>
                <p className="text-xs text-zinc-500 capitalize">{risk.type.replace("_", " ")}</p>
              </div>
            </div>
            <Badge variant={risk.severity}>{risk.severity}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">{risk.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
