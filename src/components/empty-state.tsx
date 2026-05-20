"use client";
import { FolderPlus } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted border border-border mb-4">
        <FolderPlus className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">No projects yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Click <strong>&quot;New Project&quot;</strong> above to create your first Claude Code remote session.
      </p>
    </div>
  );
}
