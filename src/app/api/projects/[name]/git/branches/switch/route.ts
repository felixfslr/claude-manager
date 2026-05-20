import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { switchBranch } from "@/lib/git";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { branch } = await request.json();
    await switchBranch(name, branch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to switch branch" },
      { status: 400 }
    );
  }
}
