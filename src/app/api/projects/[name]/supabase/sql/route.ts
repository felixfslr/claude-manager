import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { getProjectMeta } from "@/lib/projects";
import { executeSql } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { query, projectRef } = await request.json();
    if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });
    if (!projectRef) return NextResponse.json({ error: "Project ref required" }, { status: 400 });
    const result = await executeSql(projectRef, query);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SQL execution failed" },
      { status: 400 }
    );
  }
}
