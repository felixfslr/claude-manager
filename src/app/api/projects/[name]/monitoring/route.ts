import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getPm2Processes, getPm2Logs } from "@/lib/monitoring";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const lines = parseInt(new URL(request.url).searchParams.get("lines") || "50");
    const [processes, logs] = await Promise.all([
      getPm2Processes(),
      getPm2Logs(name, lines),
    ]);
    return NextResponse.json({ processes, logs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
