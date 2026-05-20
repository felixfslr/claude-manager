"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { History, RotateCcw, Loader2 } from "lucide-react";
import { DiffViewer } from "./diff-viewer";
import { RollbackDialog } from "./rollback-dialog";
import type { GitCommit, GitDiffFile } from "@/lib/types";

interface CommitHistoryProps {
  projectName: string;
}

export function CommitHistory({ projectName }: CommitHistoryProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [diff, setDiff] = useState<GitDiffFile[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [rollbackHash, setRollbackHash] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const api = useCallback(
    (path: string) => `/api/projects/${encodeURIComponent(projectName)}/git/${path}`,
    [projectName]
  );

  const fetchCommits = useCallback(async (loadMore = false) => {
    try {
      const newOffset = loadMore ? offset + 30 : 0;
      const res = await fetch(api(`commits?limit=30&offset=${newOffset}`));
      if (res.ok) {
        const data = await res.json();
        if (loadMore) {
          setCommits((prev) => [...prev, ...data]);
        } else {
          setCommits(data);
        }
        setOffset(newOffset);
        setHasMore(data.length === 30);
      }
    } catch {} finally { setLoading(false); }
  }, [api, offset]);

  useEffect(() => { fetchCommits(); }, []);// eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCommit = async (hash: string) => {
    if (selectedHash === hash) {
      setSelectedHash(null);
      setDiff([]);
      return;
    }
    setSelectedHash(hash);
    setLoadingDiff(true);
    try {
      const res = await fetch(api(`commits/${hash}`));
      if (res.ok) setDiff(await res.json());
    } catch {} finally { setLoadingDiff(false); }
  };

  const handleRevert = async (hash: string) => {
    try {
      const res = await fetch(api(`commits/${hash}/revert`), { method: "POST" });
      if (res.ok) { toast.success("Commit reverted"); fetchCommits(); }
      else { const d = await res.json(); toast.error(d.error || "Revert failed"); }
    } catch { toast.error("Revert failed"); }
  };

  const handleReset = async (hash: string) => {
    try {
      const res = await fetch(api(`commits/${hash}/reset`), { method: "POST" });
      if (res.ok) { toast.success("Reset complete (snapshot created)"); fetchCommits(); }
      else { const d = await res.json(); toast.error(d.error || "Reset failed"); }
    } catch { toast.error("Reset failed"); }
  };

  if (loading) return <div className="h-32 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Commit History</span>
        <Badge variant="outline" className="text-xs">{commits.length}+</Badge>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {commits.map((c) => (
          <div key={c.hash}>
            <button
              type="button"
              onClick={() => handleSelectCommit(c.hash)}
              className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-all ${
                selectedHash === c.hash ? "bg-foreground/5 border border-foreground/10" : "bg-muted hover:bg-muted/80"
              }`}
            >
              <span className="font-mono text-muted-foreground shrink-0">{c.shortHash}</span>
              <span className="flex-1 truncate">{c.message}</span>
              <span className="text-muted-foreground shrink-0 hidden sm:inline">{c.author}</span>
              <span className="text-muted-foreground shrink-0 text-[10px]">
                {new Date(c.date).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleRevert(c.hash)}
                  className="text-muted-foreground hover:text-amber-500"
                  title="Revert (safe)"
                >
                  <RotateCcw className="size-3" />
                </button>
                <button
                  onClick={() => setRollbackHash(c.hash)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Reset to here (destructive)"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </button>

            {selectedHash === c.hash && (
              <div className="mt-1 ml-4">
                {loadingDiff ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading diff...
                  </div>
                ) : (
                  <DiffViewer files={diff} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <Button size="sm" variant="outline" onClick={() => fetchCommits(true)} className="w-full text-xs">
          Load more
        </Button>
      )}

      <RollbackDialog
        open={!!rollbackHash}
        onOpenChange={(v) => !v && setRollbackHash(null)}
        hash={rollbackHash || ""}
        onConfirm={() => { if (rollbackHash) handleReset(rollbackHash); setRollbackHash(null); }}
      />
    </div>
  );
}
