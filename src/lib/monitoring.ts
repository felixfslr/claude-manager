import { runCommand } from "./shell";

interface ProcessStats {
  name: string;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "error" | "warn";
  message: string;
}

export async function getPm2Processes(): Promise<ProcessStats[]> {
  try {
    const { stdout } = await runCommand("pm2 jlist", { timeout: 10000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const procs: any[] = JSON.parse(stdout);
    return procs.map((p) => ({
      name: p.name,
      status: p.pm2_env?.status || "unknown",
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
    }));
  } catch {
    return [];
  }
}

export async function getPm2Logs(processName: string, lines = 50): Promise<LogEntry[]> {
  try {
    const { stdout } = await runCommand(
      `pm2 logs "${processName}" --nostream --lines ${lines} 2>&1 || true`,
      { timeout: 10000 }
    );
    return stdout.split("\n").filter(Boolean).map((line) => {
      const isError = line.includes("ERROR") || line.includes("Error") || line.includes("error");
      const isWarn = line.includes("WARN") || line.includes("warn");
      return {
        timestamp: new Date().toISOString(),
        level: isError ? "error" as const : isWarn ? "warn" as const : "info" as const,
        message: line,
      };
    });
  } catch {
    return [];
  }
}

export async function getErrorCount(processName: string): Promise<number> {
  const logs = await getPm2Logs(processName, 200);
  return logs.filter((l) => l.level === "error").length;
}

export { type ProcessStats, type LogEntry };
