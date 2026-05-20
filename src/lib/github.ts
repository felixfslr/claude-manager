import { runCommand, getProjectPath } from "./shell";
import { getToken } from "./settings";
import type { GitHubInfo, GitHubRepo, GitHubBranch } from "./types";

async function getGithubToken(): Promise<string> {
  const token = await getToken("githubToken");
  if (!token) throw new Error("GitHub token not configured");
  return token;
}

// List authenticated user's repos
export async function listUserRepos(page = 1, perPage = 30): Promise<GitHubRepo[]> {
  const token = await getGithubToken();
  const res = await fetch(
    `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}&affiliation=owner,collaborator`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error("Failed to list repos");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repos: any[] = await res.json();
  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    clone_url: r.clone_url,
    updated_at: r.updated_at,
    language: r.language,
    default_branch: r.default_branch,
  }));
}

// List branches for a repo
export async function listRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  const token = await getGithubToken();
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error("Failed to list branches");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branches: any[] = await res.json();
  return branches.map((b) => ({ name: b.name, protected: b.protected }));
}

interface CreateRepoResult {
  html_url: string;
  ssh_url: string;
  clone_url: string;
}

function extractOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  // Handle HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  return null;
}

export async function getRepoInfo(remoteUrl: string): Promise<GitHubInfo> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const parsed = extractOwnerRepo(remoteUrl);
  if (!parsed) throw new Error("Could not parse GitHub remote URL");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  const repoRes = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers }
  );
  if (!repoRes.ok) throw new Error("Failed to fetch repo info");
  const repo = await repoRes.json();

  // Get last commit
  let lastCommit: GitHubInfo["lastCommit"] = null;
  try {
    const commitsRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=1`,
      { headers }
    );
    if (commitsRes.ok) {
      const commits = await commitsRes.json();
      if (commits.length > 0) {
        lastCommit = {
          message: commits[0].commit.message.split("\n")[0],
          author: commits[0].commit.author.name,
          date: commits[0].commit.author.date,
        };
      }
    }
  } catch {
    // ignore
  }

  // Get open PR count
  let openPrCount = 0;
  try {
    const prRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls?state=open&per_page=1`,
      { headers }
    );
    if (prRes.ok) {
      const linkHeader = prRes.headers.get("link");
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        openPrCount = lastMatch ? parseInt(lastMatch[1]) : 1;
      } else {
        const prs = await prRes.json();
        openPrCount = prs.length;
      }
    }
  } catch {
    // ignore
  }

  return {
    repoName: repo.full_name,
    visibility: repo.private ? "private" : "public",
    defaultBranch: repo.default_branch,
    lastCommit,
    openPrCount,
    htmlUrl: repo.html_url,
  };
}

export async function createGithubRepo(
  name: string,
  isPrivate: boolean = false
): Promise<CreateRepoResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");

  const response = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create GitHub repo");
  }

  return response.json();
}

export async function initAndPushToGithub(
  projectName: string,
  repoUrl: string
): Promise<void> {
  const projectPath = getProjectPath(projectName);

  const opts = { cwd: projectPath, timeout: 30000 };

  await runCommand("git init", opts);

  // Set remote, handling case where origin already exists
  try {
    await runCommand(`git remote add origin "${repoUrl}"`, opts);
  } catch {
    await runCommand(`git remote set-url origin "${repoUrl}"`, opts);
  }

  await runCommand("git add -A", opts);
  await runCommand('git commit -m "Initial commit" --allow-empty', opts);
  await runCommand("git branch -M main", opts);
  await runCommand("git push -u origin main", opts);
}
