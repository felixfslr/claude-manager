import { NextResponse } from "next/server";
import { discoverProjects } from "@/lib/projects";
import { getAllSessionStatuses } from "@/lib/tmux";

export async function GET() {
  try {
    const projects = await discoverProjects();
    const projectNames = projects.map((p) => p.name);
    const statuses = await getAllSessionStatuses(projectNames);
    return NextResponse.json(statuses);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get session statuses" },
      { status: 500 }
    );
  }
}
