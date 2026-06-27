import { NextResponse } from "next/server";
import { treasuryService } from "@/server/services/treasury-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "wallet query parameter required" },
      { status: 400 }
    );
  }

  const data = await treasuryService.getDashboardData(wallet);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { walletAddress, protocolName } = body;

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress required" },
      { status: 400 }
    );
  }

  await treasuryService.connectTreasury(walletAddress, protocolName);
  const result = await treasuryService.fetchAndAnalyze(walletAddress);
  return NextResponse.json(result);
}
