"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { QRCodeDisplay } from "@/components/qr-code";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import type { Project, SessionStatus } from "@/lib/types";
import { SessionManager } from "@/components/session-manager";
import { EnvManagerSection } from "./env-manager-section";
import { SkillFilesSection } from "./skill-files-section";
import { Copy, Check, ExternalLink, ShieldOff } from "lucide-react";

interface OverviewTabProps {
  project: Project;
  session: SessionStatus | undefined;
}

export function OverviewTab({ project, session }: OverviewTabProps) {
  const [copied, setCopied] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [hasVercel, setHasVercel] = useState(false);
  const state = session?.state ?? "stopped";
  const bridgeUrl = session?.bridgeUrl ?? null;

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.name)}`);
      if (res.ok) {
        const meta = await res.json();
        setAutoAccept(!!meta.autoAccept);
        setHasVercel(!!meta.hosting?.vercelProjectId);
      }
    } catch {
      // ignore
    }
  }, [project.name]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const toggleAutoAccept = async (checked: boolean) => {
    setAutoAccept(checked);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAccept: checked }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        checked
          ? "Auto-accept enabled — takes effect on next session start"
          : "Auto-accept disabled"
      );
    } catch {
      setAutoAccept(!checked);
      toast.error("Failed to save setting");
    }
  };

  const copyUrl = async () => {
    if (bridgeUrl) {
      await navigator.clipboard.writeText(bridgeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="rounded-lg border border-border p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Session Status</p>
          <StatusBadge state={state} />
        </div>
      </div>

      {/* Sessions */}
      <div className="rounded-lg border border-border p-4">
        <SessionManager projectName={project.name} />
      </div>

      {/* Bridge URL */}
      {bridgeUrl && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Bridge URL</p>
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono truncate border border-border">
                  {bridgeUrl}
                </code>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <a
                  href={bridgeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="icon-xs" variant="ghost">
                    <ExternalLink className="size-3.5" />
                  </Button>
                </a>
              </div>
            </div>
            <QRCodeDisplay value={bridgeUrl} size={80} />
          </div>
        </div>
      )}

      {/* Auto-Accept */}
      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldOff className="size-4 text-muted-foreground" />
            <Label htmlFor="auto-accept" className="text-sm font-medium cursor-pointer">
              Auto-Accept
            </Label>
          </div>
          <Switch
            id="auto-accept"
            checked={autoAccept}
            onCheckedChange={toggleAutoAccept}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Automatically approve all tool calls without confirmation.
          Takes effect on the next session (re)start.
        </p>
      </div>

      {/* Env Manager */}
      <EnvManagerSection projectName={project.name} hasVercel={hasVercel} />

      {/* Skill Files */}
      <SkillFilesSection projectName={project.name} />

      {/* Terminal hint */}
      {state !== "stopped" && (
        <p className="text-xs text-muted-foreground">
          Use the Terminal tab for live interaction
        </p>
      )}
    </div>
  );
}
