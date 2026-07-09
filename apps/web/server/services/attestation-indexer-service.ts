import {
  indexAttestationTransaction,
  type IndexedAttestation,
} from "@treasuryos/indexer";
import { attestationRepo } from "@/server/repositories";

export async function indexPublishedAttestationTransaction(txHash: string) {
  const attestations = await indexAttestationTransaction({
    txHash: txHash as `0x${string}`,
  });

  for (const attestation of attestations) {
    await persistIndexedAttestation(attestation);
  }

  return attestations;
}

export async function persistIndexedAttestation(
  attestation: IndexedAttestation
) {
  return attestationRepo.upsert({
    network: attestation.network,
    treasury: attestation.treasury,
    reportHash: attestation.reportHash,
    publisher: attestation.publisher,
    txHash: attestation.txHash,
    blockNumber: attestation.blockNumber.toString(),
    timestamp: attestation.timestamp,
  });
}
