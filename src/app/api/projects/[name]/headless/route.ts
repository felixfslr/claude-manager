import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { listRuns } from "@/lib/headless-store";
import { startHeadlessRun, reconcileRunStatus } from "@/lib/headless";
import { ensureAutoResumeScheduler } from "@/lib/auto-resume";
import type {
  EffortLevel,
  HeadlessRunRequest,
  PermissionMode,
} from "@/lib/headless-types";

const VALID_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
];

const VALID_EFFORTS: EffortLevel[] = ["low", "medium", "high", "max"];

function coercePermissionMode(value: unknown): PermissionMode {
  if (typeof value === "string" && (VALID_MODES as string[]).includes(value)) {
    return value as PermissionMode;
  }
  return "bypassPermissions";
}

function coerceEffortLevel(value: unknown): EffortLevel | undefined {
  if (typeof value === "string" && (VALID_EFFORTS as string[]).includes(value)) {
    return value as EffortLevel;
  }
  return undefined;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const runs = await listRuns(name);
    const reconciled = await Promise.all(runs.map(reconcileRunStatus));
    return NextResponse.json(reconciled);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list runs" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const projectPath = getProjectPath(name);

    const body = (await request.json()) as Partial<HeadlessRunRequest>;
    if (!body.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const req: HeadlessRunRequest = {
      prompt: body.prompt,
      permissionMode: coercePermissionMode(body.permissionMode),
      model: typeof body.model === "string" && body.model ? body.model : undefined,
      effortLevel: coerceEffortLevel(body.effortLevel),
      maxTurns: typeof body.maxTurns === "number" ? body.maxTurns : undefined,
      maxBudgetUsd:
        typeof body.maxBudgetUsd === "number" ? body.maxBudgetUsd : undefined,
      appendSystemPrompt:
        typeof body.appendSystemPrompt === "string" && body.appendSystemPrompt
          ? body.appendSystemPrompt
          : undefined,
      allowedTools:
        typeof body.allowedTools === "string" && body.allowedTools
          ? body.allowedTools
          : undefined,
      disallowedTools:
        typeof body.disallowedTools === "string" && body.disallowedTools
          ? body.disallowedTools
          : undefined,
      addDirs: Array.isArray(body.addDirs)
        ? body.addDirs.filter((d) => typeof d === "string")
        : undefined,
      resumeSessionId:
        typeof body.resumeSessionId === "string" && body.resumeSessionId
          ? body.resumeSessionId
          : undefined,
      forkSession: body.forkSession === true,
      parentLoopRunId:
        typeof body.parentLoopRunId === "string" ? body.parentLoopRunId : undefined,
      loopPhaseName:
        typeof body.loopPhaseName === "string" ? body.loopPhaseName : undefined,
    };

    // Boot the auto-resume scheduler lazily on the first headless run. It's
    // idempotent so calling this on every POST is cheap.
    ensureAutoResumeScheduler();

    const runner = await startHeadlessRun(name, projectPath, req);
    return NextResponse.json(
      { runId: runner.runId, meta: runner.meta },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start run" },
      { status: 400 }
    );
  }
}
