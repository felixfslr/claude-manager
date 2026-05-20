"use client";

import { usePolling } from "@/hooks/use-polling";
import { formatUptime, formatBytes } from "@/lib/utils";
import type { ServerStats } from "@/lib/types";
import { Cpu, HardDrive, Clock } from "lucide-react";

function getProgressColor(percent: number) {
  if (percent >= 80) return "progress-red";
  if (percent >= 50) return "progress-amber";
  return "progress-green";
}

export function ServerStatsWidget() {
  const { data: stats } = usePolling<ServerStats>("/api/server/stats", 5000);

  if (!stats) {
    return (
      <div className="space-y-3 px-3 py-2">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const memUsedPercent = Math.round(
    ((stats.totalMem - stats.freeMem) / stats.totalMem) * 100
  );
  const cpuLoad = Math.min(
    Math.round((stats.loadAvg[0] / stats.cpuCount) * 100),
    100
  );

  return (
    <div className="space-y-3 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        <span>Uptime: {formatUptime(stats.uptime)}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cpu className="size-3.5" />
          <span>CPU</span>
          <span className="ml-auto tabular-nums">{cpuLoad}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className={`h-full rounded-full ${getProgressColor(cpuLoad)} transition-all duration-500`}
            style={{ width: `${cpuLoad}%` }}
          />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="size-3.5" />
          <span>RAM</span>
          <span className="ml-auto tabular-nums">
            {formatBytes(stats.totalMem - stats.freeMem)} /{" "}
            {formatBytes(stats.totalMem)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className={`h-full rounded-full ${getProgressColor(memUsedPercent)} transition-all duration-500`}
            style={{ width: `${memUsedPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
