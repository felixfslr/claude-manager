import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getProjectMeta } from "@/lib/projects";
import { listTables } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const meta = await getProjectMeta(name);
    const projectRef = meta.hosting?.environments?.production?.vercelProjectId; // TODO: store supabase ref separately
    if (!projectRef) return NextResponse.json({ error: "No Supabase project linked" }, { status: 400 });
    const tables = await listTables(projectRef);
    return NextResponse.json(tables);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
