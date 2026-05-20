import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { mergeBranch } from "@/lib/git";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { source } = await request.json();
    const result = await mergeBranch(name, source);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to merge branch" },
      { status: 400 }
    );
  }
}
