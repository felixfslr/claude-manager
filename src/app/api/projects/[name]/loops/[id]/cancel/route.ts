import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getActiveLoopRun, listLoopRuns } from "@/lib/loops";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    sanitizeName(name);

    // Allow cancelling either by query (?loopRunId=...) or by cancelling the
    // most recent active run for this loop.
    const url = new URL(request.url);
    let loopRunId = url.searchParams.get("loopRunId") ?? undefined;
    if (!loopRunId) {
      const runs = await listLoopRuns(name, id);
      const active = runs.find((r) => r.status === "running");
      loopRunId = active?.loopRunId;
    }
    if (!loopRunId) {
      return NextResponse.json({ error: "no active loop run to cancel" }, { status: 404 });
    }
    const executor = getActiveLoopRun(loopRunId);
    if (!executor) {
      return NextResponse.json(
        { error: "loop run is not active in this process" },
        { status: 409 }
      );
    }
    await executor.cancel();
    return NextResponse.json({ ok: true, loopRunId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel loop run" },
      { status: 400 }
    );
  }
}
