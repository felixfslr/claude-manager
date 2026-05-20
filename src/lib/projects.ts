import fs from "fs/promises";
import path from "path";
import { PROJECTS_DIR, runCommand, getProjectPath } from "./shell";
import { scaffoldProject } from "./scaffold";
import type { Project, StackConfig, HostingConfig } from "./types";

const METADATA_FILE = path.join(PROJECTS_DIR, ".metadata.json");
const EXCLUDED: string[] = [];

interface ProjectMeta {
  description?: string;
  autoAccept?: boolean;
  stack?: StackConfig;
  hosting?: HostingConfig;
}

interface Metadata {
  [projectName: string]: ProjectMeta;
}

async function readMetadata(): Promise<Metadata> {
  try {
    const data = await fs.readFile(METADATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeMetadata(metadata: Metadata): Promise<void> {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

async function getGitRemote(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await runCommand("git remote get-url origin 2>/dev/null", {
      cwd: projectPath,
    });
    return stdout || null;
  } catch {
    return null;
  }
}

async function getCurrentBranch(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await runCommand("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
      cwd: projectPath,
    });
    return stdout || null;
  } catch {
    return null;
  }
}

async function getLastActivity(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await runCommand(
      'git log -1 --format="%aI" 2>/dev/null',
      { cwd: projectPath }
    );
    return stdout || null;
  } catch {
    return null;
  }
}

export async function discoverProjects(): Promise<Project[]> {
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const metadata = await readMetadata();

  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || EXCLUDED.includes(entry.name) || entry.name.startsWith(".")) {
      continue;
    }
    const projectPath = path.join(PROJECTS_DIR, entry.name);
    const [gitRemote, currentBranch, lastActivity] = await Promise.all([
      getGitRemote(projectPath),
      getCurrentBranch(projectPath),
      getLastActivity(projectPath),
    ]);
    projects.push({
      name: entry.name,
      path: projectPath,
      gitRemote,
      description: metadata[entry.name]?.description,
      currentBranch: currentBranch ?? undefined,
      lastActivity: lastActivity ?? undefined,
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProject(
  name: string,
  gitCloneUrl?: string,
  stack?: StackConfig,
  branch?: string,
  useLatestDependencies: boolean = true
): Promise<Project> {
  const projectPath = getProjectPath(name);

  if (gitCloneUrl) {
    const branchFlag = branch ? ` -b "${branch}"` : "";
    await runCommand(`git clone${branchFlag} "${gitCloneUrl}" "${projectPath}"`, {
      timeout: 60000,
    });
  } else if (stack && stack.framework !== "none") {
    await scaffoldProject(projectPath, name, stack, useLatestDependencies);
    // Save stack config to metadata
    await updateProjectMeta(name, { stack });
  } else {
    await fs.mkdir(projectPath, { recursive: true });
  }

  const gitRemote = gitCloneUrl || null;
  return { name, path: projectPath, gitRemote };
}

export async function getProjectMeta(name: string): Promise<ProjectMeta> {
  const metadata = await readMetadata();
  return metadata[name] ?? {};
}

export async function updateProjectMeta(
  name: string,
  updates: Partial<ProjectMeta>
): Promise<void> {
  const metadata = await readMetadata();
  metadata[name] = { ...metadata[name], ...updates };
  await writeMetadata(metadata);
}

export async function deleteProject(name: string): Promise<void> {
  const projectPath = getProjectPath(name);
  // Verify the directory exists
  await fs.access(projectPath);
  await fs.rm(projectPath, { recursive: true, force: true });

  // Clean up metadata
  const metadata = await readMetadata();
  delete metadata[name];
  await writeMetadata(metadata);
}
