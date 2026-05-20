// HeadlessRunner: spawns `claude -p ... --output-format stream-json` and
// streams its NDJSON output to disk + an in-memory event emitter.
//
// Lifecycle:
//   pending -> running -> succeeded | failed | cancelled
//
// Disk is the source of truth: every parsed event is appended to events.jsonl
// BEFORE in-memory subscribers are notified. The WS bridge in server.mjs
// disk-tails events.jsonl, so it stays in sync even though it lives in a
// different process from the Next API routes.

import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import {
  appendEvent,
  readMeta,
  writeMeta,
  isProcessAlive,
} from "./headless-store";
import { detectRateLimit } from "./rate-limit";
import type {
  HeadlessRunMeta,
  HeadlessRunRequest,
  HeadlessRunStatus,
  HeadlessUsage,
  PermissionMode,
} from "./headless-types";

const KILL_GRACE_MS = 5000;

/** In-memory registry, keyed by runId. Survives only within one Next/server process. */
const runRegistry = new Map<string, HeadlessRunner>();

export function getRunner(runId: string): HeadlessRunner | undefined {
  return runRegistry.get(runId);
}

export class HeadlessRunner extends EventEmitter {
  readonly runId: string;
  readonly projectName: string;
  readonly cwd: string;
  meta: HeadlessRunMeta;
  private child?: ChildProcess;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private finalized = false;

  constructor(projectName: string, cwd: string, request: HeadlessRunRequest) {
    super();
    this.runId = randomUUID();
    this.projectName = projectName;
    this.cwd = cwd;
    this.meta = {
      runId: this.runId,
      projectName,
      cwd,
      prompt: request.prompt,
      permissionMode: request.permissionMode,
      model: request.model,
      effortLevel: request.effortLevel,
      maxTurns: request.maxTurns,
      maxBudgetUsd: request.maxBudgetUsd,
      appendSystemPrompt: request.appendSystemPrompt,
      allowedTools: request.allowedTools,
      disallowedTools: request.disallowedTools,
      addDirs: request.addDirs,
      resumeSessionId: request.resumeSessionId,
      forkSession: request.forkSession,
      parentLoopRunId: request.parentLoopRunId,
      loopPhaseName: request.loopPhaseName,
      status: "pending",
      startedAt: new Date().toISOString(),
    };
  }

  /** Build the argv passed to spawn(). Prompt is always an argv element. */
  buildArgv(): string[] {
    const argv: string[] = [
      "-p",
      this.meta.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ];

    if (this.meta.permissionMode === "bypassPermissions") {
      argv.push("--dangerously-skip-permissions");
    } else {
      argv.push("--permission-mode", this.meta.permissionMode);
    }

    if (this.meta.model) argv.push("--model", this.meta.model);
    if (this.meta.effortLevel) argv.push("--effort", this.meta.effortLevel);
    if (this.meta.maxTurns != null) argv.push("--max-turns", String(this.meta.maxTurns));
    if (this.meta.maxBudgetUsd != null)
      argv.push("--max-budget-usd", String(this.meta.maxBudgetUsd));
    if (this.meta.appendSystemPrompt)
      argv.push("--append-system-prompt", this.meta.appendSystemPrompt);
    if (this.meta.allowedTools) argv.push("--allowedTools", this.meta.allowedTools);
    if (this.meta.disallowedTools)
      argv.push("--disallowedTools", this.meta.disallowedTools);
    if (this.meta.addDirs) {
      for (const d of this.meta.addDirs) argv.push("--add-dir", d);
    }
    if (this.meta.resumeSessionId) argv.push("--resume", this.meta.resumeSessionId);
    if (this.meta.forkSession) argv.push("--fork-session");

    return argv;
  }

  /** Spawn the child process and start streaming. */
  async start(): Promise<void> {
    // Persist initial meta so the run is discoverable on disk immediately.
    await writeMeta(this.meta);

    const argv = this.buildArgv();
    const child = spawn("claude", argv, {
      cwd: this.cwd,
      env: { ...process.env, HOME: process.env.HOME ?? "/home/felix" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child = child;

    this.meta.status = "running";
    this.meta.pid = child.pid;
    await writeMeta(this.meta);
    this.emit("meta", this.meta);

    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      this.handleStdoutChunk(chunk).catch((err) => {
        console.error(`[headless ${this.runId}] stdout handler error:`, err);
      });
    });

    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });

    child.on("error", (err) => {
      console.error(`[headless ${this.runId}] spawn error:`, err);
      this.finalize("failed", undefined, err.message).catch(() => {});
    });

    child.on("exit", (code, signal) => {
      // Drain any partial buffered line.
      this.handleStdoutChunk("\n").catch(() => {});
      const exitCode = code ?? (signal ? -1 : 0);
      let next: HeadlessRunStatus;
      if (this.meta.status === "cancelled") {
        next = "cancelled";
      } else if (
        this.meta.resultSubtype === "success" ||
        (exitCode === 0 && this.meta.resultSubtype == null)
      ) {
        next = "succeeded";
      } else {
        next = "failed";
      }
      this.finalize(next, exitCode).catch((err) => {
        console.error(`[headless ${this.runId}] finalize failed:`, err);
      });
    });

