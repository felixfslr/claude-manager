import { NextRequest, NextResponse } from "next/server";
import { listProjectSessions } from "@/lib/tmux";
import { sanitizeName } from "@/lib/shell";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const sessions = await listProjectSessions(name);
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 400 }
    );
  }
}
