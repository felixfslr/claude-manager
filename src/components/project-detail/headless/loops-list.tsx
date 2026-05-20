"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Play, Trash2, Plus, Repeat, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LoopDef, LoopRunState } from "@/lib/headless-types";
import { LoopEditor } from "./loop-editor";

interface LoopsListProps {
  projectName: string;
}

export function LoopsList({ projectName }: LoopsListProps) {
  const [loops, setLoops] = useState<LoopDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LoopDef | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeRuns, setActiveRuns] = useState<Record<string, LoopRunState>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/loops`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load loops");
      const data = (await res.json()) as LoopDef[];
      setLoops(data);
      setError(null);
      // Fetch latest run state per loop
      const runs: Record<string, LoopRunState> = {};
      await Promise.all(
        data.map(async (loop) => {
          try {
            const r = await fetch(
              `/api/projects/${encodeURIComponent(projectName)}/loops/${encodeURIComponent(loop.id)}`
            );
            if (r.ok) {
              const detail = (await r.json()) as { runs: LoopRunState[] };
              if (detail.runs && detail.runs.length > 0) runs[loop.id] = detail.runs[0];
            }
          } catch {
            // ignore
          }
        })
      );
      setActiveRuns(runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, [projectName]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const createFromTemplate = async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/loops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Plan → Implement → Test → Debug",
          description: "Built-in template that loops the debug phase until tests pass.",
          template: "plan-implement-test-debug",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create loop");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const createBlank = () => {
    setEditing({
      id: "",
      projectName,
      name: "New loop",
      phases: [
        {
          name: "Phase 1",
          prompt: "",
          permissionMode: "bypassPermissions",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setEditorOpen(true);
  };

  const runLoop = async (loop: LoopDef) => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/loops/${encodeURIComponent(loop.id)}/run`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed to start");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const cancelLoop = async (loop: LoopDef) => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/loops/${encodeURIComponent(loop.id)}/cancel`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed to cancel");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const deleteLoop = async (loop: LoopDef) => {
    if (!confirm(`Delete loop "${loop.name}"?`)) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/loops/${encodeURIComponent(loop.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Loops chain headless runs. Use the built-in template or define your own.
        </p>
        <div className="flex gap-1">
          <Button size="xs" variant="outline" onClick={createBlank}>
            <Plus className="size-3" />
            Blank loop
          </Button>
          <Button size="xs" onClick={createFromTemplate}>
            <Repeat className="size-3" />
            Template
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loops === null ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground mx-auto" />
      ) : loops.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No loops yet.</div>
      ) : (
        <div className="space-y-2">
          {loops.map((loop) => {
            const last = activeRuns[loop.id];
            const isRunning = last && last.status === "running";
            return (
              <div key={loop.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium">{loop.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {loop.phases.length} phase{loop.phases.length === 1 ? "" : "s"}
                      </Badge>
                      {last && (
                        <Badge
                          variant={
                            last.status === "succeeded"
                              ? "default"
                              : last.status === "failed" || last.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {last.status}
                        </Badge>
                      )}
                    </div>
                    {loop.description && (
                      <div className="text-xs text-muted-foreground">{loop.description}</div>
                    )}
                    {last && last.currentPhaseIndex !== undefined && isRunning && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Phase {last.currentPhaseIndex + 1}/{loop.phases.length} ·{" "}
                        {loop.phases[last.currentPhaseIndex]?.name}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isRunning ? (
                      <Button size="xs" variant="destructive" onClick={() => cancelLoop(loop)}>
                        <Square className="size-3" />
                        Cancel
                      </Button>
                    ) : (
                      <Button size="xs" onClick={() => runLoop(loop)}>
                        <Play className="size-3" />
                        Run
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setEditing(loop);
                        setEditorOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="xs" variant="destructive" onClick={() => deleteLoop(loop)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editorOpen && editing && (
        <LoopEditor
          projectName={projectName}
          loop={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