    runRegistry.set(this.runId, this);
  }

  private async handleStdoutChunk(chunk: string): Promise<void> {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        // Forward as a synthetic error event so the UI can see what happened.
        const synthetic = {
          type: "synthetic",
          subtype: "parse_error",
          raw: line.slice(0, 500),
          error: err instanceof Error ? err.message : String(err),
        };
        await appendEvent(this.projectName, this.runId, synthetic);
        this.emit("event", synthetic);
        continue;
      }
      // Persist FIRST, then notify in-memory subscribers.
      await appendEvent(this.projectName, this.runId, parsed);
      this.applyEventToMeta(parsed);
      this.emit("event", parsed);
    }
  }

  /** Update meta from interesting events: system.init, message_delta, result. */
  private applyEventToMeta(event: unknown): void {
    if (!event || typeof event !== "object") return;
    const e = event as Record<string, unknown>;
    const type = e.type as string | undefined;
    const subtype = e.subtype as string | undefined;

    let dirty = false;

    // First system.init carries the claude session_id. The CLI emits it as a
    // top-level field on the init event; older code expected it under .data,
    // which never matched reality and left claudeSessionId unset — breaking
    // --resume. Check all three shapes so we're robust to future changes.
    if (type === "system" && subtype === "init" && !this.meta.claudeSessionId) {
      const topLevel = e.session_id;
      const nested = (e.data as Record<string, unknown> | undefined)?.session_id;
      const sessionObj = (e.session as Record<string, unknown> | undefined)?.id;
      const sid = topLevel ?? nested ?? sessionObj;
      if (typeof sid === "string") {
        this.meta.claudeSessionId = sid;
        dirty = true;
      }
    }

    // stream_event with message_delta carries running usage updates.
    if (type === "stream_event") {
      const inner = e.event as Record<string, unknown> | undefined;
      if (inner?.type === "message_delta") {
        const usage = inner.usage as HeadlessUsage | undefined;
        if (usage) {
          this.meta.usage = { ...(this.meta.usage ?? {}), ...usage };
          dirty = true;
        }
      }
    }

    // Final result event has cumulative usage + cost + subtype.
    if (type === "result") {
      this.meta.resultSubtype = subtype;
      const usage = e.usage as HeadlessUsage | undefined;
      if (usage) this.meta.usage = usage;
      const cost = e.total_cost_usd;
      if (typeof cost === "number") this.meta.totalCostUsd = cost;
      const turns = e.num_turns;
      if (typeof turns === "number") this.meta.numTurns = turns;
      const result = e.result;
      if (typeof result === "string") this.meta.resultText = result;
      dirty = true;
    }

    if (dirty) {
      // Fire-and-forget: writes are small and ordering vs events doesn't matter.
      writeMeta(this.meta).catch((err) =>
        console.error(`[headless ${this.runId}] writeMeta failed:`, err)
      );
      this.emit("meta", this.meta);
    }
  }

  private async finalize(
    status: HeadlessRunStatus,
    exitCode?: number,
    errorMessage?: string
  ): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;
    this.meta.status = status;
    this.meta.endedAt = new Date().toISOString();
    if (exitCode !== undefined) this.meta.exitCode = exitCode;
    if (errorMessage) this.meta.errorMessage = errorMessage;
    if (this.stderrBuffer && !this.meta.errorMessage) {
      this.meta.errorMessage = this.stderrBuffer.slice(-2000);
    }
    // Rate limit detection: when the run failed, scan error + stderr + the
    // final result text for rate-limit fingerprints. If we find one, record
    // the flag + expected reset time so the UI can offer auto-resume.
    if (status === "failed") {
      const detection = detectRateLimit(
        this.meta.errorMessage,
        this.stderrBuffer,
        this.meta.resultText
      );
      if (detection.isRateLimit) {
        this.meta.rateLimited = true;
        this.meta.rateLimitResetsAt = detection.resetsAt;
      }
    }
    this.meta.pid = undefined;
    await writeMeta(this.meta);
    this.emit("meta", this.meta);
    this.emit("closed", { reason: status });
    runRegistry.delete(this.runId);
  }

  /** Send SIGTERM, then SIGKILL after a 5s grace period. */
  async cancel(): Promise<void> {
    if (this.finalized || !this.child) return;
    this.meta.status = "cancelled";
    await writeMeta(this.meta);
    this.emit("meta", this.meta);
    try {
      this.child.kill("SIGTERM");
    } catch {
      // already dead
    }
    setTimeout(() => {
      if (!this.finalized && this.child && !this.child.killed) {
        try {
          this.child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }, KILL_GRACE_MS).unref?.();
  }
}

/**
 * On listRuns calls (and at server boot), check whether any runs marked
 * `running` are actually orphaned. Returns the meta with status flipped if so,
 * and persists the change.
 */
export async function reconcileRunStatus(
  meta: HeadlessRunMeta
): Promise<HeadlessRunMeta> {
  if (meta.status !== "running") return meta;
  // If the in-memory runner exists for this runId, trust it — the run is alive
  // in this process.
  if (runRegistry.has(meta.runId)) return meta;
  // Otherwise check the recorded pid. If the process is gone, mark orphaned.
  if (!isProcessAlive(meta.pid)) {
    const updated: HeadlessRunMeta = {
      ...meta,
      status: "orphaned",
      pid: undefined,
      endedAt: meta.endedAt ?? new Date().toISOString(),
    };
    try {
      await writeMeta(updated);
    } catch {
      // best-effort
    }
    return updated;
  }
  return meta;
}

/** Look up a run on disk and reconcile its status. */
export async function getRunMeta(
  projectName: string,
  runId: string
): Promise<HeadlessRunMeta | null> {
  const meta = await readMeta(projectName, runId);
  if (!meta) return null;
  return reconcileRunStatus(meta);
}

/** Helper used by API/loops to start a fresh run from a request. */
export async function startHeadlessRun(
  projectName: string,
  cwd: string,
  request: HeadlessRunRequest
): Promise<HeadlessRunner> {
  const runner = new HeadlessRunner(projectName, cwd, request);
  await runner.start();
  return runner;
}

export type { PermissionMode };
