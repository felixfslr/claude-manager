import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { listDeployments } from "@/lib/vercel";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    const meta = await getProjectMeta(name);
    const vercelProjectId = meta.hosting?.vercelProjectId;

    if (!vercelProjectId) {
      return NextResponse.json([]);
    }

    const deployments = await listDeployments(vercelProjectId);
    return NextResponse.json(deployments);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list deployments" },
      { status: 500 }
    );
  }
}
