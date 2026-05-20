import { runCommand, sanitizeName, getProjectPath } from "./shell";
import { registerProjectDirectory } from "./files";
import { getProjectMeta } from "./projects";
import type { SessionStatus, SessionState, NamedSession } from "./types";

function sessionName(projectName: string, session?: string): string {
  const base = `claude-${sanitizeName(projectName)}`;
  if (!session || session === "default") return base;
  return `${base}--${sanitizeName(session)}`;
}

export async function listTmuxSessions(): Promise<string[]> {
  try {
    const { stdout } = await runCommand('tmux list-sessions -F "#{session_name}" 2>/dev/null');
    return stdout.split("\n").filter((s) => s.startsWith("claude-"));
  } catch {
    return [];
  }
}

export async function capturePaneOutput(session: string): Promise<string> {
  try {
    const { stdout } = await runCommand(
      `tmux capture-pane -t ${session} -p -S - 2>/dev/null`
    );
    return stdout;
  } catch {
    return "";
  }
}

export function parseBridgeUrl(output: string): string | null {
  const match = output.match(/https:\/\/claude\.ai\/code\?bridge=env_\w+/);
  return match ? match[0] : null;
}

export function parseSessionState(output: string, sessionExists: boolean): SessionState {
  if (!sessionExists) return "stopped";
  const bridgeUrl = parseBridgeUrl(output);
  if (bridgeUrl) return "running";
  return "starting";
}

/**
 * Extract the display name from a tmux session name.
 * "claude-myproject" → "default"
 * "claude-myproject--refactor" → "refactor"
 */
function parseDisplayName(tmuxName: string, projectBase: string): string {
  if (tmuxName === projectBase) return "default";
  const prefix = `${projectBase}--`;
  if (tmuxName.startsWith(prefix)) return tmuxName.slice(prefix.length);
  return tmuxName;
}

/**
 * List all sessions belonging to a project, returning NamedSession[] with state and bridgeUrl.
 */
export async function listProjectSessions(
  projectName: string,
  activeSessions?: string[]
): Promise<NamedSession[]> {
  const sessions = activeSessions ?? await listTmuxSessions();
  const base = sessionName(projectName);
  const matching = sessions.filter(
    (s) => s === base || s.startsWith(`${base}--`)
  );

  const results: NamedSession[] = await Promise.all(
    matching.map(async (tmuxName) => {
      const output = await capturePaneOutput(tmuxName);
      const state = parseSessionState(output, true);
      const bridgeUrl = parseBridgeUrl(output);
      return {
        name: parseDisplayName(tmuxName, base),
        state,
        bridgeUrl,
      };
    })
  );

  return results;
}

const STATE_PRIORITY: Record<SessionState, number> = {
  running: 2,
  starting: 1,
  stopped: 0,
};

export async function getAllSessionStatuses(projectNames: string[]): Promise<SessionStatus[]> {
  const activeSessions = await listTmuxSessions();

  const statuses: SessionStatus[] = await Promise.all(
    projectNames.map(async (name) => {
      const sessions = await listProjectSessions(name, activeSessions);

      // If no tmux sessions exist, return default stopped state
      if (sessions.length === 0) {
        return {
          projectName: name,
          state: "stopped" as SessionState,
          bridgeUrl: null,
          sessions: [],
        };
      }

      // Aggregate: best state across all sessions
      const bestState = sessions.reduce<SessionState>(
        (best, s) => (STATE_PRIORITY[s.state] > STATE_PRIORITY[best] ? s.state : best),
        "stopped"
      );

      // Default session's bridgeUrl for backward compat
      const defaultSession = sessions.find((s) => s.name === "default");
      const bridgeUrl = defaultSession?.bridgeUrl ?? null;

      return { projectName: name, state: bestState, bridgeUrl, sessions };
    })
  );

  return statuses;
}

export async function startSession(projectName: string, session?: string): Promise<void> {
  const sName = sessionName(projectName, session);
  const projectPath = getProjectPath(projectName);

  // Register the project directory so claude skips the trust prompt
  await registerProjectDirectory(projectPath);

  // Kill existing session if any
  try {
    await runCommand(`tmux kill-session -t ${sName} 2>/dev/null`);
  } catch {
    // session didn't exist
  }

  const meta = await getProjectMeta(projectName);
  const permFlag = meta.autoAccept ? " --permission-mode bypassPermissions" : "";

  await runCommand(
    `tmux new-session -d -s ${sName} -c "${projectPath}" "claude remote-control --name ${sanitizeName(projectName)} --spawn=same-dir${permFlag}"`,
    { timeout: 5000 }
  );
}

export async function stopSession(projectName: string, session?: string): Promise<void> {
  const sName = sessionName(projectName, session);
  await runCommand(`tmux kill-session -t ${sName}`);
}
