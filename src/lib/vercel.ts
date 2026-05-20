import { getToken } from "./settings";
import type { VercelProject, VercelDeployment } from "./types";

const BASE_URL = "https://api.vercel.com";

async function vercelFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getToken("vercelToken");
  if (!token) throw new Error("Vercel token not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Vercel API error: ${res.status}`);
  }

  return res;
}

// Projects

export async function listVercelProjects(): Promise<VercelProject[]> {
  const res = await vercelFetch("/v9/projects?limit=50");
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.projects || []).map((p: any) => {
    const latest = p.latestDeployments?.[0];
    return {
      id: p.id,
      name: p.name,
      framework: p.framework || null,
      latestDeployment: latest
        ? {
            id: latest.id,
            url: latest.url,
            state: latest.readyState || latest.state,
            createdAt: latest.createdAt,
          }
        : undefined,
    };
  });
}

export async function getVercelProject(projectId: string): Promise<VercelProject> {
  const res = await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = await res.json();
  const latest = p.latestDeployments?.[0];
  return {
    id: p.id,
    name: p.name,
    framework: p.framework || null,
    latestDeployment: latest
      ? {
          id: latest.id,
          url: latest.url,
          state: latest.readyState || latest.state,
          createdAt: latest.createdAt,
        }
      : undefined,
  };
}

export async function createVercelProject(
  name: string,
  framework?: string,
  gitRepo?: string
): Promise<VercelProject> {
  const body: Record<string, unknown> = { name };
  if (framework) body.framework = framework;
  if (gitRepo) {
    body.gitRepository = {
      type: "github",
      repo: gitRepo,
    };
  }

  const res = await vercelFetch("/v10/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const p = await res.json();
  return { id: p.id, name: p.name, framework: p.framework || null };
}

// Deployments

export async function triggerDeployment(
  projectId: string,
  target: "production" | "preview" = "production"
): Promise<VercelDeployment> {
  const project = await getVercelProject(projectId);
  const res = await vercelFetch("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: project.name,
      project: projectId,
      target,
    }),
  });
  const d = await res.json();
  return {
    id: d.id,
    url: d.url,
    state: d.readyState || d.state || "QUEUED",
    createdAt: d.createdAt?.toString() || new Date().toISOString(),
  };
}

export async function listDeployments(projectId: string, limit = 10): Promise<VercelDeployment[]> {
  const res = await vercelFetch(
    `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`
  );
  const data = await res.json();
  return (data.deployments || []).map((d: Record<string, unknown>) => ({
    id: d.uid || d.id,
    url: d.url,
    state: d.readyState || d.state,
    createdAt: d.created ? new Date(d.created as number).toISOString() : "",
  }));
}

export async function getDeploymentLogs(deploymentId: string): Promise<string[]> {
  const res = await vercelFetch(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`);
  const events = await res.json();
  return (Array.isArray(events) ? events : []).map(
    (e: Record<string, unknown>) => (e.text as string) || ""
  ).filter(Boolean);
}

// Environment Variables

export interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  target: string[];
  type: string;
}

export async function listEnvVars(projectId: string): Promise<VercelEnvVar[]> {
  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/env`
  );
  const data = await res.json();
  return (data.envs || []).map((e: Record<string, unknown>) => ({
    id: e.id,
    key: e.key,
    value: e.value || "",
    target: e.target || [],
    type: e.type || "encrypted",
  }));
}

export async function setEnvVar(
  projectId: string,
  key: string,
  value: string,
  targets: string[] = ["production", "preview", "development"]
): Promise<void> {
  await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/env`, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      target: targets,
      type: "encrypted",
    }),
  });
}

export async function deleteEnvVar(projectId: string, envId: string): Promise<void> {
  await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`,
    { method: "DELETE" }
  );
}

// Domains

export async function listProjectDomains(
  projectId: string
): Promise<{ name: string; redirect?: string }[]> {
  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains`
  );
  const data = await res.json();
  return (data.domains || []).map((d: Record<string, unknown>) => ({
    name: d.name,
    redirect: d.redirect,
  }));
}

export async function addDomainToProject(
  projectId: string,
  domain: string
): Promise<void> {
  await vercelFetch(
    `/v10/projects/${encodeURIComponent(projectId)}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    }
  );
}

export async function removeDomainFromProject(
  projectId: string,
  domain: string
): Promise<void> {
  await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" }
  );
}
