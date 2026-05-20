import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { syncToVercel } from "@/lib/env-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { env } = await request.json();
    const result = await syncToVercel(name, env || "prod");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync" },
      { status: 400 }
    );
  }
}
