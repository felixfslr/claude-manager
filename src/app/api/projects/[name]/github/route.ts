import { NextRequest, NextResponse } from "next/server";
import { createGithubRepo, initAndPushToGithub } from "@/lib/github";
import { sanitizeName } from "@/lib/shell";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { isPrivate } = await request.json().catch(() => ({ isPrivate: false }));

    const repo = await createGithubRepo(name, isPrivate);
    await initAndPushToGithub(name, repo.clone_url);

    return NextResponse.json({
      ok: true,
      repoUrl: repo.html_url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create GitHub repo" },
      { status: 400 }
    );
  }
}
