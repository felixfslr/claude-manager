import fs from "fs/promises";
import path from "path";
import { runCommand, getProjectPath } from "./shell";
import { PRESET_TEMPLATES } from "./template-presets";
import type { ProjectTemplate } from "./types";

const TEMPLATES_DIR = path.join(process.env.HOME || "/home/felix", ".claude-manager");
const TEMPLATES_FILE = path.join(TEMPLATES_DIR, "templates.json");

async function readUserTemplates(): Promise<ProjectTemplate[]> {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function listTemplates(): Promise<ProjectTemplate[]> {
  const user = await readUserTemplates();
  return [...PRESET_TEMPLATES, ...user];
}

export async function saveTemplate(template: ProjectTemplate): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  const existing = await readUserTemplates();
  const idx = existing.findIndex((t) => t.id === template.id);
  if (idx >= 0) existing[idx] = template;
  else existing.push(template);
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(existing, null, 2));
}

export async function generateClaudeMd(name: string): Promise<string> {
  const projectPath = getProjectPath(name);
  let content = "# Project: " + name + "\n\n";

  // Detect framework from package.json
  try {
    const pkgJson = JSON.parse(await fs.readFile(path.join(projectPath, "package.json"), "utf-8"));
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    if (deps.next) content += "## Framework\nNext.js application\n\n";
    else if (deps.react) content += "## Framework\nReact application\n\n";
    else if (deps.vue) content += "## Framework\nVue application\n\n";
    else if (deps.express) content += "## Framework\nExpress server\n\n";

    if (deps.tailwindcss) content += "- Uses Tailwind CSS for styling\n";
    if (deps.typescript) content += "- Written in TypeScript\n";
    if (deps.prisma) content += "- Uses Prisma ORM\n";
    if (deps.supabase || deps["@supabase/supabase-js"]) content += "- Uses Supabase\n";

    content += "\n## Commands\n";
    if (pkgJson.scripts) {
      for (const [script, cmd] of Object.entries(pkgJson.scripts)) {
        content += `- \`npm run ${script}\` — ${cmd}\n`;
      }
    }
  } catch {
    // No package.json
  }

  // Check for Python project
  try {
    await fs.access(path.join(projectPath, "requirements.txt"));
    const reqs = await fs.readFile(path.join(projectPath, "requirements.txt"), "utf-8");
    content += "## Python Project\n\n";
    if (reqs.includes("fastapi")) content += "- FastAPI application\n";
    if (reqs.includes("flask")) content += "- Flask application\n";
    content += "\n## Setup\n```bash\npython3 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\n```\n";
  } catch {}

  // Get file structure
  try {
    const { stdout } = await runCommand("find . -maxdepth 2 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/venv/*' | head -30", {
      cwd: projectPath,
      timeout: 5000,
    });
    if (stdout) {
      content += "\n## Key Files\n```\n" + stdout + "\n```\n";
    }
  } catch {}

  return content;
}
