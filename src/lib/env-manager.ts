import fs from "fs/promises";
import path from "path";
import { getProjectPath } from "./shell";
import { getToken } from "./settings";
import { listEnvVars, setEnvVar } from "./vercel";
import { getProjectMeta } from "./projects";

const ENV_FILES: Record<string, string> = {
  dev: ".env",
  staging: ".env.staging",
  prod: ".env.production",
};

export async function readEnvFile(
  name: string,
  env: string
): Promise<Record<string, string>> {
  const projectPath = getProjectPath(name);
  const fileName = ENV_FILES[env] || `.env.${env}`;
  try {
    const content = await fs.readFile(path.join(projectPath, fileName), "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      }
    }
    return vars;
  } catch {
    return {};
  }
}

export async function writeEnvFile(
  name: string,
  env: string,
  vars: Record<string, string>
): Promise<void> {
  const projectPath = getProjectPath(name);
  const fileName = ENV_FILES[env] || `.env.${env}`;
  const content = Object.entries(vars)
    .map(([key, value]) => {
      const needsQuotes = value.includes(" ") || value.includes("#") || value.includes("=");
      return `${key}=${needsQuotes ? `"${value}"` : value}`;
    })
    .join("\n") + "\n";
  await fs.writeFile(path.join(projectPath, fileName), content);
}

export async function syncToVercel(
  name: string,
  env: string
): Promise<{ synced: number }> {
  const vars = await readEnvFile(name, env);
  const meta = await getProjectMeta(name);
  const vercelProjectId = meta.hosting?.vercelProjectId;
  if (!vercelProjectId) throw new Error("No Vercel project linked");

  const token = await getToken("vercelToken");
  if (!token) throw new Error("Vercel token not configured");

  let synced = 0;
  const targetMap: Record<string, string[]> = {
    dev: ["development"],
    staging: ["preview"],
    prod: ["production"],
  };
  const targets = targetMap[env] || ["production"];

  for (const [key, value] of Object.entries(vars)) {
    try {
      await setEnvVar(vercelProjectId, key, value, targets);
      synced++;
    } catch {
      // might already exist, continue
    }
  }
  return { synced };
}
