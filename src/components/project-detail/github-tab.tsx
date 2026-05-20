"use client";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";
import type { GitHubInfo } from "@/lib/types";
import {
  GitBranch,
  GitPullRequest,
  ExternalLink,
  Eye,
  Lock,
  GitCommit,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GitHubTabProps {
  projectName: string;
}

export function GitHubTab({ projectName }: GitHubTabProps) {
  const [data, setData] = useState<GitHubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectName)}/github-info`)
      .then((res) => {
        if (!res.ok) throw new Error("No GitHub info available");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectName]);

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-5 animate-pulse rounded bg-muted"
            style={{ width: `${50 + i * 10}%` }}
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {error || "No GitHub repository linked."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Repo name and link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{data.repoName}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {data.visibility === "private" ? (
              <Lock className="size-3" />
            ) : (
              <Eye className="size-3" />
            )}
            {data.visibility}
          </span>
        </div>
        <a href={data.htmlUrl} target="_blank" rel="noopener noreferrer">
          <Button size="xs" variant="outline">
            <ExternalLink className="size-3" data-icon="inline-start" />
            Open
          </Button>
        </a>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" />
            Default branch
          </div>
          <p className="text-sm font-medium">{data.defaultBranch}</p>
        </div>
        <div className="rounded-md border border-border p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitPullRequest className="size-3.5" />
            Open PRs
          </div>
          <p className="text-sm font-medium">{data.openPrCount}</p>
        </div>
      </div>

      {/* Last commit */}
      {data.lastCommit && (
        <div className="rounded-md border border-border p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitCommit className="size-3.5" />
            Last commit
          </div>
          <p className="text-sm">{data.lastCommit.message}</p>
          <p className="text-xs text-muted-foreground">
            {data.lastCommit.author} &middot;{" "}
            {formatRelativeTime(data.lastCommit.date)}
          </p>
        </div>
      )}
    </div>
  );
}
