import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { listProjectDomains, addDomainToProject, removeDomainFromProject } from "@/lib/vercel";

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

    const domains = await listProjectDomains(vercelProjectId);
    return NextResponse.json(domains);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list domains" },
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

    const { domain } = await request.json();
    await addDomainToProject(vercelProjectId, domain);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add domain" },
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

    const { domain } = await request.json();
    await removeDomainFromProject(vercelProjectId, domain);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove domain" },
      { status: 400 }
    );
  }
}
