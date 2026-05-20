import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listPrompts } from "@/lib/prompts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const prompts = await listPrompts(name);
    return NextResponse.json(prompts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list prompts" },
      { status: 400 }
    );
  }
}
