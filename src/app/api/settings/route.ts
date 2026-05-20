import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, maskToken } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

export async function GET() {
  try {
    const settings = await getSettings();
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value && typeof value === "string") {
        masked[key] = maskToken(value);
      }
    }
    return NextResponse.json({ settings: masked, configured: Object.keys(settings).filter((k) => !!settings[k as keyof AppSettings]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const allowedKeys: (keyof AppSettings)[] = [
      "vercelToken",
      "githubToken",
      "cloudflareApiToken",
      "supabaseAccessToken",
      "cloudflareAccountId",
      "elevenlabsApiKey",
    ];

    const updates: Partial<AppSettings> = {};
    for (const key of allowedKeys) {
      if (key in body && typeof body[key] === "string") {
        updates[key] = body[key] || undefined;
      }
    }

    const result = await updateSettings(updates);

    // Return masked version
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(result)) {
      if (value && typeof value === "string") {
        masked[key] = maskToken(value);
      }
    }
    return NextResponse.json({ settings: masked, configured: Object.keys(result).filter((k) => !!result[k as keyof AppSettings]) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 400 }
    );
  }
}
