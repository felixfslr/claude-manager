import { NextResponse } from "next/server";
import { listGlobalPlans } from "@/lib/plans";

export async function GET() {
  try {
    const plans = await listGlobalPlans();
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list plans" },
      { status: 400 }
    );
  }
}
