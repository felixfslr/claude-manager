import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listWorkflowRuns } from "@/lib/cicd";
import { runCommand, getProjectPath } from "@/lib/shell";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    // Get GitHub remote to extract owner/repo
    const { stdout } = await runCommand("git remote get-url origin 2>/dev/null", {
      cwd: getProjectPath(name),
    });
    const match = stdout.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) return NextResponse.json([]);
    const runs = await listWorkflowRuns(match[1], match[2]);
    return NextResponse.json(runs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
