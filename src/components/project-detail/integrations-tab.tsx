"use client";
import { useEffect, useState } from "react";
import { Check, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

interface IntegrationsTabProps {
  projectName: string;
}

const integrationsMeta = [
  {
    key: "vercel",
    name: "Vercel",
    description: "Deployment and hosting",
    icon: "▲",
  },
  {
    key: "supabase",
    name: "Supabase",
    description: "Database and auth",
    icon: "⚡",
  },
  {
    key: "cloudflare",
    name: "Cloudflare",
    description: "DNS and tunnels",
    icon: "🔶",
  },
];

function IntegrationDetails({ detail }: { detail: IntegrationDetail }) {
  if (!detail.connected) return null;

  const items: { label: string; value: string; href?: string }[] = [];

  if (detail.projectName) {
    items.push({ label: "Project", value: detail.projectName });
  }
  if (detail.projectId) {
    items.push({ label: "ID", value: detail.projectId });
  }
  if (detail.framework) {
    items.push({ label: "Framework", value: detail.framework });
  }
  if (detail.region) {
    items.push({ label: "Region", value: detail.region });
  }
  if (detail.zoneName) {
    items.push({ label: "Zone", value: detail.zoneName });
  }
  if (detail.latestDeploymentUrl) {
    items.push({
      label: "Latest deploy",
      value: detail.latestDeploymentUrl,
      href: `https://${detail.latestDeploymentUrl}`,
    });
  }
  if (detail.domains && detail.domains.length > 0) {
    items.push({ label: "Domains", value: detail.domains.join(", ") });
  }
  if (detail.tunnelId) {
    items.push({ label: "Tunnel", value: detail.tunnelId });
  }
  if (detail.tunnelDomain) {
    items.push({
      label: "Tunnel domain",
      value: detail.tunnelDomain,
      href: `https://${detail.tunnelDomain}`,
    });
  }
  if (detail.tunnelPort) {
    items.push({ label: "Local port", value: String(detail.tunnelPort) });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-t border-border pt-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-[80px]">{item.label}</span>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-foreground hover:underline flex items-center gap-1 truncate"
            >
              {item.value}
              <ExternalLink className="size-2.5 shrink-0" />
            </a>
          ) : (
            <span className="font-mono text-foreground truncate">{item.value}</span>
          )}
        </div>
      ))}
      {detail.latestDeploymentState && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-[80px]">Deploy</span>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              detail.latestDeploymentState === "READY"
                ? "text-green-500 border-green-500/30"
                : detail.latestDeploymentState === "ERROR"
                  ? "text-red-500 border-red-500/30"
                  : "text-amber-500 border-amber-500/30"
            }`}
          >
            {detail.latestDeploymentState}
          </Badge>
        </div>
      )}
      {detail.tunnelStatus && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground min-w-[80px]">Tunnel</span>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              detail.tunnelStatus === "running"
                ? "text-green-500 border-green-500/30"
                : "text-muted-foreground"
            }`}
          >
            {detail.tunnelStatus === "running" ? "Running" : "Stopped"}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function IntegrationsTab({ projectName }: IntegrationsTabProps) {
  const [data, setData] = useState<Record<string, IntegrationDetail> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectName)}/integrations`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch(() => setError("Failed to load integrations"))
      .finally(() => setLoading(false));
  }, [projectName]);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {integrationsMeta.map((int) => {
        const detail = data?.[int.key];
        const connected = detail?.connected ?? false;
        return (
          <div
            key={int.key}
            className={`rounded-md border border-border p-3 ${connected ? "border-l-2 border-l-green-500" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-8 items-center justify-center rounded-md text-sm ${connected ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                {int.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{int.name}</p>
                <p className="text-xs text-muted-foreground">{int.description}</p>
              </div>
              {connected ? (
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <Check className="size-3.5" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <X className="size-3.5" />
                  Not connected
                </div>
              )}
            </div>
            {detail && <IntegrationDetails detail={detail} />}
          </div>
        );
      })}
    </div>
  );
}
