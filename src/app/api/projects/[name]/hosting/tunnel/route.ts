import { NextRequest, NextResponse } from "next/server";
import { getProjectMeta, updateProjectMeta } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { startTunnel, stopTunnel, getTunnelStatus } from "@/lib/tunnel";
import { createTunnel, deleteTunnel, getTunnelToken } from "@/lib/cloudflare";
import { createDnsRecord } from "@/lib/cloudflare";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const status = await getTunnelStatus(name);
    const meta = await getProjectMeta(name);
    return NextResponse.json({
      status,
      tunnelId: meta.hosting?.environments?.production?.cloudflareTunnelId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tunnel status" },
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

    const { port, domain, environment = "production" } = (await request.json()) as {
      port: number;
      domain?: string;
      environment?: "production" | "staging";
    };

    const meta = await getProjectMeta(name);
    let tunnelId = meta.hosting?.environments?.[environment]?.cloudflareTunnelId;
    let tunnelToken: string;

    if (tunnelId) {
      // Reuse existing tunnel
      tunnelToken = await getTunnelToken(tunnelId);
    } else {
      // Create new tunnel
      const result = await createTunnel(`${name}-${environment}`);
      tunnelId = result.tunnel.id;
      tunnelToken = result.token;

      // Save tunnel ID to metadata
      const hosting = meta.hosting ?? {
        environments: {
          production: { envVars: {}, deploymentTarget: "local" },
          staging: { envVars: {}, deploymentTarget: "local" },
        },
      };
      hosting.environments[environment].cloudflareTunnelId = tunnelId;
      hosting.environments[environment].localPort = port;
      if (domain) hosting.environments[environment].domain = domain;
      await updateProjectMeta(name, { hosting });

      // Create DNS record if domain and zone are specified
      if (domain && hosting.cloudflareZoneId) {
        try {
          await createDnsRecord(hosting.cloudflareZoneId, {
            type: "CNAME",
            name: domain,
            content: `${tunnelId}.cfargotunnel.com`,
            proxied: true,
          });
        } catch {
          // DNS record might already exist
        }
      }
    }

    await startTunnel(name, port, tunnelToken);

    return NextResponse.json({ ok: true, tunnelId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start tunnel" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    // Stop the tunnel process
    await stopTunnel(name);

    // Optionally clean up the tunnel from Cloudflare
    const meta = await getProjectMeta(name);
    const tunnelId = meta.hosting?.environments?.production?.cloudflareTunnelId;
    if (tunnelId) {
      try {
        await deleteTunnel(tunnelId);
      } catch {
        // ignore cleanup errors
      }

      // Remove from metadata
      if (meta.hosting) {
        meta.hosting.environments.production.cloudflareTunnelId = undefined;
        await updateProjectMeta(name, { hosting: meta.hosting });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stop tunnel" },
      { status: 500 }
    );
  }
}
