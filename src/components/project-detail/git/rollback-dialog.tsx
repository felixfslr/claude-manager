"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hash: string;
  onConfirm: () => void;
}

export function RollbackDialog({ open, onOpenChange, hash, onConfirm }: RollbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Hard Reset
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            This will <strong>permanently discard</strong> all commits after{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{hash.substring(0, 7)}</code>.
          </p>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
            A snapshot of the current state will be automatically created before the reset,
            so you can restore it later if needed.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Reset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
