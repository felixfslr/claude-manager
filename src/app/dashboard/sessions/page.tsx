"use client";
// Global cross-project view of headless sessions. Polls /api/headless/all
// every few seconds to surface running work and the most recent finished
// runs. Clicking a card takes you to the existing per-project run view.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunningSessionsList } from "@/components/sessions/running-sessions-list";
import { RecentSessionsList } from "@/components/sessions/recent-sessions-list";
import { NewSessionModal } from "@/components/sessions/new-session-modal";
import type { HeadlessRunMeta } from "@/lib/headless-types";

interface AllSessionsPayload {
  running: HeadlessRunMeta[];
  recent: HeadlessRunMeta[];
}

export default function SessionsPage() {
  const [data, setData] = useState<AllSessionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/headless/all");
      if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
      const payload = (await res.json()) as AllSessionsPayload;
      setData(payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 3s while the page is open. The list is cheap: one disk walk
  // per project. We stop polling if no tab is visible to avoid waste.
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    };
    const id = setInterval(tick, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [refresh]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Headless Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Running and recently finished Claude runs across every project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCcw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNewModal(true)}>
            <Plus className="size-3.5" />
            New session
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Running</h2>
              <span className="text-xs text-muted-foreground">
                {data?.running.length ?? 0}
              </span>
            </div>
            {data && data.running.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-6 text-center">
                Nothing running right now.{" "}
                <Link href="/dashboard" className="underline hover:text-foreground">
                  Pick a project
                </Link>{" "}
                or start a new session above.
              </div>
            ) : (
              <RunningSessionsList runs={data?.running ?? []} onChanged={refresh} />
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Recently finished</h2>
              <span className="text-xs text-muted-foreground">
                {data?.recent.length ?? 0}
              </span>
            </div>
            {data && data.recent.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-6 text-center">
                No finished sessions yet.
              </div>
            ) : (
              <RecentSessionsList runs={data?.recent ?? []} />
            )}
          </section>
        </>
      )}

      {showNewModal && (
        <NewSessionModal
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
