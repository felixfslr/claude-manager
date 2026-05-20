// Plans library: markdown files that live in two places.
//   - Global:  ~/.claude/plans/*.md (where the Claude Code harness writes plans)
//   - Project: <project.path>/plans/*.md (per-project saved plans)
//
// Strict filename validation + path-containment to prevent traversal, mirrors
// the prompts library in `src/lib/prompts.ts`.

import fs from "fs/promises";
import path from "path";
import os from "os";
import { getProjectPath } from "./shell";

const FILENAME_RE = /^[A-Za-z0-9_\-.]+\.md$/;

export interface PlanFile {
  filename: string;
  title: string;
  modifiedAt: string;
  sizeBytes: number;
}

function validateFilename(filename: string): void {
  if (!FILENAME_RE.test(filename)) {
    throw new Error("Invalid plan filename: only letters, digits, _, -, . allowed; must end in .md");
  }
}

function getGlobalPlansDir(): string {
  return path.join(os.homedir(), ".claude", "plans");
}

function getProjectPlansDir(projectName: string): string {
  return path.join(getProjectPath(projectName), "plans");
}

function resolveInside(dir: string, filename: string): string {
  validateFilename(filename);
  const target = path.resolve(dir, filename);
  if (!target.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error("Plan path escapes the plans directory");
  }
  return target;
}

function deriveTitle(filename: string, body: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return filename.replace(/\.md$/, "");
}

async function listInDir(dir: string): Promise<PlanFile[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: PlanFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!FILENAME_RE.test(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const [stat, body] = await Promise.all([
      fs.stat(filePath),
      fs.readFile(filePath, "utf-8").catch(() => ""),
    ]);
    out.push({
      filename: entry.name,
      title: deriveTitle(entry.name, body),
      modifiedAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    });
  }
  // Newest first — plans are much more time-sensitive than prompts.
  out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return out;
}

// ----- Global plans --------------------------------------------------------

export async function listGlobalPlans(): Promise<PlanFile[]> {
  return listInDir(getGlobalPlansDir());
}

export async function readGlobalPlan(filename: string): Promise<string> {
  const filePath = resolveInside(getGlobalPlansDir(), filename);
  return fs.readFile(filePath, "utf-8");
}

export async function writeGlobalPlan(filename: string, content: string): Promise<void> {
  const dir = getGlobalPlansDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = resolveInside(dir, filename);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function deleteGlobalPlan(filename: string): Promise<void> {
  const filePath = resolveInside(getGlobalPlansDir(), filename);
  await fs.unlink(filePath);
}

// ----- Project plans -------------------------------------------------------

export async function listProjectPlans(projectName: string): Promise<PlanFile[]> {
  return listInDir(getProjectPlansDir(projectName));
}

export async function readProjectPlan(projectName: string, filename: string): Promise<string> {
  const filePath = resolveInside(getProjectPlansDir(projectName), filename);
  return fs.readFile(filePath, "utf-8");
}

export async function writeProjectPlan(
  projectName: string,
  filename: string,
  content: string
): Promise<void> {
  const dir = getProjectPlansDir(projectName);
  await fs.mkdir(dir, { recursive: true });
  const filePath = resolveInside(dir, filename);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function deleteProjectPlan(projectName: string, filename: string): Promise<void> {
  const filePath = resolveInside(getProjectPlansDir(projectName), filename);
  await fs.unlink(filePath);
}
