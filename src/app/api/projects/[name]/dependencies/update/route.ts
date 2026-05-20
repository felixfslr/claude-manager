import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { updatePackage, updateAll } from "@/lib/dependencies";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: projectName } = await params;
    sanitizeName(projectName);
    const { name, version } = await request.json();
    const result = name
      ? await updatePackage(projectName, name, version)
      : await updateAll(projectName);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 400 }
    );
  }
}
