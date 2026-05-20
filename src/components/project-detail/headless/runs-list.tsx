"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HeadlessRunMeta } from "@/lib/headless-types";
import { StatusPill, PermissionBadge, formatCost, formatBytes, formatTokens } from "./run-bits";

interface RunsListProps {
  projectName: string;
}

export function RunsList({ projectName }: RunsListProps) {
  const [runs, setRuns] = useState<HeadlessRunMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/headless`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = (await res.json()) as HeadlessRunMeta[];
      setRuns(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, [projectName]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  if (runs === null && !error) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No headless runs yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{runs.length} run{runs.length === 1 ? "" : "s"}</p>
        <Button size="xs" variant="ghost" onClick={refresh}>
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {runs.map((run) => (
          <Link
            key={run.runId}
            href={`/dashboard/${encodeURIComponent(projectName)}/headless/runs/${encodeURIComponent(run.runId)}`}
            className="block rounded-lg border border-border bg-card p-3 hover:border-foreground/30 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <StatusPill status={run.status} />
                  <PermissionBadge mode={run.permissionMode} />
                  {run.model && (
                    <Badge variant="outline" className="text-[10px]">{run.model}</Badge>
                  )}
                  {run.loopPhaseName && (
                    <Badge variant="secondary" className="text-[10px]">{run.loopPhaseName}</Badge>
                  )}
                </div>
                <div className="text-sm line-clamp-2">{run.prompt}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
                <div>{new Date(run.startedAt).toLocaleString()}</div>
                {run.totalCostUsd != null && <div>{formatCost(run.totalCostUsd)}</div>}
                {run.usage && (
                  <div>
                    {formatTokens(run.usage.input_tokens)} in / {formatTokens(run.usage.output_tokens)} out
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { formatBytes };
