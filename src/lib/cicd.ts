import fs from "fs/promises";
import path from "path";
import { getProjectPath, runCommand } from "./shell";
import { getToken } from "./settings";

interface WorkflowFile {
  name: string;
  path: string;
}

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  headBranch: string;
  htmlUrl: string;
}

export async function listWorkflows(name: string): Promise<WorkflowFile[]> {
  const projectPath = getProjectPath(name);
  const workflowDir = path.join(projectPath, ".github", "workflows");
  try {
    const entries = await fs.readdir(workflowDir);
    return entries
      .filter((e) => e.endsWith(".yml") || e.endsWith(".yaml"))
      .map((e) => ({ name: e, path: `.github/workflows/${e}` }));
  } catch {
    return [];
  }
}

export async function listWorkflowRuns(owner: string, repo: string, limit = 10): Promise<WorkflowRun[]> {
  const token = await getToken("githubToken");
  if (!token) throw new Error("GitHub token not configured");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error("Failed to fetch workflow runs");
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.workflow_runs || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
    headBranch: r.head_branch,
    htmlUrl: r.html_url,
  }));
}

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string,
  ref: string
): Promise<void> {
  const token = await getToken("githubToken");
  if (!token) throw new Error("GitHub token not configured");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    }
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to trigger workflow");
}

export { type WorkflowFile, type WorkflowRun };
