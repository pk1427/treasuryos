import { NextResponse } from "next/server";
import { generateRiskReport } from "@/lib/v1-report";

export const maxDuration = 60;
const REPORT_GENERATION_TIMEOUT_MS = 45_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = body.address;

  if (typeof address !== "string") {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const result = await withTimeout(
      generateRiskReport(address),
      REPORT_GENERATION_TIMEOUT_MS
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report failed" },
      { status: 400 }
    );
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Report generation timed out.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
