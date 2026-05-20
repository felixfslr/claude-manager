import { NextRequest, NextResponse } from "next/server";
import { listRepoBranches } from "@/lib/github";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await params;
    const branches = await listRepoBranches(owner, repo);
    return NextResponse.json(branches);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list branches" },
      { status: 500 }
    );
  }
}
