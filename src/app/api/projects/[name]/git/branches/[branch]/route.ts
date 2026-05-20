import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { deleteBranch } from "@/lib/git";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; branch: string }> }
) {
  try {
    const { name, branch } = await params;
    sanitizeName(name);
    await deleteBranch(name, decodeURIComponent(branch));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete branch" },
      { status: 400 }
    );
  }
}
