import { NextResponse } from "next/server";
import { executionHistoryRepo } from "@/server/repositories";

const MAX_PROOFS = 3;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const executionId = searchParams.get("execution");
  const txHash = searchParams.get("tx");

  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  try {
    const proofs = await executionHistoryRepo.listProofsByWallet(wallet, MAX_PROOFS);
    const selected = executionId
      ? proofs.find((proof) => proof.id === executionId) ?? await executionHistoryRepo.findById(executionId)
      : txHash
        ? await executionHistoryRepo.findByTxHash(wallet, txHash)
        : proofs[0] ?? null;

    if (selected && selected.wallet !== wallet.toLowerCase()) {
      return NextResponse.json({ error: "proof not found" }, { status: 404 });
    }
    if (selected && (!selected.executionProofHash || !selected.attestationTxHash)) {
      return NextResponse.json({ error: "proof not found" }, { status: 404 });
    }

    return NextResponse.json({
      proofs: proofs.map(serializeProof),
      selected: selected ? serializeProof(selected) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load proof history" },
      { status: 500 }
    );
  }
}

function serializeProof(proof: Awaited<ReturnType<typeof executionHistoryRepo.findById>>) {
  if (!proof) return null;
  return {
    ...proof,
    createdAt: proof.createdAt.toISOString(),
  };
}
