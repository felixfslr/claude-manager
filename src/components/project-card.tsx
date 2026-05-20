"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { StatusBadge } from "./status-badge";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { formatRelativeTime } from "@/lib/utils";
import type { Project, SessionStatus } from "@/lib/types";
import {
  Play,
  Square,
  RotateCw,
  GitBranch,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface ProjectCardProps {
  project: Project;
  session: SessionStatus | undefined;
  onAction: (name: string, action: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export function ProjectCard({
  project,
  session,
  onAction,
  onDelete,
}: ProjectCardProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const state = session?.state ?? "stopped";

  const handleAction = async (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    setActionLoading(action);
    try {
      await onAction(project.name, action);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card
      className="flex flex-col cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => router.push(`/dashboard/${encodeURIComponent(project.name)}`)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="text-sm font-semibold truncate">{project.name}</h3>
          {project.currentBranch && (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground rounded-md bg-muted/50 px-1.5 py-0.5">
              <GitBranch className="size-3" />
              <span className="truncate">{project.currentBranch}</span>
            </div>
          )}
        </div>
        <StatusBadge state={state} />
      </CardHeader>
      <CardContent className="flex-1 space-y-1.5 pt-0">
        {project.gitRemote && (
          <a
            href={project.gitRemote.replace(/\.git$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">
              {project.gitRemote
                .replace(/\.git$/, "")
                .replace(/^https?:\/\/github\.com\//, "")}
            </span>
          </a>
        )}
        {project.lastActivity && (
          <p className="text-xs text-muted-foreground">
            Active {formatRelativeTime(project.lastActivity)}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-1 pt-0">
        {state === "stopped" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={(e) => handleAction(e, "start")}
                  disabled={actionLoading !== null}
                />
              }
            >
              <Play className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Start session</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={(e) => handleAction(e, "stop")}
                    disabled={actionLoading !== null}
                  />
                }
              >
                <Square className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Stop session</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={(e) => handleAction(e, "restart")}
                    disabled={actionLoading !== null}
                  />
                }
              >
                <RotateCw className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Restart session</TooltipContent>
            </Tooltip>
          </>
        )}
        <div className="flex-1" />
        <div onClick={(e) => e.stopPropagation()}>
          <DeleteProjectDialog
            projectName={project.name}
            onConfirm={() => onDelete(project.name)}
            trigger={
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive hover:bg-accent"
                    />
                  }
                >
                  <Trash2 className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Delete project</TooltipContent>
              </Tooltip>
            }
          />
        </div>
      </CardFooter>
    </Card>
  );
}
