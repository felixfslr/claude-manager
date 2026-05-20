"use client";
import { CreateProjectDialog } from "./create-project-dialog";

interface HeaderProps {
  onProjectCreated: () => void;
}

export function Header({ onProjectCreated }: HeaderProps) {
  return (
    <header className="flex items-center justify-between pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Manage Claude Code remote sessions
        </p>
      </div>
      <CreateProjectDialog onCreated={onProjectCreated} />
    </header>
  );
}
