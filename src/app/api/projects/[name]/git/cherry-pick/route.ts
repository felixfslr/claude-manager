import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { cherryPick } from "@/lib/git";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { hash } = await request.json();
    const result = await cherryPick(name, hash);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cherry-pick" },
      { status: 400 }
    );
  }
}
