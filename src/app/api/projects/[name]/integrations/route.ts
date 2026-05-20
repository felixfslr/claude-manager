import { NextRequest, NextResponse } from "next/server";
import { sanitizeName, getProjectPath } from "@/lib/shell";
import { getProjectMeta } from "@/lib/projects";
import { getVercelProject, listProjectDomains } from "@/lib/vercel";
import { getZone } from "@/lib/cloudflare";
import { getTunnelStatus } from "@/lib/tunnel";
import fs from "fs/promises";
import path from "path";

interface IntegrationDetail {
  connected: boolean;
  projectId?: string;
  projectName?: string;
  framework?: string | null;
  latestDeploymentUrl?: string;
  latestDeploymentState?: string;
  domains?: string[];
  region?: string;
  zoneId?: string;
  zoneName?: string;
  tunnelId?: string;
  tunnelStatus?: "running" | "stopped";
  tunnelDomain?: string;
  tunnelPort?: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const projectPath = getProjectPath(name);

    const integrations: Record<string, IntegrationDetail> = {
      vercel: { connected: false },
      supabase: { connected: false },
      cloudflare: { connected: false },
    };

    // Check file-based indicators
    try {
      await fs.access(path.join(projectPath, ".vercel", "project.json"));
      integrations.vercel.connected = true;
    } catch {
      // not found
    }

    try {
      await fs.access(path.join(projectPath, "supabase", "config.toml"));
      integrations.supabase.connected = true;
    } catch {
      // not found
    }

    // Check hosting config and fetch details
    try {
      const meta = await getProjectMeta(name);

      if (meta.hosting?.vercelProjectId) {
        integrations.vercel.connected = true;
        integrations.vercel.projectId = meta.hosting.vercelProjectId;

        // Fetch Vercel project details (non-blocking)
        try {
          const [project, domains] = await Promise.all([
            getVercelProject(meta.hosting.vercelProjectId),
            listProjectDomains(meta.hosting.vercelProjectId),
          ]);
          integrations.vercel.projectName = project.name;
          integrations.vercel.framework = project.framework;
          if (project.latestDeployment) {
            integrations.vercel.latestDeploymentUrl = project.latestDeployment.url;
            integrations.vercel.latestDeploymentState = project.latestDeployment.state;
          }
          integrations.vercel.domains = domains.map((d) => d.name);
        } catch {
          // Token missing or API error — still show as connected
        }
      }

      // Check Cloudflare: zone and/or tunnel
      if (meta.hosting?.cloudflareZoneId) {
        integrations.cloudflare.connected = true;
        integrations.cloudflare.zoneId = meta.hosting.cloudflareZoneId;

        try {
          const zone = await getZone(meta.hosting.cloudflareZoneId);
          integrations.cloudflare.zoneName = zone.name;
        } catch {
          // Token missing or API error
        }
      }

      // Check tunnel in both environments
      const prodEnv = meta.hosting?.environments?.production;
      const stagingEnv = meta.hosting?.environments?.staging;
      const tunnelId = prodEnv?.cloudflareTunnelId || stagingEnv?.cloudflareTunnelId;
      if (tunnelId) {
        integrations.cloudflare.connected = true;
        integrations.cloudflare.tunnelId = tunnelId;
        integrations.cloudflare.tunnelDomain = prodEnv?.domain || stagingEnv?.domain;
        integrations.cloudflare.tunnelPort = prodEnv?.localPort || stagingEnv?.localPort;

        try {
          integrations.cloudflare.tunnelStatus = await getTunnelStatus(name);
        } catch {
          integrations.cloudflare.tunnelStatus = "stopped";
        }
      }
    } catch {
      // ignore metadata read errors
    }

    return NextResponse.json(integrations);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check integrations" },
      { status: 400 }
    );
  }
}
