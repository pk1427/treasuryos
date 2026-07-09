import { NextResponse } from "next/server";
import { generateRiskReport } from "@/lib/v1-report";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = body.address;

  if (typeof address !== "string") {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const result = await generateRiskReport(address);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report failed" },
      { status: 400 }
    );
  }
}
