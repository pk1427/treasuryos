import { NextResponse } from "next/server";
import { executionPlanRepo } from "@/server/repositories";
import { recoverMessageAddress } from "viem";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const signerAddress = body.signerAddress;
    const signature = body.signature;
    const signedMessage = body.signedMessage;

    if (!signerAddress || !signature || !signedMessage) {
      return NextResponse.json(
        { error: "signerAddress, signature, and signedMessage are required" },
        { status: 400 }
      );
    }

    const plan = await executionPlanRepo.findById(id);

    if (!plan) {
      return NextResponse.json(
        { error: "Execution plan not found" },
        { status: 404 }
      );
    }

    if (!plan.simulationResult) {
      return NextResponse.json(
        { error: "Cannot sign plan without simulation results. Simulate the plan first." },
        { status: 409 }
      );
    }

    if (plan.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Cannot sign plan with status: ${plan.status}. Only APPROVED plans can be signed.` },
        { status: 409 }
      );
    }

    const normalizedSigner = signerAddress.toLowerCase();
    const normalizedPlanWallet = plan.walletAddress.toLowerCase();

    if (normalizedSigner !== normalizedPlanWallet) {
      return NextResponse.json(
        { error: `Signer address mismatch. Plan belongs to ${plan.walletAddress}, but signer is ${signerAddress}.` },
        { status: 403 }
      );
    }

    try {
      const recoveredAddress = await recoverMessageAddress({
        message: signedMessage,
        signature: signature as `0x${string}`,
      });
      if (recoveredAddress.toLowerCase() !== normalizedSigner) {
        return NextResponse.json(
          { error: "Invalid signature: recovered address does not match claimed signer." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid signature format or verification failed." },
        { status: 403 }
      );
    }

    const updated = await executionPlanRepo.saveSignature(
      id,
      normalizedSigner,
      signedMessage,
      signature
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to save signature" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      signerAddress: updated.signerAddress,
      signedAt: updated.signedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sign execution plan",
      },
      { status: 500 }
    );
  }
}
