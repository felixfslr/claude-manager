"use client";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import { usePolling } from "@/hooks/use-polling";
import type { NamedSession } from "@/lib/types";
import { Play, Square, RotateCw, Plus, Trash2, X } from "lucide-react";

interface SessionManagerProps {
  projectName: string;
}

export function SessionManager({ projectName }: SessionManagerProps) {
  const { data: sessions, refetch } = usePolling<NamedSession[]>(
    `/api/projects/${encodeURIComponent(projectName)}/sessions`,
    3000
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = useCallback(
    async (session: string, action: string) => {
      setActionLoading(`${session}:${action}`);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(session)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }
        );
        if (res.ok) {
          toast.success(`Session "${session}" ${action}ed`);
          refetch();
        } else {
          const data = await res.json();
          toast.error(data.error || `Failed to ${action} session`);
        }
      } catch {
        toast.error(`Failed to ${action} session`);
      } finally {
        setActionLoading(null);
      }
    },
    [projectName, refetch]
  );

  const handleCreate = useCallback(async () => {
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (!name) return;
    setCreating(false);
    setNewName("");
    await handleAction(name, "start");
  }, [newName, handleAction]);

  const handleDelete = useCallback(
    async (session: string) => {
      try {
        await handleAction(session, "stop");
      } catch {
        // already stopped
      }
    },
    [handleAction]
  );

  const list = sessions ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Sessions</p>
        {!creating && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-3.5 mr-1" />
            Neue Session
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 text-sm"
            placeholder="Session-Name (z.B. refactor)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleCreate} disabled={!newName.trim()}>
            Start
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {list.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground">Keine aktiven Sessions</p>
      )}

      <div className="space-y-1">
        {list.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-mono truncate">{s.name}</span>
              <StatusBadge state={s.state} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {s.state === "stopped" ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => handleAction(s.name, "start")}
                  disabled={actionLoading !== null}
                >
                  <Play className="size-3.5" />
                </Button>
              ) : (
                <>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleAction(s.name, "stop")}
                    disabled={actionLoading !== null}
                  >
                    <Square className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleAction(s.name, "restart")}
                    disabled={actionLoading !== null}
                  >
                    <RotateCw className="size-3.5" />
                  </Button>
                </>
              )}
              {s.name !== "default" && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(s.name)}
                  disabled={actionLoading !== null}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
