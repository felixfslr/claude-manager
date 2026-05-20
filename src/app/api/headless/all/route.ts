// Cross-project listing of headless runs. Walks ~/.claude-manager/headless/*/
// and aggregates all runs across every project into two buckets:
//   - running: status "running" or "pending", PID-reconciled
//   - recent:  last N finished runs (succeeded/failed/cancelled/orphaned)
//
// Used by the global /dashboard/sessions view so the user can see work in
// flight across every project without clicking into each one.

import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getHeadlessRoot, listRuns } from "@/lib/headless-store";
import { reconcileRunStatus } from "@/lib/headless";
import type { HeadlessRunMeta } from "@/lib/headless-types";

const DEFAULT_RECENT_LIMIT = 30;

function isLive(status: HeadlessRunMeta["status"]): boolean {
  return status === "running" || status === "pending";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.max(
      1,
      Math.min(200, Number(limitParam) || DEFAULT_RECENT_LIMIT)
    );

    const root = getHeadlessRoot();
    let projectDirs: string[] = [];
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({ running: [], recent: [] });
      }
      throw err;
    }

    // Gather runs from every project in parallel, then reconcile status so
    // stale "running" entries flip to "orphaned" when their pid is gone.
    const perProject = await Promise.all(
      projectDirs.map(async (project) => {
        try {
          const runs = await listRuns(project);
          return Promise.all(runs.map(reconcileRunStatus));
        } catch {
          return [] as HeadlessRunMeta[];
        }
      })
    );
    const all = perProject.flat();

    const running = all
      .filter((r) => isLive(r.status))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const recent = all
      .filter((r) => !isLive(r.status))
      .sort((a, b) =>
        (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt)
      )
      .slice(0, limit);

    return NextResponse.json({ running, recent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list runs" },
      { status: 500 }
    );
  }
}
