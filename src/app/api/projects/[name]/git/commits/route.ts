import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getCommitHistory } from "@/lib/git";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "30");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const commits = await getCommitHistory(name, limit, offset);
    return NextResponse.json(commits);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get commits" },
      { status: 500 }
    );
  }
}
