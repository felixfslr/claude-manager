"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2, Merge, ArrowRight, Loader2 } from "lucide-react";
import type { GitBranch as GitBranchType } from "@/lib/types";

interface BranchManagerProps {
  projectName: string;
}

export function BranchManager({ projectName }: BranchManagerProps) {
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [creating, setCreating] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/git/${path}`,
    [projectName]
  );

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(api("branches"));
      if (res.ok) setBranches(await res.json());
    } catch {} finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleCreate = async () => {
    if (!newBranch.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(api("branches"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchName: newBranch.trim() }),
      });
      if (res.ok) {
        toast.success(`Branch "${newBranch}" created`);
        setNewBranch("");
        setShowCreate(false);
        fetchBranches();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch { toast.error("Failed to create branch"); }
    finally { setCreating(false); }
  };

  const handleSwitch = async (branch: string) => {
    try {
      const res = await fetch(api("branches/switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });
      if (res.ok) { toast.success(`Switched to ${branch}`); fetchBranches(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to switch"); }
  };

  const handleDelete = async (branch: string) => {
    try {
      const res = await fetch(api(`branches/${encodeURIComponent(branch)}`), { method: "DELETE" });
      if (res.ok) { toast.success(`Deleted ${branch}`); fetchBranches(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } catch { toast.error("Failed to delete"); }
  };

  const handleMerge = async (source: string) => {
    try {
      const res = await fetch(api("branches/merge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (res.ok) { toast.success(`Merged ${source}`); setMergeSource(null); fetchBranches(); }
      else { const d = await res.json(); toast.error(d.error || "Merge failed"); }
    } catch { toast.error("Merge failed"); }
  };

  if (loading) return <div className="h-20 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Branches</span>
          <Badge variant="outline" className="text-xs">{branches.length}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)} className="text-xs">
          <Plus className="size-3" data-icon="inline-start" /> New
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2 rounded-md border border-dashed border-border p-2">
          <Input placeholder="branch-name" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className="flex-1 text-xs" />
          <Button size="sm" onClick={handleCreate} disabled={creating || !newBranch.trim()} className="text-xs">
            {creating && <Loader2 className="size-3 animate-spin" data-icon="inline-start" />} Create
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {branches.map((b) => (
          <div key={b.name} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${b.current ? "bg-foreground/5 border border-foreground/10" : "bg-muted"}`}>
            <span className={`font-mono flex-1 truncate ${b.current ? "font-semibold" : ""}`}>
              {b.name}
            </span>
            {b.current && <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">current</Badge>}
            <span className="text-muted-foreground truncate max-w-[120px] hidden sm:inline">{b.lastCommitMessage}</span>
            {!b.current && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleSwitch(b.name)} className="text-muted-foreground hover:text-foreground" title="Switch">
                  <ArrowRight className="size-3" />
                </button>
                <button onClick={() => mergeSource === b.name ? handleMerge(b.name) : setMergeSource(b.name)} className={`hover:text-foreground ${mergeSource === b.name ? "text-amber-500" : "text-muted-foreground"}`} title={mergeSource === b.name ? "Click again to confirm merge" : "Merge into current"}>
                  <Merge className="size-3" />
                </button>
                <button onClick={() => handleDelete(b.name)} className="text-muted-foreground hover:text-destructive" title="Delete">
                  <Trash2 className="size-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
