import { runCommand, getProjectPath } from "./shell";
import type { GitBranch, GitCommit, GitDiffFile, GitStash, GitSnapshot } from "./types";

const GIT_TIMEOUT = 30000;

function opts(name: string, timeout?: number) {
  return { cwd: getProjectPath(name), timeout: timeout ?? GIT_TIMEOUT };
}

// Branches

export async function listBranches(name: string): Promise<GitBranch[]> {
  try {
    const { stdout } = await runCommand(
      `git branch --format='%(refname:short)|%(HEAD)|%(committerdate:iso)|%(subject)' --sort=-committerdate`,
      opts(name)
    );
    if (!stdout.trim()) return [];
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [branchName, head, date, ...msgParts] = line.split("|");
      return {
        name: branchName.trim(),
        current: head.trim() === "*",
        lastCommitDate: date.trim(),
        lastCommitMessage: msgParts.join("|").trim(),
      };
    });
  } catch {
    return [];
  }
}

export async function createBranch(
  name: string,
  branchName: string,
  startPoint?: string
): Promise<void> {
  const cmd = startPoint
    ? `git checkout -b "${branchName}" "${startPoint}"`
    : `git checkout -b "${branchName}"`;
  await runCommand(cmd, opts(name));
}

export async function switchBranch(name: string, branch: string): Promise<void> {
  await runCommand(`git checkout "${branch}"`, opts(name));
}

export async function mergeBranch(name: string, source: string): Promise<string> {
  const { stdout } = await runCommand(`git merge "${source}" --no-edit`, opts(name, 60000));
  return stdout;
}

export async function deleteBranch(name: string, branch: string): Promise<void> {
  await runCommand(`git branch -d "${branch}"`, opts(name));
}

// Commits

export async function getCommitHistory(
  name: string,
  limit = 30,
  offset = 0
): Promise<GitCommit[]> {
  try {
    const { stdout } = await runCommand(
      `git log --format='%H|%h|%s|%an|%aI' --skip=${offset} -${limit}`,
      opts(name)
    );
    if (!stdout.trim()) return [];
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [hash, shortHash, message, author, date] = line.split("|");
      return { hash, shortHash, message, author, date };
    });
  } catch {
    return [];
  }
}

export async function getCommitDiff(name: string, hash: string): Promise<GitDiffFile[]> {
  try {
    // Get stat for file summary
    const { stdout: stat } = await runCommand(
      `git diff "${hash}"~1.."${hash}" --numstat`,
      opts(name)
    );
    // Get patch for diff content
    const { stdout: patch } = await runCommand(
      `git diff "${hash}"~1.."${hash}" --patch`,
      opts(name, 60000)
    );

    const files: GitDiffFile[] = [];
    const statLines = stat.split("\n").filter(Boolean);

    // Parse per-file patches
    const filePatchMap = new Map<string, string>();
    const patchParts = patch.split(/^diff --git /m).filter(Boolean);
    for (const part of patchParts) {
      const firstNewline = part.indexOf("\n");
      const header = part.substring(0, firstNewline);
      const match = header.match(/b\/(.+)$/);
      if (match) {
        filePatchMap.set(match[1], part.substring(firstNewline));
      }
    }

    for (const line of statLines) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const filePath = parts[2];
        const status = additions > 0 && deletions === 0 ? "added"
          : additions === 0 && deletions > 0 ? "deleted"
          : "modified";

        files.push({
          path: filePath,
          status: status as GitDiffFile["status"],
          additions,
          deletions,
          patch: filePatchMap.get(filePath) || "",
        });
      }
    }

    return files;
  } catch {
    return [];
  }
}

// Rollback

export async function revertCommit(name: string, hash: string): Promise<string> {
  const { stdout } = await runCommand(`git revert --no-edit "${hash}"`, opts(name));
  return stdout;
}

export async function resetToCommit(name: string, hash: string): Promise<string> {
  // Auto-create snapshot before destructive operation
  await createSnapshot(name, `Auto-backup before reset to ${hash.substring(0, 7)}`);
  const { stdout } = await runCommand(`git reset --hard "${hash}"`, opts(name));
  return stdout;
}

// Stashes

export async function listStashes(name: string): Promise<GitStash[]> {
  try {
    const { stdout } = await runCommand(
      `git stash list --format='%gd|%gs|%aI'`,
      opts(name)
    );
    if (!stdout.trim()) return [];
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [ref, message, date] = line.split("|");
      const indexMatch = ref.match(/\{(\d+)\}/);
      return {
        index: indexMatch ? parseInt(indexMatch[1]) : 0,
        message: message || "",
        date: date || "",
      };
    });
  } catch {
    return [];
  }
}

export async function stashChanges(name: string, message?: string): Promise<void> {
  const cmd = message
    ? `git stash push -m "${message}"`
    : "git stash push";
  await runCommand(cmd, opts(name));
}

export async function popStash(name: string, index: number): Promise<void> {
  await runCommand(`git stash pop stash@{${index}}`, opts(name));
}

export async function applyStash(name: string, index: number): Promise<void> {
  await runCommand(`git stash apply stash@{${index}}`, opts(name));
}

export async function dropStash(name: string, index: number): Promise<void> {
  await runCommand(`git stash drop stash@{${index}}`, opts(name));
}

// Cherry-Pick

export async function cherryPick(name: string, hash: string): Promise<string> {
  const { stdout } = await runCommand(`git cherry-pick "${hash}"`, opts(name));
  return stdout;
}

// Snapshots

export async function createSnapshot(name: string, description: string): Promise<string> {
  const timestamp = Date.now();
  const tag = `snapshot-${timestamp}`;
  await runCommand(
    `git tag -a "${tag}" -m "${description.replace(/"/g, '\\"')}"`,
    opts(name)
  );
  return tag;
}

export async function listSnapshots(name: string): Promise<GitSnapshot[]> {
  try {
    const { stdout } = await runCommand(
      `git tag -l 'snapshot-*' --sort=-creatordate --format='%(refname:short)|%(subject)|%(creatordate:iso)|%(objectname:short)'`,
      opts(name)
    );
    if (!stdout.trim()) return [];
    return stdout.split("\n").filter(Boolean).map((line) => {
      const [tag, description, date, hash] = line.split("|");
      return { tag, description, date, hash };
    });
  } catch {
    return [];
  }
}

export async function restoreSnapshot(name: string, tag: string): Promise<void> {
  // Auto-snapshot current state before restoring
  await createSnapshot(name, `Auto-backup before restoring ${tag}`);
  await runCommand(`git checkout "${tag}"`, opts(name));
}
