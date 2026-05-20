import { NextResponse } from "next/server";
import { listZones } from "@/lib/cloudflare";

export async function GET() {
  try {
    const zones = await listZones();
    return NextResponse.json(zones);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list zones" },
      { status: 500 }
    );
  }
}
