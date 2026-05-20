import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { getLoop, startLoopRun } from "@/lib/loops";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    sanitizeName(name);
    const loop = await getLoop(name, id);
    if (!loop) {
      return NextResponse.json({ error: "loop not found" }, { status: 404 });
    }
    const projectPath = getProjectPath(name);
    const executor = await startLoopRun(loop, projectPath);
    return NextResponse.json({ loopRunId: executor.state.loopRunId, state: executor.state }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start loop run" },
      { status: 400 }
    );
  }
}
