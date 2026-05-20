"use client";
import { BranchManager } from "./git/branch-manager";
import { CommitHistory } from "./git/commit-history";
import { StashManager } from "./git/stash-manager";
import { SnapshotManager } from "./git/snapshot-manager";
import { Separator } from "@/components/ui/separator";

interface GitTabProps {
  projectName: string;
}

export function GitTab({ projectName }: GitTabProps) {
  return (
    <div className="space-y-6">
      <BranchManager projectName={projectName} />
      <Separator />
      <CommitHistory projectName={projectName} />
      <Separator />
      <div className="grid gap-6 sm:grid-cols-2">
        <StashManager projectName={projectName} />
        <SnapshotManager projectName={projectName} />
      </div>
    </div>
  );
}
