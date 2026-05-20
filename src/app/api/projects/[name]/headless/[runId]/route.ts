import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { readAllEvents, deleteRun, getEventsSize } from "@/lib/headless-store";
import { getRunMeta, getRunner } from "@/lib/headless";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> }
) {
  try {
    const { name, runId } = await params;
    sanitizeName(name);
    const meta = await getRunMeta(name, runId);
    if (!meta) {
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    const events = await readAllEvents(name, runId);
    const eventsSize = await getEventsSize(name, runId);
    return NextResponse.json({ meta, events, eventsSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read run" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> }
) {
  try {
    const { name, runId } = await params;
    sanitizeName(name);
    const url = new URL(request.url);
    const purge = url.searchParams.get("purge") === "1";

    if (purge) {
      // Hard delete: must not be running.
      const meta = await getRunMeta(name, runId);
      if (meta && meta.status === "running") {
        return NextResponse.json(
          { error: "Cannot purge a running run; cancel it first" },
          { status: 409 }
        );
      }
      await deleteRun(name, runId);
      return NextResponse.json({ ok: true, purged: true });
    }

    // Default: cancel the run if it's still alive in this process.
    const runner = getRunner(runId);
    if (runner) {
      await runner.cancel();
      return NextResponse.json({ ok: true, cancelled: true });
    }
    // Otherwise the run is either finished or running in a different process.
    const meta = await getRunMeta(name, runId);
    if (!meta) {
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, cancelled: false, meta });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel run" },
      { status: 400 }
    );
  }
}
