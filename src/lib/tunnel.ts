import { runCommand, sanitizeName } from "./shell";

function tunnelSessionName(projectName: string): string {
  return `tunnel-${sanitizeName(projectName)}`;
}

export async function startTunnel(
  projectName: string,
  port: number,
  tunnelToken: string
): Promise<void> {
  const session = tunnelSessionName(projectName);

  // Kill existing tunnel session if any
  try {
    await runCommand(`tmux kill-session -t ${session} 2>/dev/null`);
  } catch {
    // ignore
  }

  // Start cloudflared in a tmux session
  const cmd = `cloudflared tunnel run --token "${tunnelToken}" --url http://localhost:${port}`;
  await runCommand(
    `tmux new-session -d -s ${session} '${cmd}'`,
    { timeout: 10000 }
  );
}

export async function stopTunnel(projectName: string): Promise<void> {
  const session = tunnelSessionName(projectName);
  try {
    await runCommand(`tmux kill-session -t ${session} 2>/dev/null`);
  } catch {
    // ignore if not running
  }
}

export async function getTunnelStatus(
  projectName: string
): Promise<"running" | "stopped"> {
  const session = tunnelSessionName(projectName);
  try {
    const { stdout } = await runCommand(
      `tmux has-session -t ${session} 2>/dev/null && echo running || echo stopped`
    );
    return stdout.includes("running") ? "running" : "stopped";
  } catch {
    return "stopped";
  }
}
