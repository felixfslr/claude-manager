import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { getRepoInfo } from "@/lib/github";
import { runCommand } from "@/lib/shell";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const projectPath = getProjectPath(name);

    // Get remote URL
    let remoteUrl: string;
    try {
      const { stdout } = await runCommand("git remote get-url origin 2>/dev/null", {
        cwd: projectPath,
      });
      remoteUrl = stdout;
    } catch {
      return NextResponse.json({ error: "No git remote found" }, { status: 404 });
    }

    if (!remoteUrl) {
      return NextResponse.json({ error: "No git remote found" }, { status: 404 });
    }

    const info = await getRepoInfo(remoteUrl);
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get GitHub info" },
      { status: 400 }
    );
  }
}
