"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe,
  Rocket,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { VercelLinkDialog } from "./vercel-link-dialog";
import { DomainPickerDialog } from "./domain-picker-dialog";
import { EnvVarsEditor } from "./env-vars-editor";
import type { HostingConfig, VercelDeployment } from "@/lib/types";

interface HostingTabProps {
  projectName: string;
}

export function HostingTab({ projectName }: HostingTabProps) {
  const [hosting, setHosting] = useState<HostingConfig | null>(null);
  const [environment, setEnvironment] = useState<"production" | "staging">("production");
  const [deployments, setDeployments] = useState<VercelDeployment[]>([]);
  const [domains, setDomains] = useState<{ name: string }[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [tunnelStatus, setTunnelStatus] = useState<"running" | "stopped">("stopped");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVercelLink, setShowVercelLink] = useState(false);
  const [showDomainPicker, setShowDomainPicker] = useState(false);

  const fetchHosting = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/hosting`);
      if (res.ok) {
        const data = await res.json();
        setHosting(data);
        setError(null);
      }
    } catch {
      setError("Failed to load hosting config");
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/hosting/deployments`);
      if (res.ok) setDeployments(await res.json());
    } catch {
      // ignore
    }
  }, [projectName]);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/hosting/domains`);
      if (res.ok) setDomains(await res.json());
    } catch {
      // ignore
    }
  }, [projectName]);

  const fetchTunnelStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/hosting/tunnel`);
      if (res.ok) {
        const data = await res.json();
        setTunnelStatus(data.status);
      }
    } catch {
      // ignore
    }
  }, [projectName]);

  useEffect(() => {
    fetchHosting();
    fetchDeployments();
    fetchDomains();
    fetchTunnelStatus();
  }, [fetchHosting, fetchDeployments, fetchDomains, fetchTunnelStatus]);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ environment }),
        }
      );
      if (res.ok) {
        toast.success("Deployment triggered");
        fetchDeployments();
      } else {
        const data = await res.json();
        toast.error(data.error || "Deploy failed");
      }
    } catch {
      toast.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/domains`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        }
      );
      if (res.ok) {
        toast.success("Domain removed");
        fetchDomains();
      } else {
        toast.error("Failed to remove domain");
      }
    } catch {
      toast.error("Failed to remove domain");
    }
  };

  const handleStopTunnel = async () => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/tunnel`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Tunnel stopped");
        setTunnelStatus("stopped");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to stop tunnel");
      }
    } catch {
      toast.error("Failed to stop tunnel");
    }
  };

  const envConfig = hosting?.environments?.[environment];

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
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
    <div className="space-y-4">
      {/* Environment Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground mr-1">Environment</Label>
        <Button
          size="sm"
          variant={environment === "production" ? "default" : "outline"}
          onClick={() => setEnvironment("production")}
          className="text-xs"
        >
          Production
        </Button>
        <Button
          size="sm"
          variant={environment === "staging" ? "default" : "outline"}
          onClick={() => setEnvironment("staging")}
          className="text-xs"
        >
          Staging
        </Button>
      </div>

      {/* Vercel Project */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">▲</span>
            <Label className="text-sm font-medium">Vercel</Label>
          </div>
          {hosting?.vercelProjectId ? (
            <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
              Linked
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowVercelLink(true)} className="text-xs">
              Link Project
            </Button>
          )}
        </div>
        {hosting?.vercelProjectId && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleDeploy} disabled={deploying} className="text-xs">
              {deploying ? (
                <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
              ) : (
                <Rocket className="size-3" data-icon="inline-start" />
              )}
              Deploy {environment}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowVercelLink(true)}
              className="text-xs"
            >
              Change
            </Button>
          </div>
        )}
      </div>

      {/* Domains */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 text-muted-foreground" />
            <Label className="text-sm font-medium">Domains</Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDomainPicker(true)}
            className="text-xs"
          >
            <Plus className="size-3" data-icon="inline-start" />
            Add
          </Button>
        </div>
        {domains.length > 0 ? (
          <div className="space-y-1">
            {domains.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between text-sm rounded px-2 py-1 bg-muted"
              >
                <span className="font-mono text-xs">{d.name}</span>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://${d.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                  <button
                    onClick={() => handleRemoveDomain(d.name)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No domains assigned</p>
        )}
        {envConfig?.domain && (
          <p className="text-xs text-muted-foreground">
            Cloudflare domain: {envConfig.domain}
          </p>
        )}
      </div>

      {/* Deployments */}
      {deployments.length > 0 && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label className="text-sm font-medium">Recent Deployments</Label>
          <div className="space-y-1">
            {deployments.slice(0, 5).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-xs rounded px-2 py-1 bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      d.state === "READY"
                        ? "text-green-500 border-green-500/30"
                        : d.state === "ERROR"
                          ? "text-red-500 border-red-500/30"
                          : "text-amber-500 border-amber-500/30"
                    }`}
                  >
                    {d.state}
                  </Badge>
                  <span className="font-mono text-muted-foreground truncate max-w-[150px]">
                    {d.url}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tunnel */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔒</span>
            <Label className="text-sm font-medium">Cloudflare Tunnel</Label>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              tunnelStatus === "running"
                ? "text-green-500 border-green-500/30"
                : "text-muted-foreground"
            }`}
          >
            {tunnelStatus === "running" ? "Running" : "Stopped"}
          </Badge>
        </div>
        {tunnelStatus === "running" && (
          <div className="flex items-center gap-2">
            {envConfig?.localPort && (
              <span className="text-xs text-muted-foreground">
                Port: {envConfig.localPort}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleStopTunnel}
              className="text-xs ml-auto"
            >
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Environment Variables */}
      <EnvVarsEditor projectName={projectName} />

      {/* Dialogs */}
      <VercelLinkDialog
        open={showVercelLink}
        onOpenChange={setShowVercelLink}
        projectName={projectName}
        onLinked={() => {
          fetchHosting();
          fetchDeployments();
        }}
      />
      <DomainPickerDialog
        open={showDomainPicker}
        onOpenChange={setShowDomainPicker}
        projectName={projectName}
        onAdded={fetchDomains}
      />
    </div>
  );
}
