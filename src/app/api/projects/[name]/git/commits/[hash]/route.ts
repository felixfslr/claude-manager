import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getCommitDiff } from "@/lib/git";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; hash: string }> }
) {
  try {
    const { name, hash } = await params;
    sanitizeName(name);
    const diff = await getCommitDiff(name, hash);
    return NextResponse.json(diff);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get diff" },
      { status: 500 }
    );
  }
}
