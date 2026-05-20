"use client";
import { Badge } from "@/components/ui/badge";
import type { HeadlessRunStatus, PermissionMode } from "@/lib/headless-types";

const STATUS_LABELS: Record<HeadlessRunStatus, string> = {
  pending: "pending",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  orphaned: "orphaned",
};

export function StatusPill({ status }: { status: HeadlessRunStatus }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed" || status === "cancelled" || status === "orphaned"
      ? "destructive"
      : status === "running" || status === "pending"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PermissionBadge({ mode }: { mode: PermissionMode }) {
  if (mode === "bypassPermissions") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        bypass
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {mode}
    </Badge>
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function formatTokens(n: number | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format a millisecond duration as "1h 02m", "3m 45s", or "12s". Returns "—"
 * for nullish input. Negative values are clamped to 0.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
