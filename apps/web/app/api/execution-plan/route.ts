import { NextResponse } from "next/server";
import { generateExecutionPlan } from "@/lib/ai/planner";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const address = body.address;

  if (typeof address !== "string") {
    return NextResponse.json(
      { error: "address required" },
      { status: 400 }
    );
  }

  try {
    const plan = await generateExecutionPlan(address);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate execution plan",
      },
      { status: 500 }
    );
  }
}
