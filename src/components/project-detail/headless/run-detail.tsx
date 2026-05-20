"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Square, RotateCw, Trash2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeadlessStream } from "@/hooks/use-headless-stream";
import { EventCard } from "./event-card";
import { StatusPill, PermissionBadge, formatCost, formatTokens, formatBytes } from "./run-bits";
import type { HeadlessRunMeta } from "@/lib/headless-types";

interface RunDetailProps {
  projectName: string;
  runId: string;
}

interface InitialFetch {
  meta: HeadlessRunMeta;
  events: unknown[];
  eventsSize: number;
}

export function RunDetail({ projectName, runId }: RunDetailProps) {
  const router = useRouter();
  const [initial, setInitial] = useState<InitialFetch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);

  // One-shot REST fetch as the seed.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(runId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load run");
        return r.json() as Promise<InitialFetch>;
      })
      .then((data) => !cancelled && setInitial(data))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Unknown error"));
    return () => {
      cancelled = true;
    };
  }, [projectName, runId]);

  const { status, events, meta } = useHeadlessStream({
    projectName,
    runId: initial ? runId : null,
    seedEvents: initial?.events,
    seedMeta: initial?.meta ?? null,
  });

  // Auto-scroll to bottom unless the user has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    autoScrollRef.current = atBottom;
  };

  // Filter out stream_event from rendering — they're for live token tracking only.
  const displayEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!e || typeof e !== "object") return false;
        const t = (e as { type?: string }).type;
        return t !== "stream_event";
      }),
    [events]
  );

  const cancel = async () => {
    await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(runId)}`,
      { method: "DELETE" }
    );
  };

  const purge = async () => {
    if (!confirm("Permanently delete this run and its event log?")) return;
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(runId)}?purge=1`,
      { method: "DELETE" }
    );
    if (res.ok) router.push(`/dashboard/${encodeURIComponent(projectName)}/headless`);
  };

  const resume = async (fork = false) => {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(runId)}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Continue working.", forkSession: fork }),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { runId: string };
      router.push(
        `/dashboard/${encodeURIComponent(projectName)}/headless/runs/${encodeURIComponent(data.runId)}`
      );
    }
  };

  if (loadError) {
    return <div className="text-sm text-destructive">{loadError}</div>;
  }
  if (!initial) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const liveMeta = meta ?? initial.meta;
  const isRunning = liveMeta.status === "running" || liveMeta.status === "pending";

  return (
    <div className="space-y-4">
      {/* Metrics card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={liveMeta.status} />
            <PermissionBadge mode={liveMeta.permissionMode} />
            {liveMeta.model && (
              <span className="text-xs text-muted-foreground">{liveMeta.model}</span>
            )}
            <span className="text-xs text-muted-foreground">
              · stream {status}
            </span>
            {liveMeta.loopPhaseName && (
              <span className="text-xs text-muted-foreground">· loop phase: {liveMeta.loopPhaseName}</span>
            )}
          </div>
          <div className="flex gap-1">
            {isRunning ? (
              <Button size="xs" variant="destructive" onClick={cancel}>
                <Square className="size-3" />
                Cancel
              </Button>
            ) : (
              <>
                <Button size="xs" variant="outline" onClick={() => resume(false)}>
                  <RotateCw className="size-3" />
                  Resume
                </Button>
                <Button size="xs" variant="outline" onClick={() => resume(true)}>
                  <GitBranch className="size-3" />
                  Fork
                </Button>
                <Button size="xs" variant="destructive" onClick={purge}>
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Metric label="Tokens in" value={formatTokens(liveMeta.usage?.input_tokens)} />
          <Metric label="Tokens out" value={formatTokens(liveMeta.usage?.output_tokens)} />
          <Metric
            label="Cost"
            value={liveMeta.totalCostUsd != null ? formatCost(liveMeta.totalCostUsd) : "—"}
          />
          <Metric label="Turns" value={liveMeta.numTurns?.toString() ?? "—"} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-muted-foreground">
          <div>started: {new Date(liveMeta.startedAt).toLocaleString()}</div>
          {liveMeta.endedAt && <div>ended: {new Date(liveMeta.endedAt).toLocaleString()}</div>}
          <div>events: {displayEvents.length}</div>
          <div>log: {formatBytes(initial.eventsSize)}</div>
        </div>
        {liveMeta.claudeSessionId && (
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            session: {liveMeta.claudeSessionId}
          </div>
        )}
        {liveMeta.errorMessage && (
          <div className="text-xs text-destructive whitespace-pre-wrap">{liveMeta.errorMessage}</div>
        )}
        <div className="text-xs text-muted-foreground line-clamp-3 italic">
          {liveMeta.prompt}
        </div>
      </div>

      {/* Event timeline */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="space-y-2 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-3"
      >
        {displayEvents.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Waiting for output…</div>
        ) : (
          displayEvents.map((event, i) => <EventCard key={i} event={event} />)
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
