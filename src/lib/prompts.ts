// Prompts library: per-project markdown files under <project.path>/prompts/.
// Strict filename validation + path-containment to prevent traversal.

import fs from "fs/promises";
import path from "path";
import { getProjectPath } from "./shell";

const FILENAME_RE = /^[A-Za-z0-9_\-.]+\.md$/;

export interface PromptFile {
  filename: string;
  title: string;
  modifiedAt: string;
  sizeBytes: number;
}

function validateFilename(filename: string): void {
  if (!FILENAME_RE.test(filename)) {
    throw new Error("Invalid prompt filename: only letters, digits, _, -, . allowed; must end in .md");
  }
}

function getPromptsDir(projectName: string): string {
  return path.join(getProjectPath(projectName), "prompts");
}

function getPromptPath(projectName: string, filename: string): string {
  validateFilename(filename);
  const dir = getPromptsDir(projectName);
  const target = path.resolve(dir, filename);
  if (!target.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error("Prompt path escapes the prompts directory");
  }
  return target;
}

/** Derive a human-readable title from the file body (first H1) or fall back to filename. */
function deriveTitle(filename: string, body: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return filename.replace(/\.md$/, "");
}

export async function listPrompts(projectName: string): Promise<PromptFile[]> {
  const dir = getPromptsDir(projectName);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: PromptFile[] = [];
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
  out.sort((a, b) => a.filename.localeCompare(b.filename));
  return out;
}

export async function readPrompt(projectName: string, filename: string): Promise<string> {
  const filePath = getPromptPath(projectName, filename);
  return fs.readFile(filePath, "utf-8");
}

export async function writePrompt(
  projectName: string,
  filename: string,
  content: string
): Promise<void> {
  const dir = getPromptsDir(projectName);
  await fs.mkdir(dir, { recursive: true });
  const filePath = getPromptPath(projectName, filename);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function deletePrompt(projectName: string, filename: string): Promise<void> {
  const filePath = getPromptPath(projectName, filename);
  await fs.unlink(filePath);
}
