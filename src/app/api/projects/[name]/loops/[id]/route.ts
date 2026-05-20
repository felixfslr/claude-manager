import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getLoop, saveLoop, deleteLoop, listLoopRuns } from "@/lib/loops";
import type { LoopPhase } from "@/lib/headless-types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    sanitizeName(name);
    const loop = await getLoop(name, id);
    if (!loop) {
      return NextResponse.json({ error: "loop not found" }, { status: 404 });
    }
    const runs = await listLoopRuns(name, id);
    return NextResponse.json({ loop, runs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read loop" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    sanitizeName(name);
    const existing = await getLoop(name, id);
    if (!existing) {
      return NextResponse.json({ error: "loop not found" }, { status: 404 });
    }
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      phases?: LoopPhase[];
    };
    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      phases: Array.isArray(body.phases) ? body.phases : existing.phases,
      updatedAt: new Date().toISOString(),
    };
    await saveLoop(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update loop" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    sanitizeName(name);
    await deleteLoop(name, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete loop" },
      { status: 400 }
    );
  }
}
