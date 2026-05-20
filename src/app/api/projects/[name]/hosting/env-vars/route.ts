import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { listEnvVars, setEnvVar, deleteEnvVar } from "@/lib/vercel";

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

    const vars = await listEnvVars(vercelProjectId);
    return NextResponse.json(vars);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list env vars" },
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

    const meta = await getProjectMeta(name);
    const vercelProjectId = meta.hosting?.vercelProjectId;

    if (!vercelProjectId) {
      return NextResponse.json({ error: "No Vercel project linked" }, { status: 400 });
    }

    const { key, value, targets } = await request.json();
    await setEnvVar(vercelProjectId, key, value, targets);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set env var" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    const meta = await getProjectMeta(name);
    const vercelProjectId = meta.hosting?.vercelProjectId;

    if (!vercelProjectId) {
      return NextResponse.json({ error: "No Vercel project linked" }, { status: 400 });
    }

    const { envId } = await request.json();
    await deleteEnvVar(vercelProjectId, envId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete env var" },
      { status: 400 }
    );
  }
}
