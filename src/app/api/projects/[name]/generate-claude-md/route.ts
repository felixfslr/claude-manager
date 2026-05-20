import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { generateClaudeMd } from "@/lib/templates";
import fs from "fs/promises";
import path from "path";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const content = await generateClaudeMd(name);
    const projectPath = getProjectPath(name);
    await fs.writeFile(path.join(projectPath, "CLAUDE.md"), content);
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}
