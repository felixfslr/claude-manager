// GET /api/projects/[name]/headless/thread/[sessionId]
//
// Returns every run in a project that shares a Claude session id, plus
// each run's events. This is the backing endpoint for the chat-style
// thread view: one claudeSessionId -> many runs -> one conversation.

import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import {
  listRunsBySession,
  readAllEvents,
  getEventsSize,
} from "@/lib/headless-store";
import { reconcileRunStatus } from "@/lib/headless";
import type { HeadlessRunMeta } from "@/lib/headless-types";

// Claude session IDs are UUIDs, but allow the broader "safe ish" shape to
// match the run-id validator elsewhere and keep this forgiving.
const SESSION_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; sessionId: string }> }
) {
  try {
    const { name, sessionId } = await params;
    sanitizeName(name);
    if (!SESSION_ID_RE.test(sessionId)) {
      return NextResponse.json({ error: "invalid session id" }, { status: 400 });
    }

    const rawRuns = await listRunsBySession(name, sessionId);
    if (rawRuns.length === 0) {
      return NextResponse.json(
        { error: "no runs for this session" },
        { status: 404 }
      );
    }

    // Make sure any "running" rows that actually crashed get flipped to
    // "orphaned" so the chat input doesn't stay disabled forever.
    const runs: HeadlessRunMeta[] = await Promise.all(
      rawRuns.map(reconcileRunStatus)
    );

    // Load events + sizes in parallel per run.
    const events: Record<string, unknown[]> = {};
    const eventsSizes: Record<string, number> = {};
    await Promise.all(
      runs.map(async (run) => {
        const [evs, size] = await Promise.all([
          readAllEvents(name, run.runId),
          getEventsSize(name, run.runId),
        ]);
        events[run.runId] = evs;
        eventsSizes[run.runId] = size;
      })
    );

    return NextResponse.json({ runs, events, eventsSizes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load thread",
      },
      { status: 400 }
    );
  }
}
