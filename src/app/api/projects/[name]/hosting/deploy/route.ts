import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { triggerDeployment } from "@/lib/vercel";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { environment } = (await request.json()) as {
      environment: "production" | "staging";
    };

    const meta = await getProjectMeta(name);
    const envConfig = meta.hosting?.environments?.[environment];
    const vercelProjectId = envConfig?.vercelProjectId || meta.hosting?.vercelProjectId;

    if (!vercelProjectId) {
      return NextResponse.json(
        { error: "No Vercel project linked" },
        { status: 400 }
      );
    }

    const target = environment === "production" ? "production" : "preview";
    const deployment = await triggerDeployment(vercelProjectId, target);

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deploy" },
      { status: 500 }
    );
  }
}
