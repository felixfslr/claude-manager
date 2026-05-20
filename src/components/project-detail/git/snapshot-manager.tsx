"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Plus, RotateCcw } from "lucide-react";
import type { GitSnapshot } from "@/lib/types";

interface SnapshotManagerProps {
  projectName: string;
}

export function SnapshotManager({ projectName }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<GitSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/git/${path}`,
    [projectName]
  );

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch(api("snapshots"));
      if (res.ok) setSnapshots(await res.json());
    } catch {} finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const handleCreate = async () => {
    if (!description.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(api("snapshots"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      if (res.ok) { toast.success("Snapshot created"); setDescription(""); setShowCreate(false); fetchSnapshots(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to create snapshot"); }
    finally { setCreating(false); }
  };

  const handleRestore = async (tag: string) => {
    try {
      const res = await fetch(api(`snapshots/${encodeURIComponent(tag)}/restore`), { method: "POST" });
      if (res.ok) { toast.success(`Restored to ${tag}`); fetchSnapshots(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to restore"); }
  };

  if (loading) return <div className="h-16 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Snapshots</span>
          {snapshots.length > 0 && <Badge variant="outline" className="text-xs">{snapshots.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)} className="text-xs">
          <Plus className="size-3" data-icon="inline-start" /> Snapshot
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2 rounded-md border border-dashed border-border p-2">
          <Input placeholder="Snapshot description" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 text-xs" />
          <Button size="sm" onClick={handleCreate} disabled={creating || !description.trim()} className="text-xs">Create</Button>
        </div>
      )}

      {snapshots.length === 0 ? (
        <p className="text-xs text-muted-foreground">No snapshots yet</p>
      ) : (
        <div className="space-y-1">
          {snapshots.map((s) => (
            <div key={s.tag} className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs">
              <span className="font-mono text-muted-foreground shrink-0">{s.hash}</span>
              <span className="flex-1 truncate">{s.description}</span>
              <span className="text-muted-foreground shrink-0 text-[10px]">
                {new Date(s.date).toLocaleDateString()}
              </span>
              <button onClick={() => handleRestore(s.tag)} className="text-muted-foreground hover:text-foreground shrink-0" title="Restore">
                <RotateCcw className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
