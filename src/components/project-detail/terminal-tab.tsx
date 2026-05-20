"use client";
import { useRef, useState } from "react";
import { useTerminal } from "@/hooks/use-terminal";
import { usePolling } from "@/hooks/use-polling";
import { Badge } from "@/components/ui/badge";
import type { SessionState, NamedSession } from "@/lib/types";
import { TerminalSquare } from "lucide-react";

interface TerminalTabProps {
  projectName: string;
  sessionState: SessionState;
}

export function TerminalTab({ projectName, sessionState }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const enabled = sessionState !== "stopped";

  const { data: sessions } = usePolling<NamedSession[]>(
    `/api/projects/${encodeURIComponent(projectName)}/sessions`,
    3000
  );

  const [selectedSession, setSelectedSession] = useState<string | undefined>(undefined);
  const activeSessions = (sessions ?? []).filter((s) => s.state !== "stopped");
  const showSelector = activeSessions.length > 1;

  const { status } = useTerminal({
    projectName,
    sessionName: selectedSession,
    enabled,
    containerRef,
  });

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <TerminalSquare className="size-10 opacity-40" />
        <p className="text-sm">Start the session to access the terminal</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showSelector && (
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              value={selectedSession ?? ""}
              onChange={(e) => setSelectedSession(e.target.value || undefined)}
            >
              <option value="">default</option>
              {activeSessions
                .filter((s) => s.name !== "default")
                .map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
          <Badge
            variant={
              status === "connected"
                ? "default"
                : status === "connecting"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {status === "connected"
              ? "Connected"
              : status === "connecting"
                ? "Connecting..."
                : "Disconnected"}
          </Badge>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-96 w-full rounded-md border bg-[#09090b] p-1 overflow-hidden"
      />
    </div>
  );
}
