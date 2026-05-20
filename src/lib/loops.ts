// Loops: orchestrate chained headless runs (e.g. plan → implement → test → debug).
//
// Loops are stored at ~/.claude-manager/loops/<projectName>/<loopId>.json.
// Loop runs are stored at ~/.claude-manager/loops/<projectName>/runs/<loopRunId>.json.

import fs from "fs/promises";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { startHeadlessRun } from "./headless";
import { readMeta } from "./headless-store";
import type {
  HeadlessRunMeta,
  LoopDef,
  LoopPhase,
  LoopPhaseRun,
  LoopRunState,
} from "./headless-types";

const ROOT = path.join(os.homedir(), ".claude-manager", "loops");
const PROJECT_NAME_RE = /^[a-zA-Z0-9_-]{1,50}$/;
const LOOP_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

function validateProject(projectName: string): void {
  if (!PROJECT_NAME_RE.test(projectName)) {
    throw new Error(`Invalid project name: ${projectName}`);
  }
}
function validateLoopId(loopId: string): void {
  if (!LOOP_ID_RE.test(loopId)) {
    throw new Error(`Invalid loop id: ${loopId}`);
  }
}

function getLoopDir(projectName: string): string {
  validateProject(projectName);
  return path.join(ROOT, projectName);
}

function getLoopPath(projectName: string, loopId: string): string {
  validateLoopId(loopId);
  return path.join(getLoopDir(projectName), `${loopId}.json`);
}

function getLoopRunPath(projectName: string, loopRunId: string): string {
  validateLoopId(loopRunId);
  return path.join(getLoopDir(projectName), "runs", `${loopRunId}.json`);
}

// ----- Loop CRUD ----------------------------------------------------------

