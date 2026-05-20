"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GitDiffFile } from "@/lib/types";

interface DiffViewerProps {
  files: GitDiffFile[];
}

export function DiffViewer({ files }: DiffViewerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No changes</p>;
  }

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "added": return "text-green-500 border-green-500/30";
      case "deleted": return "text-red-500 border-red-500/30";
      case "modified": return "text-amber-500 border-amber-500/30";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <span>{files.length} file{files.length !== 1 ? "s" : ""} changed</span>
        <span className="text-green-500">+{files.reduce((s, f) => s + f.additions, 0)}</span>
        <span className="text-red-500">-{files.reduce((s, f) => s + f.deletions, 0)}</span>
      </div>
      {files.map((f) => (
        <div key={f.path} className="rounded border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(f.path)}
            className="w-full flex items-center gap-2 px-2 py-1 bg-muted hover:bg-muted/80 text-left"
          >
            {expanded.has(f.path) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <Badge variant="outline" className={`text-[9px] ${statusColor(f.status)}`}>{f.status[0].toUpperCase()}</Badge>
            <span className="font-mono truncate flex-1">{f.path}</span>
            <span className="text-green-500">+{f.additions}</span>
            <span className="text-red-500">-{f.deletions}</span>
          </button>
          {expanded.has(f.path) && f.patch && (
            <pre className="overflow-x-auto p-2 text-[11px] leading-relaxed bg-background">
              {f.patch.split("\n").map((line, i) => {
                const color = line.startsWith("+") ? "text-green-400 bg-green-500/10"
                  : line.startsWith("-") ? "text-red-400 bg-red-500/10"
                  : line.startsWith("@@") ? "text-blue-400 bg-blue-500/5"
                  : "text-muted-foreground";
                return (
                  <div key={i} className={`${color} px-1 whitespace-pre`}>{line}</div>
                );
              })}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
