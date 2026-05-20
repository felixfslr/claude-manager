"use client";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileCode, Play, Loader2 } from "lucide-react";

interface Workflow { name: string; path: string }
interface WorkflowRun { id: number; name: string; status: string; conclusion: string | null; createdAt: string; headBranch: string; htmlUrl: string }

interface CiCdTabProps {
  projectName: string;
}

export function CiCdTab({ projectName }: CiCdTabProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/cicd/${path}`,
    [projectName]
  );

  useEffect(() => {
    Promise.all([
      fetch(api("workflows")).then((r) => r.ok ? r.json() : []),
      fetch(api("runs")).then((r) => r.ok ? r.json() : []),
    ]).then(([w, r]) => {
      setWorkflows(w);
      setRuns(r);
    }).finally(() => setLoading(false));
  }, [api]);

  const statusColor = (status: string, conclusion: string | null) => {
    if (status === "completed" && conclusion === "success") return "text-green-500 border-green-500/30";
    if (status === "completed" && conclusion === "failure") return "text-red-500 border-red-500/30";
    if (status === "in_progress") return "text-amber-500 border-amber-500/30";
    return "text-muted-foreground";
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

  return (
    <div className="space-y-6">
      {/* Workflows */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileCode className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Workflows</span>
          <Badge variant="outline" className="text-xs">{workflows.length}</Badge>
        </div>
        {workflows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No GitHub Actions workflows found in .github/workflows/</p>
        ) : (
          <div className="space-y-1">
            {workflows.map((w) => (
              <div key={w.path} className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs">
                <FileCode className="size-3 text-muted-foreground shrink-0" />
                <span className="font-medium flex-1">{w.name}</span>
                <span className="text-muted-foreground font-mono">{w.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Play className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Runs</span>
          {runs.length > 0 && <Badge variant="outline" className="text-xs">{runs.length}</Badge>}
        </div>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No workflow runs found</p>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs">
                <Badge variant="outline" className={`text-[10px] ${statusColor(r.status, r.conclusion)}`}>
                  {r.conclusion || r.status}
                </Badge>
                <span className="font-medium flex-1 truncate">{r.name}</span>
                <span className="text-muted-foreground font-mono">{r.headBranch}</span>
                <span className="text-muted-foreground text-[10px]">{new Date(r.createdAt).toLocaleDateString()}</span>
                <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
