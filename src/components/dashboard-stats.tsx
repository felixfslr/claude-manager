"use client";
import { FolderKanban, Activity, CircleStop } from "lucide-react";
import type { Project, SessionStatus } from "@/lib/types";

interface DashboardStatsProps {
  projects: Project[];
  sessions: SessionStatus[];
}

export function DashboardStats({ projects, sessions }: DashboardStatsProps) {
  const running = sessions.filter((s) => s.state === "running").length;
  const stopped = sessions.filter((s) => s.state === "stopped").length;

  const stats = [
    {
      label: "Total Projects",
      value: projects.length,
      icon: FolderKanban,
    },
    {
      label: "Active Sessions",
      value: running,
      icon: Activity,
    },
    {
      label: "Stopped",
      value: stopped,
      icon: CircleStop,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border p-4 flex items-center gap-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <stat.icon className="size-4" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
