"use client";
// Surfaces a rate-limit failure on a headless run and lets the user arm /
// cancel auto-resume. Pulls its countdown straight from meta fields — the
// ChatThread wrapping it is responsible for re-fetching meta when something
// changes (the POST/DELETE responses trigger thread.refresh()).

import { useState } from "react";
import { AlertTriangle, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/use-tick";
import { formatDuration } from "./run-bits";
import type { HeadlessRunMeta } from "@/lib/headless-types";

interface RateLimitBannerProps {
  projectName: string;
  run: HeadlessRunMeta;
  onChanged: () => void;
}

function formatAbsolute(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function RateLimitBanner({
  projectName,
  run,
  onChanged,
}: RateLimitBannerProps) {
  const [busy, setBusy] = useState<"arming" | "cancelling" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tick every second so the countdown stays live.
  useTick(true, 1000);

  const resumeAt = run.autoResumeAt ?? run.rateLimitResetsAt;
  const scheduled = !!run.autoResumeAt;
  const diffMs = resumeAt ? new Date(resumeAt).getTime() - Date.now() : 0;
  const isPast = diffMs <= 0;

  const armAutoResume = async () => {
    setBusy("arming");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(run.runId)}/auto-resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Empty body → server uses rateLimitResetsAt.
          body: "{}",
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to arm auto-resume");
    } finally {
      setBusy(null);
    }
  };

  const cancelAutoResume = async () => {
    setBusy("cancelling");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(run.runId)}/auto-resume`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Rate limit erreicht
          </div>
          <div className="text-xs text-muted-foreground">
            Claude hat das Nutzungslimit der aktuellen Abrechnungsperiode
            erreicht. Der Run wurde gestoppt.
          </div>
          {run.errorMessage && (
            <div className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">
              {run.errorMessage}
            </div>
          )}
        </div>
      </div>

      {resumeAt && (
        <div className="flex items-center gap-2 text-xs rounded bg-background/60 border border-border p-2">
          <Clock className="size-3.5 text-muted-foreground" />
          <div className="flex-1">
            {scheduled ? (
              isPast ? (
                <span>
                  Auto-resume fällig — wird beim nächsten Scheduler-Tick
                  gestartet (alle 30s).
                </span>
              ) : (
                <span>
                  Auto-resume geplant für{" "}
                  <span className="font-mono">{formatAbsolute(resumeAt)}</span>{" "}
                  — in{" "}
                  <span className="font-mono">{formatDuration(diffMs)}</span>
                </span>
              )
            ) : (
              <span>
                Limit setzt voraussichtlich zurück um{" "}
                <span className="font-mono">{formatAbsolute(resumeAt)}</span>{" "}
                (in <span className="font-mono">{formatDuration(diffMs)}</span>)
              </span>
            )}
          </div>
        </div>
      )}

      {run.autoResumeError && (
        <div className="text-xs text-destructive">
          Letzter Resume-Versuch fehlgeschlagen: {run.autoResumeError}
        </div>
      )}

      {error && <div className="text-xs text-destructive">{error}</div>}

      <div className="flex gap-2 justify-end">
        {scheduled ? (
          <Button
            size="xs"
            variant="outline"
            onClick={cancelAutoResume}
            disabled={busy !== null}
          >
            {busy === "cancelling" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
            Auto-resume abbrechen
          </Button>
        ) : (
          <Button
            size="xs"
            onClick={armAutoResume}
            disabled={busy !== null || !run.claudeSessionId}
            title={
              !run.claudeSessionId
                ? "Run hat keine Session-ID — kann nicht fortgesetzt werden"
                : undefined
            }
          >
            {busy === "arming" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Clock className="size-3" />
            )}
            Auto-resume wenn verfügbar
          </Button>
        )}
      </div>
    </div>
  );
}
