"use client";
import { AlertTriangle } from "lucide-react";
import type { PermissionMode } from "@/lib/headless-types";

export function PermissionModeWarning({ mode }: { mode: PermissionMode }) {
  if (mode !== "bypassPermissions") return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
      <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        <div className="font-medium">Bypass permissions is enabled</div>
        <div className="opacity-90">
          Claude can read, write, and execute anything inside this project without prompting.
          Only use on machines you trust.
        </div>
      </div>
    </div>
  );
}
