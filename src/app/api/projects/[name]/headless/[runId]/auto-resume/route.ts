// Arm or disarm auto-resume on a failed (typically rate-limited) run.
//
// POST   — schedule auto-resume. Body: { resumeAt?: string, prompt?: string }
//          resumeAt defaults to meta.rateLimitResetsAt.
// DELETE — cancel a scheduled auto-resume.

import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { readMeta, writeMeta } from "@/lib/headless-store";
import { ensureAutoResumeScheduler, runAutoResumeTickNow } from "@/lib/auto-resume";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> }
) {
  try {
    const { name, runId } = await params;
    sanitizeName(name);
    const meta = await readMeta(name, runId);
    if (!meta) {
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    if (!meta.claudeSessionId) {
      return NextResponse.json(
        { error: "run never reached the init event — nothing to resume" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeAt?: string;
      prompt?: string;
    };

    // Pick the resume time: explicit override > detected rate limit reset >
    // 1 hour from now as a last resort.
    let resumeAt: string;
    if (typeof body.resumeAt === "string" && body.resumeAt) {
      const d = new Date(body.resumeAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "invalid resumeAt" }, { status: 400 });
      }
      resumeAt = d.toISOString();
    } else if (meta.rateLimitResetsAt) {
      resumeAt = meta.rateLimitResetsAt;
    } else {
      resumeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    meta.autoResumeAt = resumeAt;
    meta.autoResumeStartedAt = undefined;
    meta.autoResumeError = undefined;
    if (typeof body.prompt === "string" && body.prompt.trim()) {
      meta.autoResumePrompt = body.prompt.trim();
    }
    await writeMeta(meta);

    // Make sure the scheduler is alive and run one tick immediately in case
    // the reset time is already in the past (e.g. user waited).
    ensureAutoResumeScheduler();
    void runAutoResumeTickNow();

    return NextResponse.json({ ok: true, autoResumeAt: resumeAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to schedule auto-resume" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> }
) {
  try {
    const { name, runId } = await params;
    sanitizeName(name);
    const meta = await readMeta(name, runId);
    if (!meta) {
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    meta.autoResumeAt = undefined;
    meta.autoResumeStartedAt = undefined;
    meta.autoResumeError = undefined;
    await writeMeta(meta);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel auto-resume" },
      { status: 400 }
    );
  }
}
