import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { readProjectPlan, writeProjectPlan, deleteProjectPlan } from "@/lib/plans";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; file: string }> }
) {
  try {
    const { name, file } = await params;
    sanitizeName(name);
    const filename = decodeURIComponent(file);
    const content = await readProjectPlan(name, filename);
    return NextResponse.json({ filename, content });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to read plan";
    const status = msg.includes("ENOENT") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; file: string }> }
) {
  try {
    const { name, file } = await params;
    sanitizeName(name);
    const filename = decodeURIComponent(file);
    const body = (await request.json()) as { content?: string };
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    await writeProjectPlan(name, filename, body.content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write plan" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; file: string }> }
) {
  try {
    const { name, file } = await params;
    sanitizeName(name);
    const filename = decodeURIComponent(file);
    await deleteProjectPlan(name, filename);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete plan" },
      { status: 400 }
    );
  }
}
