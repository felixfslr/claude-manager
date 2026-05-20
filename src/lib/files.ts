import fs from "fs/promises";
import path from "path";
import type { FileTreeNode, FileTreeResult } from "./types";

const CLAUDE_GLOBAL_CONFIG = path.join(
  process.env.HOME || "/home/felix",
  ".claude.json"
);

/**
 * Mark a project directory as trusted in Claude's global config (~/.claude.json)
 * so that `claude remote-control` can start without the interactive trust prompt.
 */
export async function registerProjectDirectory(
  projectPath: string
): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(CLAUDE_GLOBAL_CONFIG, "utf-8");
    config = JSON.parse(raw);
  } catch {
    // file missing or invalid – start fresh
  }

  const projects = (config.projects ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const existing = projects[projectPath];

  if (existing?.hasTrustDialogAccepted) return; // already trusted

  projects[projectPath] = {
    ...existing,
    hasTrustDialogAccepted: true,
  };
  config.projects = projects;

  await fs.writeFile(CLAUDE_GLOBAL_CONFIG, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

async function walkDir(
  dirPath: string,
  depth: number,
  maxDepth: number
): Promise<{ nodes: FileTreeNode[]; fileCount: number; totalSize: number }> {
  let fileCount = 0;
  let totalSize = 0;
  const nodes: FileTreeNode[] = [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return { nodes, fileCount, totalSize };
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const node: FileTreeNode = { name: entry.name, type: "directory" };
      if (depth < maxDepth) {
        const sub = await walkDir(fullPath, depth + 1, maxDepth);
        node.children = sub.nodes;
        fileCount += sub.fileCount;
        totalSize += sub.totalSize;
      }
      nodes.push(node);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(fullPath);
        nodes.push({ name: entry.name, type: "file", size: stat.size });
        fileCount++;
        totalSize += stat.size;
      } catch {
        nodes.push({ name: entry.name, type: "file", size: 0 });
        fileCount++;
      }
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { nodes, fileCount, totalSize };
}

export async function getDirectoryTree(projectPath: string): Promise<FileTreeResult> {
  const { nodes, fileCount, totalSize } = await walkDir(projectPath, 0, 2);
  return { tree: nodes, fileCount, totalSize };
}
