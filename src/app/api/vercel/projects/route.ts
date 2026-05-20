import { NextResponse } from "next/server";
import { listVercelProjects } from "@/lib/vercel";

export async function GET() {
  try {
    const projects = await listVercelProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list Vercel projects" },
      { status: 500 }
    );
  }
}
