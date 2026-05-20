import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getProjectMeta, updateProjectMeta } from "@/lib/projects";
import { stopSession, listTmuxSessions } from "@/lib/tmux";
import { sanitizeName } from "@/lib/shell";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const meta = await getProjectMeta(name);
    return NextResponse.json(meta);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get project" },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const body = await request.json();
    await updateProjectMeta(name, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    // Stop any running session first
    const sessions = await listTmuxSessions();
    if (sessions.includes(`claude-${name}`)) {
      await stopSession(name);
    }

    await deleteProject(name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 400 }
    );
  }
}
