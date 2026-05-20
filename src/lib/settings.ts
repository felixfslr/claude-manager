import fs from "fs/promises";
import path from "path";
import type { AppSettings } from "./types";

const SETTINGS_DIR = path.join(process.env.HOME || "/home/felix", ".claude-manager");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

async function ensureDir(): Promise<void> {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  await ensureDir();
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export async function getToken(key: keyof AppSettings): Promise<string | undefined> {
  const settings = await getSettings();
  const value = settings[key];
  if (value) return value;

  // Fallback to env vars
  const envMap: Record<keyof AppSettings, string> = {
    vercelToken: "VERCEL_TOKEN",
    githubToken: "GITHUB_TOKEN",
    cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
    cloudflareAccountId: "CLOUDFLARE_ACCOUNT_ID",
    supabaseAccessToken: "SUPABASE_ACCESS_TOKEN",
    elevenlabsApiKey: "ELEVENLABS_API_KEY",
  };
  return process.env[envMap[key]];
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••" + token.slice(-4);
}
