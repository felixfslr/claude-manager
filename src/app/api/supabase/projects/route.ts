import { NextResponse } from "next/server";
import { listSupabaseProjects } from "@/lib/supabase";

export async function GET() {
  try {
    const projects = await listSupabaseProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
