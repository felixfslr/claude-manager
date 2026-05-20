import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listSkills, writeSkillFile, installSkillFromZip } from "@/lib/skills";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const skills = await listSkills(name);
    return NextResponse.json(skills);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list skills" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // .skill files are ZIP archives — extract them
      if (file.name.endsWith(".skill")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const skillName = await installSkillFromZip(name, buffer, file.name);
        return NextResponse.json(
          { ok: true, skillName, extracted: true },
          { status: 201 }
        );
      }

      // Plain text files — write directly
      const content = await file.text();
      await writeSkillFile(name, file.name, content);
      return NextResponse.json({ ok: true, fileName: file.name }, { status: 201 });
    }

    // JSON body: create a skill folder with SKILL.md, or a plain file
    const { skillName, fileName, content } = await request.json();
    if (!content && typeof content !== "string") {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    if (skillName) {
      // Create a skill folder with SKILL.md
      await writeSkillFile(name, skillName, content, fileName || "SKILL.md");
      return NextResponse.json({ ok: true, skillName }, { status: 201 });
    }

    if (fileName) {
      await writeSkillFile(name, fileName, content);
      return NextResponse.json({ ok: true, fileName }, { status: 201 });
    }

    return NextResponse.json(
      { error: "skillName or fileName is required" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create skill" },
      { status: 400 }
    );
  }
}
