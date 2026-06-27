import { redirect } from "next/navigation";
import { getConnectedWallet, getDashboardAction } from "@/app/actions/treasury";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectWallet } from "@/components/treasury/connect-wallet";
import { truncateAddress, formatUsd } from "@/lib/utils";

export default async function TreasuryPage() {
  const wallet = await getConnectedWallet();

  if (!wallet) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <ConnectWallet />
      </div>
    );
  }

  const data = await getDashboardAction(wallet);
  const assets = data.assets ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Treasury</h1>
        <p className="text-zinc-400">
          Onchain assets for {truncateAddress(wallet)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Protocol</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-zinc-100">
              {data.protocolName ?? "Protocol"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-400">Base</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-zinc-100">
              {data.analytics ? formatUsd(data.analytics.totalValue) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="pb-3 pr-4">Asset</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">USD Value</th>
                  <th className="pb-3">Last Moved</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.symbol} className="border-b border-zinc-800/50">
                    <td className="py-4 pr-4 font-medium text-zinc-100">
                      {asset.symbol}
                    </td>
                    <td className="py-4 pr-4 text-zinc-300">
                      {parseFloat(asset.amount).toLocaleString()}
                    </td>
                    <td className="py-4 pr-4 text-zinc-100">
                      {formatUsd(asset.usdValue)}
                    </td>
                    <td className="py-4 text-zinc-500">
                      {asset.lastMovedAt
                        ? asset.lastMovedAt.toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
