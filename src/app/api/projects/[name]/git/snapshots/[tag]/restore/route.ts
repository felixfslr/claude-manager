import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { restoreSnapshot } from "@/lib/git";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; tag: string }> }
) {
  try {
    const { name, tag } = await params;
    sanitizeName(name);
    await restoreSnapshot(name, decodeURIComponent(tag));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore snapshot" },
      { status: 400 }
    );
  }
}
