import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listStashes, stashChanges } from "@/lib/git";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const stashes = await listStashes(name);
    return NextResponse.json(stashes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list stashes" },
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
    const { message } = await request.json();
    await stashChanges(name, message);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stash" },
      { status: 400 }
    );
  }
}
