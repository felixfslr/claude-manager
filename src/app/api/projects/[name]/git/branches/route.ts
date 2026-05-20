import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { listBranches, createBranch } from "@/lib/git";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const branches = await listBranches(name);
    return NextResponse.json(branches);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list branches" },
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
    const { branchName, startPoint } = await request.json();
    await createBranch(name, branchName, startPoint);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create branch" },
      { status: 400 }
    );
  }
}
