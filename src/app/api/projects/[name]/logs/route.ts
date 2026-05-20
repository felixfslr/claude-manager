import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { capturePaneOutput } from "@/lib/tmux";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const session = `claude-${name}`;
    const output = await capturePaneOutput(session);
    return NextResponse.json({ output });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get logs" },
      { status: 400 }
    );
  }
}