export async function listLoops(projectName: string): Promise<LoopDef[]> {
  const dir = getLoopDir(projectName);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: LoopDef[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const id = entry.name.replace(/\.json$/, "");
    if (!LOOP_ID_RE.test(id)) continue;
    try {
      const raw = await fs.readFile(path.join(dir, entry.name), "utf-8");
      out.push(JSON.parse(raw) as LoopDef);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function getLoop(
  projectName: string,
  loopId: string
): Promise<LoopDef | null> {
  try {
    const raw = await fs.readFile(getLoopPath(projectName, loopId), "utf-8");
    return JSON.parse(raw) as LoopDef;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveLoop(loop: LoopDef): Promise<void> {
  const dir = getLoopDir(loop.projectName);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    getLoopPath(loop.projectName, loop.id),
    JSON.stringify(loop, null, 2),
    "utf-8"
  );
}

export async function deleteLoop(projectName: string, loopId: string): Promise<void> {
  try {
    await fs.unlink(getLoopPath(projectName, loopId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

export function newLoop(
  projectName: string,
  name: string,
  phases: LoopPhase[],
  description?: string
): LoopDef {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    projectName,
    name,
    description,
    phases,
    createdAt: now,
    updatedAt: now,
  };
}

// ----- Loop run state -----------------------------------------------------

export async function readLoopRun(
  projectName: string,
  loopRunId: string
): Promise<LoopRunState | null> {
  try {
    const raw = await fs.readFile(getLoopRunPath(projectName, loopRunId), "utf-8");
    return JSON.parse(raw) as LoopRunState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeLoopRun(state: LoopRunState): Promise<void> {
  const dir = path.join(getLoopDir(state.projectName), "runs");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    getLoopRunPath(state.projectName, state.loopRunId),
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}

export async function listLoopRuns(
  projectName: string,
  loopId?: string
): Promise<LoopRunState[]> {
  const dir = path.join(getLoopDir(projectName), "runs");
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: LoopRunState[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, entry.name), "utf-8");
      const state = JSON.parse(raw) as LoopRunState;
      if (!loopId || state.loopId === loopId) out.push(state);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return out;
}

// ----- Loop execution -----------------------------------------------------

const activeLoopRuns = new Map<string, LoopExecutor>();

export function getActiveLoopRun(loopRunId: string): LoopExecutor | undefined {
  return activeLoopRuns.get(loopRunId);
}

function applyTokens(template: string, prevResult: string | undefined): string {
  return template.replace(/\{\{previous_result\}\}/g, prevResult ?? "");
}

function matches(pattern: string | undefined, text: string): boolean {
  if (!pattern) return false;
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}

export class LoopExecutor {
  readonly state: LoopRunState;
  private cancelled = false;
  private currentRunId?: string;

  constructor(
    readonly loop: LoopDef,
    readonly projectPath: string
  ) {
    this.state = {
      loopRunId: randomUUID(),
      loopId: loop.id,
      projectName: loop.projectName,
      status: "pending",
      startedAt: new Date().toISOString(),
      phaseRuns: [],
    };
  }

  async start(): Promise<void> {
    this.state.status = "running";
    await writeLoopRun(this.state);
    activeLoopRuns.set(this.state.loopRunId, this);
    // Run async; do not await — caller gets the loopRunId immediately.
    this.execute().catch((err) => {
      console.error(`[loop ${this.state.loopRunId}] execute error:`, err);
    });
  }

  private async execute(): Promise<void> {
    let prevClaudeSessionId: string | undefined;
    let prevResultText: string | undefined;
    try {
      for (let i = 0; i < this.loop.phases.length; i++) {
        if (this.cancelled) break;
        const phase = this.loop.phases[i];
        this.state.currentPhaseIndex = i;
        await writeLoopRun(this.state);

        const maxRetries = phase.maxRetries ?? 0;
        let succeeded = false;
        let phaseSessionId: string | undefined;
        let phaseResultText: string | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          if (this.cancelled) break;
          // First attempt of a phase that resumes previous: pass prevClaudeSessionId.
          // Retries always resume the same phase's own session if available.
          let resumeId: string | undefined;
          if (attempt > 0 && phaseSessionId) {
            resumeId = phaseSessionId;
          } else if (phase.resumePrevious && prevClaudeSessionId) {
            resumeId = prevClaudeSessionId;
          }

          const promptText = applyTokens(phase.prompt, prevResultText);
          const runner = await startHeadlessRun(
            this.loop.projectName,
            this.projectPath,
            {
              prompt: promptText,
              permissionMode: phase.permissionMode,
              model: phase.model,
              maxTurns: phase.maxTurns,
              appendSystemPrompt: phase.appendSystemPrompt,
              allowedTools: phase.allowedTools,
              disallowedTools: phase.disallowedTools,
              resumeSessionId: resumeId,
              parentLoopRunId: this.state.loopRunId,
              loopPhaseName: phase.name,
            }
          );
          this.currentRunId = runner.runId;
          const phaseRun: LoopPhaseRun = {
            phaseIndex: i,
            phaseName: phase.name,
            attempt,
            runId: runner.runId,
            status: "running",
            startedAt: new Date().toISOString(),
          };
          this.state.phaseRuns.push(phaseRun);
          await writeLoopRun(this.state);

          // Wait for runner to terminate.
          const finalMeta = await new Promise<HeadlessRunMeta>((resolve) => {
            runner.once("closed", async () => {
              const fresh =
                (await readMeta(this.loop.projectName, runner.runId)) ?? runner.meta;
              resolve(fresh);
            });
          });

          phaseRun.status = finalMeta.status;
          phaseRun.endedAt = finalMeta.endedAt ?? new Date().toISOString();
          await writeLoopRun(this.state);

          if (this.cancelled) break;

          if (finalMeta.claudeSessionId) phaseSessionId = finalMeta.claudeSessionId;
          phaseResultText = finalMeta.resultText;

          // Decide success/failure of this attempt.
          const text = phaseResultText ?? "";
          const failed = matches(phase.failPattern, text);
          const matchedSuccess = matches(phase.successPattern, text);
          const claudeSucceeded = finalMeta.resultSubtype === "success";

          if (!failed && (matchedSuccess || (!phase.successPattern && claudeSucceeded))) {
            succeeded = true;
            break;
          }
          if (failed) continue; // try again if retries remaining
          if (!claudeSucceeded) continue; // claude itself errored — retry
          // Default: success
          succeeded = true;
          break;
        }

        if (!succeeded) {
          this.state.status = "failed";
          this.state.errorMessage = `Phase "${phase.name}" did not succeed after ${maxRetries + 1} attempt(s)`;
          this.state.endedAt = new Date().toISOString();
          await writeLoopRun(this.state);
          activeLoopRuns.delete(this.state.loopRunId);
          return;
        }

        prevClaudeSessionId = phaseSessionId;
        prevResultText = phaseResultText;
      }

      if (this.cancelled) {
        this.state.status = "cancelled";
      } else {
        this.state.status = "succeeded";
      }
      this.state.endedAt = new Date().toISOString();
      await writeLoopRun(this.state);
    } catch (err) {
      this.state.status = "failed";
      this.state.errorMessage = err instanceof Error ? err.message : String(err);
      this.state.endedAt = new Date().toISOString();
      await writeLoopRun(this.state);
    } finally {
      activeLoopRuns.delete(this.state.loopRunId);
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.currentRunId) {
      // The currently active phase runner — kill it.
      const { getRunner } = await import("./headless");
      const runner = getRunner(this.currentRunId);
      if (runner) await runner.cancel();
    }
  }
}

// ----- Built-in template --------------------------------------------------

export const PLAN_IMPLEMENT_TEST_DEBUG_TEMPLATE: LoopPhase[] = [
  {
    name: "Plan",
    prompt:
      "Read the project, identify the next concrete improvement we should make, and produce a short numbered plan. Do not modify any files.",
    permissionMode: "plan",
  },
  {
    name: "Implement",
    prompt: "Implement the plan you just wrote. Make all necessary file changes.",
    permissionMode: "bypassPermissions",
    resumePrevious: true,
  },
  {
    name: "Test",
    prompt:
      "Run the project's test suite (or build, if there are no tests) and report the results verbatim. End your response with 'TESTS PASS' if everything is green or 'TESTS FAIL' otherwise.",
    permissionMode: "bypassPermissions",
    resumePrevious: true,
    successPattern: "TESTS PASS",
    failPattern: "TESTS FAIL",
  },
  {
    name: "Debug",
    prompt:
      "The tests are failing. Investigate the failure, fix the underlying issue, then re-run the tests. End your response with 'TESTS PASS' or 'TESTS FAIL'.",
    permissionMode: "bypassPermissions",
    resumePrevious: true,
    maxRetries: 5,
    successPattern: "TESTS PASS",
    failPattern: "TESTS FAIL",
  },
];

// ----- Public entry point --------------------------------------------------

export async function startLoopRun(
  loop: LoopDef,
  projectPath: string
): Promise<LoopExecutor> {
  const executor = new LoopExecutor(loop, projectPath);
  await executor.start();
  return executor;
}
