import { NextResponse } from "next/server";
import { generateTreasuryBriefing } from "@/lib/ai/analyst";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = body.address;
  const provider = body.provider;

  if (typeof address !== "string") {
    return NextResponse.json(
      { error: "address required" },
      { status: 400 }
    );
  }

  try {
    const briefing = await generateTreasuryBriefing(address, provider);
    return NextResponse.json(briefing);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate treasury briefing",
      },
      { status: 500 }
    );
  }
}
