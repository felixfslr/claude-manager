// Background scheduler that resumes rate-limited runs once their reset time
// has passed.
//
// Flow:
//   1. A run fails with rateLimited: true and rateLimitResetsAt set.
//   2. User clicks "Auto-resume when available" in the UI, which sets
//      autoResumeAt on the run's meta.
//   3. This scheduler ticks every 30s, scans every project for runs with
//      autoResumeAt in the past and no autoResumeStartedAt, and for each
//      one spawns a fresh headless run that resumes the claude session id.
//   4. The new run shows up in the thread automatically because the thread
//      view groups by claudeSessionId.
//
// We "claim" a run before spawning by writing autoResumeStartedAt + clearing
// autoResumeAt so a concurrent tick (or a manual retry) can't double-fire.
// If the spawn itself fails we record autoResumeError and leave the flag set
// so the user has to re-arm manually.

import fs from "fs/promises";
import { getHeadlessRoot, listRuns, writeMeta } from "./headless-store";
import { startHeadlessRun } from "./headless";
import type { HeadlessRunMeta, HeadlessRunRequest } from "./headless-types";

const TICK_INTERVAL_MS = 30_000;
const INITIAL_DELAY_MS = 5_000;

let schedulerStarted = false;

/**
 * Ensure the auto-resume scheduler is running in this process. Idempotent —
 * calling it multiple times is safe. Called lazily from the headless POST
 * route so the scheduler only spins up when headless mode is actually used.
 */
export function ensureAutoResumeScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  // Catch any runs that became due while the server was offline.
  setTimeout(() => {
    void tick();
  }, INITIAL_DELAY_MS).unref?.();
  const iv = setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
  iv.unref?.();
  console.log("[auto-resume] scheduler started");
}

async function tick(): Promise<void> {
  try {
    const root = getHeadlessRoot();
    let projectDirs: string[];
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }

    for (const project of projectDirs) {
      const runs = await listRuns(project).catch(() => [] as HeadlessRunMeta[]);
      for (const run of runs) {
        if (!shouldResume(run)) continue;
        await doResume(run).catch((err) => {
          console.error(`[auto-resume] ${project}/${run.runId} failed:`, err);
        });
      }
    }
  } catch (err) {
    console.error("[auto-resume] tick error:", err);
  }
}

function shouldResume(run: HeadlessRunMeta): boolean {
  if (!run.autoResumeAt) return false;
  if (run.autoResumeStartedAt) return false;
  if (!run.claudeSessionId) return false;
  const scheduled = new Date(run.autoResumeAt).getTime();
  if (Number.isNaN(scheduled)) return false;
  return scheduled <= Date.now();
}

async function doResume(run: HeadlessRunMeta): Promise<void> {
  // Claim the resume atomically: clear autoResumeAt and stamp the start time
  // BEFORE spawning anything. If the spawn fails the user can re-arm.
  const claimed: HeadlessRunMeta = {
    ...run,
    autoResumeAt: undefined,
    autoResumeStartedAt: new Date().toISOString(),
    autoResumeError: undefined,
  };
  await writeMeta(claimed);

  const req: HeadlessRunRequest = {
    prompt: run.autoResumePrompt ?? "Continue.",
    permissionMode: run.permissionMode,
    model: run.model,
    effortLevel: run.effortLevel,
    maxTurns: run.maxTurns,
    maxBudgetUsd: run.maxBudgetUsd,
    appendSystemPrompt: run.appendSystemPrompt,
    allowedTools: run.allowedTools,
    disallowedTools: run.disallowedTools,
    addDirs: run.addDirs,
    resumeSessionId: run.claudeSessionId,
  };

  try {
    const runner = await startHeadlessRun(run.projectName, run.cwd, req);
    console.log(
      `[auto-resume] ${run.projectName}/${run.runId} → ${runner.runId} (session ${run.claudeSessionId})`
    );
  } catch (err) {
    // Record the error on the original run so the UI can surface it.
    const failed: HeadlessRunMeta = {
      ...claimed,
      autoResumeError: err instanceof Error ? err.message : String(err),
    };
    try {
      await writeMeta(failed);
    } catch {
      // ignore
    }
  }
}

// Re-export a helper so the scheduler can be invoked once manually (e.g.
// by a "refresh" action in the UI). No-op if nothing is due.
export async function runAutoResumeTickNow(): Promise<void> {
  await tick();
}
