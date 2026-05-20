import { NextRequest, NextResponse } from "next/server";
import { discoverProjects, createProject } from "@/lib/projects";
import { sanitizeName } from "@/lib/shell";
import { createGithubRepo, initAndPushToGithub } from "@/lib/github";
import type { StackConfig } from "@/lib/types";

export async function GET() {
  try {
    const projects = await discoverProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, gitCloneUrl, stack, createRepo, repoPrivate, branch, useLatestDependencies } = (await request.json()) as {
      name: string;
      gitCloneUrl?: string;
      stack?: StackConfig;
      createRepo?: boolean;
      repoPrivate?: boolean;
      branch?: string;
      useLatestDependencies?: boolean;
    };

    sanitizeName(name);
    const project = await createProject(
      name,
      gitCloneUrl,
      stack,
      branch,
      useLatestDependencies ?? true
    );

    // Handle GitHub repo creation if requested
    let githubError: string | undefined;
    if (createRepo && !gitCloneUrl) {
      try {
        const repo = await createGithubRepo(name, repoPrivate ?? true);
        await initAndPushToGithub(name, repo.clone_url);
        project.gitRemote = repo.clone_url;
      } catch (e) {
        githubError = e instanceof Error ? e.message : "GitHub repo creation failed";
      }
    }

    return NextResponse.json(
      { ...project, githubError },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 400 }
    );
  }
}
