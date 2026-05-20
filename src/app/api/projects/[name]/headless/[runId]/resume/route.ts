import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { getRunMeta, startHeadlessRun } from "@/lib/headless";
import type { HeadlessRunRequest } from "@/lib/headless-types";

/**
 * Start a new run that resumes an existing run's claude session_id.
 * Body: { prompt, forkSession?, ...flag overrides }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> }
) {
  try {
    const { name, runId } = await params;
    sanitizeName(name);
    const projectPath = getProjectPath(name);

    const target = await getRunMeta(name, runId);
    if (!target) {
      return NextResponse.json({ error: "source run not found" }, { status: 404 });
    }
    if (!target.claudeSessionId) {
      return NextResponse.json(
        { error: "source run never reached the init event — nothing to resume" },
        { status: 400 }
      );
    }
    if (target.cwd !== projectPath) {
      return NextResponse.json(
        { error: "source run cwd does not match this project" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<HeadlessRunRequest>;
    const req: HeadlessRunRequest = {
      prompt: typeof body.prompt === "string" && body.prompt ? body.prompt : "Continue.",
      permissionMode: body.permissionMode ?? target.permissionMode,
      model: body.model ?? target.model,
      effortLevel: body.effortLevel ?? target.effortLevel,
      maxTurns: body.maxTurns ?? target.maxTurns,
      maxBudgetUsd: body.maxBudgetUsd ?? target.maxBudgetUsd,
      appendSystemPrompt: body.appendSystemPrompt ?? target.appendSystemPrompt,
      allowedTools: body.allowedTools ?? target.allowedTools,
      disallowedTools: body.disallowedTools ?? target.disallowedTools,
      addDirs: body.addDirs ?? target.addDirs,
      resumeSessionId: target.claudeSessionId,
      forkSession: body.forkSession === true,
    };

    const runner = await startHeadlessRun(name, projectPath, req);
    return NextResponse.json(
      { runId: runner.runId, meta: runner.meta },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resume" },
      { status: 400 }
    );
  }
}
