"use client";
// List of currently-running (or pending) headless runs across every project.
// Each card links to the per-project thread view and exposes a Cancel action.

import Link from "next/link";
import { useState } from "react";
import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/use-tick";
import { StatusPill, formatDuration } from "@/components/project-detail/headless/run-bits";
import type { HeadlessRunMeta } from "@/lib/headless-types";

interface RunningSessionsListProps {
  runs: HeadlessRunMeta[];
  onChanged: () => void;
}

export function RunningSessionsList({ runs, onChanged }: RunningSessionsListProps) {
  // Tick once a second so elapsed durations update live without a full refetch.
  useTick(runs.length > 0, 1000);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const handleCancel = async (run: HeadlessRunMeta) => {
    setCancelling(run.runId);
    try {
      await fetch(
        `/api/projects/${encodeURIComponent(run.projectName)}/headless/${encodeURIComponent(run.runId)}`,
        { method: "DELETE" }
      );
      onChanged();
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const elapsed = Date.now() - new Date(run.startedAt).getTime();
        const href = `/dashboard/${encodeURIComponent(run.projectName)}/headless/runs/${encodeURIComponent(run.runId)}`;
        return (
          <div
            key={run.runId}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-foreground/30 transition-colors"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={run.status} />
                <Link
                  href={`/dashboard/${encodeURIComponent(run.projectName)}`}
                  className="text-xs font-medium hover:underline"
                >
                  {run.projectName}
                </Link>
                {run.model && (
                  <span className="text-[10px] text-muted-foreground">
                    {run.model}
                  </span>
                )}
                {run.effortLevel && (
                  <span className="text-[10px] rounded px-1 py-0.5 border border-border bg-muted/40 uppercase">
                    {run.effortLevel}
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                  {formatDuration(elapsed)}
                </span>
              </div>
              <Link
                href={href}
                className="block text-xs text-muted-foreground line-clamp-2 hover:text-foreground"
              >
                {run.prompt}
              </Link>
            </div>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => handleCancel(run)}
              disabled={cancelling === run.runId}
              aria-label="Cancel session"
            >
              {cancelling === run.runId ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Square className="size-3" />
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
