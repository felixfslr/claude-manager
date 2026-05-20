"use client";
import { useCallback, useState, useEffect } from "react";
import { Header } from "@/components/header";
import { DashboardStats } from "@/components/dashboard-stats";
import { ProjectGrid } from "@/components/project-grid";
import { usePolling } from "@/hooks/use-polling";
import { toast } from "sonner";
import type { Project, SessionStatus } from "@/lib/types";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { data: sessions } = usePolling<SessionStatus[]>("/api/sessions", 3000);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        setProjects(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleAction = async (name: string, action: string) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(`Session ${action}ed: ${name}`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action} session`);
      }
    } catch {
      toast.error(`Failed to ${action} session`);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Deleted: ${name}`);
        await fetchProjects();
      } else {
        toast.error("Failed to delete project");
      }
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <Header onProjectCreated={fetchProjects} />
      <DashboardStats projects={projects} sessions={sessions ?? []} />
      <ProjectGrid
        projects={projects}
        sessions={sessions ?? []}
        onAction={handleAction}
        onDelete={handleDelete}
      />
    </div>
  );
}
