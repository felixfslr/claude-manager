import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const NAME_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;
const PROJECTS_DIR = "/home/felix/projects";

export function sanitizeName(name: string): string {
  if (!NAME_REGEX.test(name)) {
    throw new Error("Invalid project name: only alphanumeric, hyphens, and underscores allowed (max 50 chars)");
  }
  return name;
}

export function getProjectPath(name: string): string {
  const sanitized = sanitizeName(name);
  const resolved = path.resolve(PROJECTS_DIR, sanitized);
  if (!resolved.startsWith(PROJECTS_DIR + "/")) {
    throw new Error("Invalid project path");
  }
  return resolved;
}

export async function runCommand(
  cmd: string,
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: options?.cwd,
    timeout: options?.timeout ?? 10000,
    env: { ...process.env, HOME: "/home/felix" },
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export { PROJECTS_DIR };
