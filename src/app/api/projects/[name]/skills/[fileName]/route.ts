import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { readSkillFile, writeSkillFile, deleteSkill } from "@/lib/skills";

type Params = { params: Promise<{ name: string; fileName: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { name, fileName } = await params;
    sanitizeName(name);
    const decoded = decodeURIComponent(fileName);
    // For folders, read SKILL.md; for files, read directly
    let content: string;
    try {
      content = await readSkillFile(name, decoded, "SKILL.md");
    } catch {
      content = await readSkillFile(name, decoded);
    }
    return NextResponse.json({ fileName: decoded, content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read skill" },
      { status: 404 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { name, fileName } = await params;
    sanitizeName(name);
    const decoded = decodeURIComponent(fileName);
    const { content } = await request.json();
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    // For folders, write to SKILL.md; for plain files, write directly
    try {
      await writeSkillFile(name, decoded, content, "SKILL.md");
    } catch {
      await writeSkillFile(name, decoded, content);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update skill" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { name, fileName } = await params;
    sanitizeName(name);
    const decoded = decodeURIComponent(fileName);
    await deleteSkill(name, decoded);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete skill" },
      { status: 400 }
    );
  }
}
