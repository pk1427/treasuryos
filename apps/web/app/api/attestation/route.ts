import { NextResponse } from "next/server";
import {
  publishAttestation,
  simulateAttestation,
} from "@treasuryos/attestation";
import { indexPublishedAttestationTransaction } from "@/server/services/attestation-indexer-service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const treasuryAddress = body.treasuryAddress;
  const reportHash = body.reportHash;
  const mode = body.mode;

  if (typeof treasuryAddress !== "string" || typeof reportHash !== "string") {
    return NextResponse.json(
      { error: "treasuryAddress and reportHash required" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(reportHash)) {
    return NextResponse.json(
      { error: "reportHash must be a bytes32 hex string" },
      { status: 400 }
    );
  }

  try {
    if (mode === "publish") {
      const result = await publishAttestation({
        treasuryAddress,
        reportHash: reportHash as `0x${string}`,
      });
      if (result.transactionHash) {
        await persistPublishedAttestation(result.transactionHash);
      }
      return NextResponse.json(result);
    }

    const result = await simulateAttestation({
      treasuryAddress,
      reportHash: reportHash as `0x${string}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Attestation failed" },
      { status: 502 }
    );
  }
}

async function persistPublishedAttestation(txHash: string) {
  try {
    await indexPublishedAttestationTransaction(txHash);
  } catch (error) {
    console.warn(
      "Attestation publish succeeded, but event indexing failed.",
      error
    );
  }
}
