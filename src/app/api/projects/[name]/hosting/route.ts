import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta, updateProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import type { HostingConfig } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const meta = await getProjectMeta(name);
    return NextResponse.json(meta.hosting ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get hosting config" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const hosting: HostingConfig = await request.json();
    await updateProjectMeta(name, { hosting });
    return NextResponse.json(hosting);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update hosting config" },
      { status: 400 }
    );
  }
}
