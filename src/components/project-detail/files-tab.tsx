"use client";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/utils";
import type { FileTreeNode, FileTreeResult } from "@/lib/types";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";

interface FilesTabProps {
  projectName: string;
}

function FileNode({
  node,
  depth,
}: {
  node: FileTreeNode;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === "file") {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-sm transition-colors"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <File className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 shrink-0">
            {formatBytes(node.size)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 py-0.5 text-xs text-foreground hover:bg-accent/30 rounded-sm transition-colors"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children?.map((child) => (
          <FileNode key={child.name} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function FilesTab({ projectName }: FilesTabProps) {
  const [data, setData] = useState<FileTreeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectName)}/files`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectName]);

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: `${60 + i * 8}%` }}
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {error || "Could not load file tree."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{data.fileCount} files</span>
        <span>{formatBytes(data.totalSize)}</span>
      </div>
      <div className="rounded-md border border-border p-2 max-h-80 overflow-y-auto">
        {data.tree.map((node) => (
          <FileNode key={node.name} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}
