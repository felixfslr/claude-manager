"use client";
import { useEffect, useRef, useState } from "react";
import type { HeadlessRunMeta, HeadlessEventEnvelope } from "@/lib/headless-types";

type StreamStatus = "connecting" | "connected" | "closed";

interface UseHeadlessStreamArgs {
  projectName: string;
  runId: string | null;
  /** Optional initial events fetched via REST so we don't have to wait for replay. */
  seedEvents?: unknown[];
  seedMeta?: HeadlessRunMeta | null;
}

interface UseHeadlessStream {
  status: StreamStatus;
  events: unknown[];
  meta: HeadlessRunMeta | null;
}

/**
 * Connect a WebSocket to /ws/headless/<project>/<runId> and accumulate the
 * stream of events + meta updates. Reconnects with exponential backoff while
 * the run is still in a non-terminal state.
 */
export function useHeadlessStream({
  projectName,
  runId,
  seedEvents,
  seedMeta,
}: UseHeadlessStreamArgs): UseHeadlessStream {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [events, setEvents] = useState<unknown[]>(seedEvents ?? []);
  const [meta, setMeta] = useState<HeadlessRunMeta | null>(seedMeta ?? null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(500);
  const closedManually = useRef(false);

  // Reset state when runId changes.
  useEffect(() => {
    setEvents(seedEvents ?? []);
    setMeta(seedMeta ?? null);
    setStatus("connecting");
    backoffRef.current = 500;
    // We deliberately don't include seedEvents/seedMeta in deps — they are only
    // an initial value, the live stream then takes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      setStatus("closed");
      return;
    }
    closedManually.current = false;

    function connect() {
      if (closedManually.current || !runId) return;
      setStatus("connecting");
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${location.host}/ws/headless/${encodeURIComponent(projectName)}/${encodeURIComponent(runId)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (closedManually.current) return;
        setStatus("connected");
        backoffRef.current = 500;
      };

      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return;
        let envelope: HeadlessEventEnvelope;
        try {
          envelope = JSON.parse(e.data) as HeadlessEventEnvelope;
        } catch {
          return;
        }
        if (envelope.kind === "event") {
          setEvents((prev) => [...prev, envelope.payload]);
        } else if (envelope.kind === "meta") {
          setMeta(envelope.payload);
        } else if (envelope.kind === "closed") {
          closedManually.current = true;
          setStatus("closed");
        }
      };

      ws.onclose = () => {
        if (closedManually.current) {
          setStatus("closed");
          return;
        }
        setStatus("connecting");
        const delay = Math.min(backoffRef.current, 5000);
        backoffRef.current = Math.min(backoffRef.current * 2, 5000);
        retryRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // ignore — onclose will run
      };
    }

    connect();

    return () => {
      closedManually.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [projectName, runId]);

  return { status, events, meta };
}
