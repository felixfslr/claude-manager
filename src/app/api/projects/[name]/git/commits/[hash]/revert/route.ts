import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { revertCommit } from "@/lib/git";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; hash: string }> }
) {
  try {
    const { name, hash } = await params;
    sanitizeName(name);
    const result = await revertCommit(name, hash);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revert commit" },
      { status: 400 }
    );
  }
}
