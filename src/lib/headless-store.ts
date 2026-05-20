// Disk persistence for headless Claude runs.
// Storage layout:
//   ~/.claude-manager/headless/<projectName>/<runId>/
//     ├── meta.json     (atomic via tmp+rename)
//     └── events.jsonl  (append-only newline-delimited JSON)
//
// The HeadlessRunner is the only writer. Multiple readers are safe because
// events.jsonl is append-only and meta.json is replaced atomically.

import fs from "fs/promises";
import path from "path";
import os from "os";
import type { HeadlessRunMeta } from "./headless-types";

const ROOT = path.join(os.homedir(), ".claude-manager", "headless");
const PROJECT_NAME_RE = /^[a-zA-Z0-9_-]{1,50}$/;
const RUN_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

export function getHeadlessRoot(): string {
  return ROOT;
}

function validateProject(projectName: string): void {
  if (!PROJECT_NAME_RE.test(projectName)) {
    throw new Error(`Invalid project name: ${projectName}`);
  }
}

export function validateRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId)) {
    throw new Error(`Invalid run id: ${runId}`);
  }
}

export function getProjectDir(projectName: string): string {
  validateProject(projectName);
  return path.join(ROOT, projectName);
}

export function getRunDir(projectName: string, runId: string): string {
  validateProject(projectName);
  validateRunId(runId);
  const dir = path.join(ROOT, projectName, runId);
  // Containment check (defense-in-depth — both inputs are already validated).
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(ROOT) + path.sep)) {
    throw new Error("Run directory escapes the headless root");
  }
  return resolved;
}

export function getMetaPath(projectName: string, runId: string): string {
  return path.join(getRunDir(projectName, runId), "meta.json");
}

export function getEventsPath(projectName: string, runId: string): string {
  return path.join(getRunDir(projectName, runId), "events.jsonl");
}

async function ensureRunDir(projectName: string, runId: string): Promise<string> {
  const dir = getRunDir(projectName, runId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Atomic write via tmp + rename. */
export async function writeMeta(meta: HeadlessRunMeta): Promise<void> {
  const dir = await ensureRunDir(meta.projectName, meta.runId);
  const metaPath = path.join(dir, "meta.json");
  const tmpPath = `${metaPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(meta, null, 2), "utf-8");
  await fs.rename(tmpPath, metaPath);
}

export async function readMeta(
  projectName: string,
  runId: string
): Promise<HeadlessRunMeta | null> {
  try {
    const raw = await fs.readFile(getMetaPath(projectName, runId), "utf-8");
    return JSON.parse(raw) as HeadlessRunMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Append a parsed event to events.jsonl. The runner must call this before
 * notifying any in-memory subscribers — disk is the source of truth.
 */
export async function appendEvent(
  projectName: string,
  runId: string,
  event: unknown
): Promise<void> {
  await ensureRunDir(projectName, runId);
  const line = JSON.stringify(event) + "\n";
  await fs.appendFile(getEventsPath(projectName, runId), line, "utf-8");
}

/** Read every event from disk (used by the GET endpoint and as a baseline replay). */
export async function readAllEvents(
  projectName: string,
  runId: string
): Promise<unknown[]> {
  let raw: string;
  try {
    raw = await fs.readFile(getEventsPath(projectName, runId), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: unknown[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // Skip malformed lines rather than blowing up the whole replay.
    }
  }
  return out;
}

/** List runs for a project, newest first. Skips entries without meta.json. */
export async function listRuns(projectName: string): Promise<HeadlessRunMeta[]> {
  validateProject(projectName);
  const dir = path.join(ROOT, projectName);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const metas: HeadlessRunMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_RE.test(entry.name)) continue;
    const meta = await readMeta(projectName, entry.name);
    if (meta) metas.push(meta);
  }
  metas.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return metas;
}

/**
 * List runs belonging to a single Claude session, chronological (oldest first).
 * A session is identified by claudeSessionId — which the chat thread view
 * reads to aggregate a multi-turn conversation. Sort is the opposite of
 * listRuns (which goes newest first) so the chat timeline renders top-to-bottom.
 */
export async function listRunsBySession(
  projectName: string,
  sessionId: string
): Promise<HeadlessRunMeta[]> {
  const all = await listRuns(projectName);
  const filtered = all.filter((m) => m.claudeSessionId === sessionId);
  filtered.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return filtered;
}

/** Delete a run's directory entirely (used by the "Delete run" button). */
export async function deleteRun(projectName: string, runId: string): Promise<void> {
  const dir = getRunDir(projectName, runId);
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Mark stale `running` runs as orphaned. A run is orphaned when its recorded
 * pid no longer exists. Called from listRuns consumers and at server start.
 */
export function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Bytes on disk for events.jsonl — surfaced in the UI to spot bloat. */
export async function getEventsSize(
  projectName: string,
  runId: string
): Promise<number> {
  try {
    const stat = await fs.stat(getEventsPath(projectName, runId));
    return stat.size;
  } catch {
    return 0;
  }
}
