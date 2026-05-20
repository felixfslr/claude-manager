"use client";
import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { OverviewTab } from "@/components/project-detail/overview-tab";
import { TerminalTab } from "@/components/project-detail/terminal-tab";
import { FilesTab } from "@/components/project-detail/files-tab";
import { GitHubTab } from "@/components/project-detail/github-tab";
import { IntegrationsTab } from "@/components/project-detail/integrations-tab";
import { HostingTab } from "@/components/project-detail/hosting-tab";
import { GitTab } from "@/components/project-detail/git-tab";
import { DependenciesTab } from "@/components/project-detail/dependencies-tab";
import { CiCdTab } from "@/components/project-detail/cicd-tab";
import { usePolling } from "@/hooks/use-polling";
import type { Project, SessionStatus } from "@/lib/types";
import {
  ArrowLeft,
  Activity,
  TerminalSquare,
  FolderTree,
  Github,
  Puzzle,
  Cloud,
  GitBranch,
  Package,
  Workflow,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectName: string }>;
}) {
  const { projectName } = use(params);
  const decodedName = decodeURIComponent(projectName);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: sessions } = usePolling<SessionStatus[]>("/api/sessions", 3000);
  const session = sessions?.find((s) => s.projectName === decodedName);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const projects: Project[] = await res.json();
        setProject(projects.find((p) => p.name === decodedName) ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [decodedName]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded" />
          <div className="h-64 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <p className="text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <StatusBadge state={session?.state ?? "stopped"} />
        <div className="ml-auto">
          <Button
            size="sm"
            variant="default"
            render={<Link href={`/dashboard/${encodeURIComponent(project.name)}/headless`} />}
          >
            <Bot className="size-3.5" data-icon="inline-start" />
            Headless Claude
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            <Activity className="size-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="terminal">
            <TerminalSquare className="size-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </TabsTrigger>
          <TabsTrigger value="files">
            <FolderTree className="size-3.5" />
            <span className="hidden sm:inline">Files</span>
          </TabsTrigger>
          <TabsTrigger value="git">
            <GitBranch className="size-3.5" />
            <span className="hidden sm:inline">Git</span>
          </TabsTrigger>
          <TabsTrigger value="github">
            <Github className="size-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </TabsTrigger>
          <TabsTrigger value="deps">
            <Package className="size-3.5" />
            <span className="hidden sm:inline">Deps</span>
          </TabsTrigger>
          <TabsTrigger value="hosting">
            <Cloud className="size-3.5" />
            <span className="hidden sm:inline">Hosting</span>
          </TabsTrigger>
          <TabsTrigger value="cicd">
            <Workflow className="size-3.5" />
            <span className="hidden sm:inline">CI/CD</span>
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Puzzle className="size-3.5" />
            <span className="hidden sm:inline">Integr.</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewTab project={project} session={session} />
        </TabsContent>
        <TabsContent value="terminal" className="mt-6">
          <TerminalTab
            projectName={project.name}
            sessionState={session?.state ?? "stopped"}
          />
        </TabsContent>
        <TabsContent value="files" className="mt-6">
          <FilesTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="git" className="mt-6">
          <GitTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="github" className="mt-6">
          <GitHubTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="deps" className="mt-6">
          <DependenciesTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="hosting" className="mt-6">
          <HostingTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="cicd" className="mt-6">
          <CiCdTab projectName={project.name} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab projectName={project.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
