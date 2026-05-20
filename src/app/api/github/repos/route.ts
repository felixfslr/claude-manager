import { NextRequest, NextResponse } from "next/server";
import { listUserRepos } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const repos = await listUserRepos(page, 30);
    return NextResponse.json(repos);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list repos" },
      { status: 500 }
    );
  }
}
