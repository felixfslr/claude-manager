"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Archive, Plus, Trash2, ArrowDownToLine, Copy } from "lucide-react";
import type { GitStash } from "@/lib/types";

interface StashManagerProps {
  projectName: string;
}

export function StashManager({ projectName }: StashManagerProps) {
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState("");

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/git/${path}`,
    [projectName]
  );

  const fetchStashes = useCallback(async () => {
    try {
      const res = await fetch(api("stashes"));
      if (res.ok) setStashes(await res.json());
    } catch {} finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchStashes(); }, [fetchStashes]);

  const handleStash = async () => {
    try {
      const res = await fetch(api("stashes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || undefined }),
      });
      if (res.ok) { toast.success("Changes stashed"); setMessage(""); setShowCreate(false); fetchStashes(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to stash"); }
  };

  const handleAction = async (index: number, action: "pop" | "apply") => {
    try {
      const res = await fetch(api(`stashes/${index}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) { toast.success(action === "pop" ? "Stash popped" : "Stash applied"); fetchStashes(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); }
  };

  const handleDrop = async (index: number) => {
    try {
      const res = await fetch(api(`stashes/${index}`), { method: "DELETE" });
      if (res.ok) { toast.success("Stash dropped"); fetchStashes(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed"); }
  };

  if (loading) return <div className="h-16 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Stashes</span>
          {stashes.length > 0 && <Badge variant="outline" className="text-xs">{stashes.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)} className="text-xs">
          <Plus className="size-3" data-icon="inline-start" /> Stash
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2 rounded-md border border-dashed border-border p-2">
          <Input placeholder="Stash message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} className="flex-1 text-xs" />
          <Button size="sm" onClick={handleStash} className="text-xs">Save</Button>
        </div>
      )}

      {stashes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No stashes</p>
      ) : (
        <div className="space-y-1">
          {stashes.map((s) => (
            <div key={s.index} className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs">
              <span className="font-mono text-muted-foreground">#{s.index}</span>
              <span className="flex-1 truncate">{s.message}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleAction(s.index, "pop")} className="text-muted-foreground hover:text-foreground" title="Pop">
                  <ArrowDownToLine className="size-3" />
                </button>
                <button onClick={() => handleAction(s.index, "apply")} className="text-muted-foreground hover:text-foreground" title="Apply">
                  <Copy className="size-3" />
                </button>
                <button onClick={() => handleDrop(s.index)} className="text-muted-foreground hover:text-destructive" title="Drop">
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
