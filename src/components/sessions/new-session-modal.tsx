"use client";
// Minimal cross-project "Start new session" modal. Step 1 picks a project
// from /api/projects, step 2 reuses the existing RunForm for the selected
// project. On start, RunForm already routes to the per-project thread view.

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, FolderGit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RunForm } from "@/components/project-detail/headless/run-form";
import type { Project } from "@/lib/types";

interface NewSessionModalProps {
  onClose: () => void;
}

export function NewSessionModal({ onClose }: NewSessionModalProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load projects (${r.status})`);
        return r.json() as Promise<Project[]>;
      })
      .then(setProjects)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load projects");
        setProjects([]);
      });
  }, []);

  const filtered = (projects ?? []).filter((p) =>
    filter.trim() ? p.name.toLowerCase().includes(filter.trim().toLowerCase()) : true
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 text-base hover:text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
                {selected}
              </button>
            ) : (
              "Start new session"
            )}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? "Configure and launch a headless Claude run. You'll be routed to the thread view on start."
              : "Pick a project to start a new headless Claude session in."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Filter projects…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="max-h-80 overflow-y-auto space-y-1 rounded-md border border-border p-1">
              {projects === null ? (
                <div className="flex items-center justify-center p-6 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground p-4 text-center">
                  No projects match.
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSelected(p.name)}
                    className="w-full text-left flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <FolderGit2 className="size-3 text-muted-foreground" />
                    <span className="font-medium">{p.name}</span>
                    {p.currentBranch && (
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                        {p.currentBranch}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <RunForm projectName={selected} onStarted={onClose} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
