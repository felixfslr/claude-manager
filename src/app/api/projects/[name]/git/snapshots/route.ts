import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listSnapshots, createSnapshot } from "@/lib/git";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const snapshots = await listSnapshots(name);
    return NextResponse.json(snapshots);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list snapshots" },
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
    const { description } = await request.json();
    const tag = await createSnapshot(name, description || "Manual snapshot");
    return NextResponse.json({ ok: true, tag }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create snapshot" },
      { status: 400 }
    );
  }
}
