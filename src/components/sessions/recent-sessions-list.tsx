"use client";
// List of recently-completed headless runs across every project. Read-only
// view that links into the per-project thread detail.

import Link from "next/link";
import {
  StatusPill,
  formatCost,
  formatDuration,
  formatTokens,
} from "@/components/project-detail/headless/run-bits";
import type { HeadlessRunMeta } from "@/lib/headless-types";

interface RecentSessionsListProps {
  runs: HeadlessRunMeta[];
}

function getDuration(run: HeadlessRunMeta): number | null {
  if (!run.endedAt) return null;
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function RecentSessionsList({ runs }: RecentSessionsListProps) {
  return (
    <div className="space-y-1.5">
      {runs.map((run) => {
        const href = `/dashboard/${encodeURIComponent(run.projectName)}/headless/runs/${encodeURIComponent(run.runId)}`;
        const duration = getDuration(run);
        return (
          <Link
            key={run.runId}
            href={href}
            className="flex items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-foreground/30 transition-colors"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={run.status} />
                <span className="text-xs font-medium">{run.projectName}</span>
                {run.model && (
                  <span className="text-[10px] text-muted-foreground">
                    {run.model}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {relativeTime(run.endedAt ?? run.startedAt)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {run.prompt}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {duration != null && <span>{formatDuration(duration)}</span>}
                {typeof run.totalCostUsd === "number" && (
                  <span>{formatCost(run.totalCostUsd)}</span>
                )}
                {run.usage?.output_tokens != null && (
                  <span>{formatTokens(run.usage.output_tokens)} out</span>
                )}
                {typeof run.numTurns === "number" && <span>{run.numTurns} turns</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
