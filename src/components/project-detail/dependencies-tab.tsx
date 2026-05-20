"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, ArrowUp, Shield, Loader2 } from "lucide-react";
import type { DependencyInfo, AuditVulnerability } from "@/lib/types";

interface DependenciesTabProps {
  projectName: string;
}

export function DependenciesTab({ projectName }: DependenciesTabProps) {
  const [outdated, setOutdated] = useState<DependencyInfo[]>([]);
  const [audit, setAudit] = useState<AuditVulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/dependencies/${path}`,
    [projectName]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [outRes, auditRes] = await Promise.all([
        fetch(api("")),
        fetch(api("audit")),
      ]);
      if (outRes.ok) setOutdated(await outRes.json());
      if (auditRes.ok) setAudit(await auditRes.json());
      setError(null);
    } catch {
      setError("Failed to load dependency information");
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (pkg?: string) => {
    setUpdating(pkg || "__all__");
    try {
      const res = await fetch(api("update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pkg ? { name: pkg } : {}),
      });
      if (res.ok) {
        toast.success(pkg ? `Updated ${pkg}` : "All packages updated");
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || "Update failed");
      }
    } catch { toast.error("Update failed"); }
    finally { setUpdating(null); }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "text-red-500 border-red-500/30 bg-red-500/10";
      case "high": return "text-orange-500 border-orange-500/30 bg-orange-500/10";
      case "moderate": return "text-amber-500 border-amber-500/30 bg-amber-500/10";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
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
    <div className="space-y-6">
      {/* Outdated */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Outdated Packages</span>
            {outdated.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">{outdated.length}</Badge>
            )}
          </div>
          {outdated.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => handleUpdate()} disabled={!!updating} className="text-xs">
              {updating === "__all__" && <Loader2 className="size-3 animate-spin" data-icon="inline-start" />}
              Update All
            </Button>
          )}
        </div>

        {outdated.length === 0 ? (
          <p className="text-xs text-muted-foreground">All packages up to date</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 py-1.5 bg-muted text-[10px] font-medium text-muted-foreground uppercase">
              <span>Package</span>
              <span>Current</span>
              <span>Wanted</span>
              <span>Latest</span>
              <span></span>
            </div>
            {outdated.map((d) => (
              <div key={d.name} className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 px-3 py-1.5 text-xs border-t border-border items-center">
                <div>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground ml-1 text-[10px]">{d.type === "devDependencies" ? "dev" : ""}</span>
                </div>
                <span className="font-mono text-muted-foreground">{d.current}</span>
                <span className="font-mono text-amber-500">{d.wanted}</span>
                <span className="font-mono text-green-500">{d.latest}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUpdate(d.name)}
                  disabled={!!updating}
                  className="h-6 w-6 p-0"
                >
                  {updating === d.name ? <Loader2 className="size-3 animate-spin" /> : <ArrowUp className="size-3" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Security Audit</span>
          {audit.length > 0 && (
            <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">{audit.length}</Badge>
          )}
        </div>

        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No vulnerabilities found</p>
        ) : (
          <div className="space-y-1">
            {audit.map((v, i) => (
              <div key={`${v.name}-${i}`} className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs">
                <Badge variant="outline" className={`text-[10px] ${severityColor(v.severity)}`}>
                  {v.severity}
                </Badge>
                <span className="font-medium">{v.name}</span>
                <span className="flex-1 truncate text-muted-foreground">{v.title}</span>
                {v.fixAvailable && (
                  <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">fix available</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
