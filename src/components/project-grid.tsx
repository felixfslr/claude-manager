"use client";
import { ProjectCard } from "./project-card";
import { EmptyState } from "./empty-state";
import type { Project, SessionStatus } from "@/lib/types";

interface ProjectGridProps {
  projects: Project[];
  sessions: SessionStatus[];
  onAction: (name: string, action: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export function ProjectGrid({
  projects,
  sessions,
  onAction,
  onDelete,
}: ProjectGridProps) {
  if (projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.name}
          project={project}
          session={sessions.find((s) => s.projectName === project.name)}
          onAction={onAction}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
