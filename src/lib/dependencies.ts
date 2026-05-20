import fs from "fs/promises";
import path from "path";
import { runCommand, getProjectPath } from "./shell";
import type { DependencyInfo, AuditVulnerability } from "./types";

export async function detectPackageManager(name: string): Promise<"npm" | "yarn" | "pnpm" | "bun"> {
  const projectPath = getProjectPath(name);
  try { await fs.access(path.join(projectPath, "bun.lockb")); return "bun"; } catch {}
  try { await fs.access(path.join(projectPath, "pnpm-lock.yaml")); return "pnpm"; } catch {}
  try { await fs.access(path.join(projectPath, "yarn.lock")); return "yarn"; } catch {}
  return "npm";
}

export async function getOutdated(name: string): Promise<DependencyInfo[]> {
  const projectPath = getProjectPath(name);
  try {
    const { stdout } = await runCommand("npm outdated --json 2>/dev/null || true", {
      cwd: projectPath,
      timeout: 30000,
    });
    if (!stdout.trim() || stdout.trim() === "{}") return [];
    const data = JSON.parse(stdout);
    return Object.entries(data).map(([pkg, info]: [string, unknown]) => {
      const i = info as Record<string, string>;
      return {
        name: pkg,
        current: i.current || "",
        wanted: i.wanted || "",
        latest: i.latest || "",
        type: i.type === "devDependencies" ? "devDependencies" as const : "dependencies" as const,
      };
    });
  } catch {
    return [];
  }
}

export async function getAuditReport(name: string): Promise<AuditVulnerability[]> {
  const projectPath = getProjectPath(name);
  try {
    const { stdout } = await runCommand("npm audit --json 2>/dev/null || true", {
      cwd: projectPath,
      timeout: 30000,
    });
    if (!stdout.trim()) return [];
    const data = JSON.parse(stdout);
    const vulns: AuditVulnerability[] = [];
    const advisories = data.vulnerabilities || data.advisories || {};
    for (const [pkg, info] of Object.entries(advisories)) {
      const i = info as Record<string, unknown>;
      vulns.push({
        name: pkg,
        severity: (i.severity as AuditVulnerability["severity"]) || "low",
        title: (i.title as string) || (i.name as string) || pkg,
        fixAvailable: !!(i.fixAvailable),
      });
    }
    return vulns;
  } catch {
    return [];
  }
}

export async function updatePackage(name: string, pkg: string, version?: string): Promise<string> {
  const projectPath = getProjectPath(name);
  const target = version ? `${pkg}@${version}` : `${pkg}@latest`;
  const { stdout } = await runCommand(`npm install ${target}`, {
    cwd: projectPath,
    timeout: 60000,
  });
  return stdout;
}

export async function updateAll(name: string): Promise<string> {
  const projectPath = getProjectPath(name);
  const { stdout } = await runCommand("npm update", {
    cwd: projectPath,
    timeout: 60000,
  });
  return stdout;
}
