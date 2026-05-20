"use client";
import { cn } from "@/lib/utils";
import type { SessionState } from "@/lib/types";

const stateConfig: Record<SessionState, { label: string; dotClass: string }> = {
  running: {
    label: "Running",
    dotClass: "bg-green-500",
  },
  starting: {
    label: "Starting",
    dotClass: "bg-amber-500 animate-pulse",
  },
  stopped: { label: "Stopped", dotClass: "bg-zinc-500" },
};

export function StatusBadge({ state }: { state: SessionState }) {
  const config = stateConfig[state];
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5">
      <div className={cn("size-2 rounded-full", config.dotClass)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
