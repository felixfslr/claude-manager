import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { popStash, applyStash, dropStash } from "@/lib/git";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; index: string }> }
) {
  try {
    const { name, index: indexStr } = await params;
    sanitizeName(name);
    const idx = parseInt(indexStr);
    const { action } = await request.json();
    if (action === "pop") {
      await popStash(name, idx);
    } else if (action === "apply") {
      await applyStash(name, idx);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; index: string }> }
) {
  try {
    const { name, index: indexStr } = await params;
    sanitizeName(name);
    await dropStash(name, parseInt(indexStr));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to drop stash" },
      { status: 400 }
    );
  }
}
