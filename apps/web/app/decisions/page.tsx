import { getConnectedWallet, getDashboardAction } from "@/app/actions/treasury";
import { RecommendationCard } from "@/components/decisions/recommendation-card";
import { ConnectWallet } from "@/components/treasury/connect-wallet";

export default async function DecisionsPage() {
  const wallet = await getConnectedWallet();

  if (!wallet) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <ConnectWallet />
      </div>
    );
  }

  const data = await getDashboardAction(wallet);
  const recommendations = data.recommendations ?? data.decisions ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Decisions</h1>
        <p className="text-zinc-400">
          AI CFO recommendations awaiting review and execution
        </p>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-zinc-500">No pending decisions. Treasury looks healthy.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((rec, i) => (
            <RecommendationCard
              key={rec.id ?? i}
              recommendation={rec}
              walletAddress={wallet}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
