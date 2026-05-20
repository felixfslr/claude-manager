import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { getProjectPath } from "./shell";

const SKILLS_DIR = ".claude/skills";
const DIRNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const FILENAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

export interface SkillEntry {
  name: string;
  type: "folder" | "file";
  size: number;
  lastModified: string;
  hasSkillMd: boolean;
}

function validateName(name: string, label: string): void {
  if (!DIRNAME_REGEX.test(name) || name.length > 100 || name === "." || name === "..") {
    throw new Error(`Invalid ${label}: only alphanumeric, hyphens, underscores, dots (max 100 chars)`);
  }
}

function getSkillsDir(projectName: string): string {
  return path.join(getProjectPath(projectName), SKILLS_DIR);
}

export async function listSkills(projectName: string): Promise<SkillEntry[]> {
  const skillsDir = getSkillsDir(projectName);
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: SkillEntry[] = [];
    for (const entry of entries) {
      const fullPath = path.join(skillsDir, entry.name);
      const stat = await fs.stat(fullPath);
      if (entry.isDirectory()) {
        let hasSkillMd = false;
        try {
          await fs.access(path.join(fullPath, "SKILL.md"));
          hasSkillMd = true;
        } catch {
          // no SKILL.md
        }
        skills.push({
          name: entry.name,
          type: "folder",
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          hasSkillMd,
        });
      } else if (entry.isFile()) {
        skills.push({
          name: entry.name,
          type: "file",
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          hasSkillMd: false,
        });
      }
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function readSkillFile(
  projectName: string,
  skillName: string,
  fileName?: string
): Promise<string> {
  validateName(skillName, "skill name");
  const skillsDir = getSkillsDir(projectName);
  const target = fileName
    ? path.join(skillsDir, skillName, fileName)
    : path.join(skillsDir, skillName);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(skillsDir + "/")) {
    throw new Error("Invalid path");
  }
  return fs.readFile(resolved, "utf-8");
}

export async function writeSkillFile(
  projectName: string,
  skillName: string,
  content: string,
  fileName?: string
): Promise<void> {
  validateName(skillName, "skill name");
  const skillsDir = getSkillsDir(projectName);
  const targetDir = fileName
    ? path.join(skillsDir, skillName)
    : skillsDir;
  await fs.mkdir(targetDir, { recursive: true });
  const targetFile = fileName
    ? path.join(skillsDir, skillName, fileName)
    : path.join(skillsDir, skillName);
  const resolved = path.resolve(targetFile);
  if (!resolved.startsWith(skillsDir + "/")) {
    throw new Error("Invalid path");
  }
  await fs.writeFile(resolved, content);
}

export async function deleteSkill(
  projectName: string,
  skillName: string
): Promise<void> {
  validateName(skillName, "skill name");
  const skillsDir = getSkillsDir(projectName);
  const target = path.join(skillsDir, skillName);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(skillsDir + "/")) {
    throw new Error("Invalid path");
  }
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) {
    await fs.rm(resolved, { recursive: true, force: true });
  } else {
    await fs.unlink(resolved);
  }
}

export async function installSkillFromZip(
  projectName: string,
  zipBuffer: Buffer,
  originalName: string
): Promise<string> {
  const skillsDir = getSkillsDir(projectName);
  await fs.mkdir(skillsDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Determine if there's a single root folder
  const topLevelDirs = new Set<string>();
  for (const entry of entries) {
    const parts = entry.entryName.split("/");
    if (parts[0]) topLevelDirs.add(parts[0]);
  }

  let skillFolderName: string;

  if (topLevelDirs.size === 1) {
    // Zip has a single root folder — extract directly
    skillFolderName = [...topLevelDirs][0];
    const dest = path.join(skillsDir, skillFolderName);
    await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
    zip.extractAllTo(skillsDir, true);
  } else {
    // Flat contents — wrap in folder named after .skill file
    skillFolderName = originalName.replace(/\.skill$/i, "");
    validateName(skillFolderName, "skill name");
    const dest = path.join(skillsDir, skillFolderName);
    await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(dest, { recursive: true });
    zip.extractAllTo(dest, true);
  }

  return skillFolderName;
}
