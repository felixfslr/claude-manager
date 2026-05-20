"use client";
// Aggregates every run that shares a Claude session id into a single
// chat-style thread, and keeps the currently-running run live via the
// existing headless WebSocket hook.
//
// Each chat turn = one HeadlessRun. When the user sends a new message we
// POST to /resume on the latest run and append a synthetic "pending"
// placeholder so the user bubble shows instantly; on 201 we swap it for
// the real run and the inner useHeadlessStream takes over.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHeadlessStream } from "./use-headless-stream";
import type { HeadlessRunMeta } from "@/lib/headless-types";

type ThreadStatus = "loading" | "ready" | "error";

interface UseHeadlessThreadArgs {
  projectName: string;
  sessionId: string | null;
}

interface ThreadPayload {
  runs: HeadlessRunMeta[];
  events: Record<string, unknown[]>;
  eventsSizes: Record<string, number>;
}

interface UseHeadlessThread {
  status: ThreadStatus;
  error: string | null;
  runs: HeadlessRunMeta[];
  events: Record<string, unknown[]>;
  latestRun: HeadlessRunMeta | null;
  isBusy: boolean;
  streamStatus: "connecting" | "connected" | "closed";
  sendMessage: (prompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** Synthetic prefix used for the optimistic placeholder runId. */
const PLACEHOLDER_PREFIX = "pending-local-";

function isBusyStatus(run: HeadlessRunMeta | null | undefined): boolean {
  if (!run) return false;
  return run.status === "running" || run.status === "pending";
}

export function useHeadlessThread({
  projectName,
  sessionId,
}: UseHeadlessThreadArgs): UseHeadlessThread {
  const [status, setStatus] = useState<ThreadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<HeadlessRunMeta[]>([]);
  const [events, setEvents] = useState<Record<string, unknown[]>>({});
  // Bumping this triggers the one-shot REST fetch. We don't fetch on every
  // render because the WebSocket keeps the latest run fresh for us.
  const [refreshTick, setRefreshTick] = useState(0);

  // Load (and reload) the thread via the REST route.
  useEffect(() => {
    if (!sessionId) {
      setStatus("loading");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/thread/${encodeURIComponent(sessionId)}`
    )
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed to load thread (${r.status})`);
        }
        return r.json() as Promise<ThreadPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setRuns(data.runs);
        setEvents(data.events);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sessionId, refreshTick]);

  // Latest run = most recent by startedAt. Placeholders win over real runs
  // when they are newer so the user bubble stays put until swap-in.
  const latestRun = useMemo<HeadlessRunMeta | null>(() => {
    if (runs.length === 0) return null;
    let best = runs[0];
    for (let i = 1; i < runs.length; i++) {
      if (runs[i].startedAt > best.startedAt) best = runs[i];
    }
    return best;
  }, [runs]);

  // Don't subscribe to placeholders — they don't exist on disk and the
  // hook would just fail to open a WebSocket.
  const liveRunId = useMemo<string | null>(() => {
    if (!latestRun) return null;
    if (latestRun.runId.startsWith(PLACEHOLDER_PREFIX)) return null;
    return latestRun.runId;
  }, [latestRun]);

  // Tail the latest real run. Reset seeds whenever we switch runs.
  const seedEvents = liveRunId ? events[liveRunId] ?? [] : [];
  const seedMeta = liveRunId ? latestRun : null;
  const stream = useHeadlessStream({
    projectName,
    runId: liveRunId,
    seedEvents,
    seedMeta,
  });

  // Merge live stream events into the thread's events map.
  const prevEventCount = useRef(0);
  useEffect(() => {
    if (!liveRunId) {
      prevEventCount.current = 0;
      return;
    }
    // useHeadlessStream accumulates events; replacing is simpler than diffing.
    setEvents((prev) => ({ ...prev, [liveRunId]: stream.events }));
    prevEventCount.current = stream.events.length;
  }, [liveRunId, stream.events]);

  // Merge live meta back into the runs array so the header metrics,
  // StatusPill, and "is running" state stay up to date.
  useEffect(() => {
    if (!liveRunId || !stream.meta) return;
    setRuns((prev) => {
      const idx = prev.findIndex((r) => r.runId === liveRunId);
      if (idx === -1) return prev;
      if (prev[idx] === stream.meta) return prev;
      const next = prev.slice();
      next[idx] = stream.meta!;
      return next;
    });
  }, [liveRunId, stream.meta]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      // Require a real (non-placeholder) anchor run to POST against, since
      // /resume needs a runId that exists on disk.
      const anchor = runs
        .slice()
        .reverse()
        .find((r) => !r.runId.startsWith(PLACEHOLDER_PREFIX));
      if (!anchor) {
        throw new Error("No resumable run in this thread yet");
      }

      // Optimistic placeholder so the user bubble paints immediately.
      const placeholderId = `${PLACEHOLDER_PREFIX}${Date.now()}`;
      const placeholder: HeadlessRunMeta = {
        runId: placeholderId,
        projectName: anchor.projectName,
        cwd: anchor.cwd,
        prompt: trimmed,
        permissionMode: anchor.permissionMode,
        model: anchor.model,
        status: "pending",
        startedAt: new Date().toISOString(),
        claudeSessionId: anchor.claudeSessionId,
      };
      setRuns((prev) => [...prev, placeholder]);
      setEvents((prev) => ({ ...prev, [placeholderId]: [] }));

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(anchor.runId)}/resume`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: trimmed }),
          }
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Resume failed (${res.status})`);
        }
        const data = (await res.json()) as {
          runId: string;
          meta: HeadlessRunMeta;
        };
        // Swap placeholder for the real run. Its events are empty until the
        // WebSocket connects and starts streaming — useHeadlessStream
        // resets its internal state on runId change.
        setRuns((prev) =>
          prev.map((r) => (r.runId === placeholderId ? data.meta : r))
        );
        setEvents((prev) => {
          const next = { ...prev };
          delete next[placeholderId];
          next[data.runId] = [];
          return next;
        });
      } catch (err) {
        // Roll back the optimistic placeholder on failure.
        setRuns((prev) => prev.filter((r) => r.runId !== placeholderId));
        setEvents((prev) => {
          const next = { ...prev };
          delete next[placeholderId];
          return next;
        });
        throw err;
      }
    },
    [projectName, runs]
  );

  const cancel = useCallback(async () => {
    if (!liveRunId) return;
    await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(liveRunId)}`,
      { method: "DELETE" }
    );
  }, [projectName, liveRunId]);

  const refresh = useCallback(async () => {
    setRefreshTick((t) => t + 1);
  }, []);

  return {
    status,
    error,
    runs,
    events,
    latestRun,
    isBusy: isBusyStatus(latestRun),
    streamStatus: stream.status,
    sendMessage,
    cancel,
    refresh,
  };
}
