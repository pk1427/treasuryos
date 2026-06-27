"use server";

import { cookies } from "next/headers";
import { treasuryService } from "@/server/services/treasury-service";

const WALLET_COOKIE = "treasuryos_wallet";

export async function connectTreasuryAction(
  walletAddress: string,
  protocolName?: string
) {
  await treasuryService.connectTreasury(walletAddress, protocolName);
  await treasuryService.fetchAndAnalyze(walletAddress);

  const cookieStore = await cookies();
  cookieStore.set(WALLET_COOKIE, walletAddress.toLowerCase(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { success: true, walletAddress };
}

export async function getConnectedWallet(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WALLET_COOKIE)?.value ?? null;
}

export async function analyzeTreasuryAction(walletAddress: string) {
  return treasuryService.fetchAndAnalyze(walletAddress);
}

export async function getDashboardAction(walletAddress: string) {
  return treasuryService.getDashboardData(walletAddress);
}

export async function executeDecisionAction(
  decisionId: string,
  walletAddress: string
) {
  return treasuryService.executeDecision(decisionId, walletAddress);
}
