"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import type { VercelProject } from "@/lib/types";

interface VercelLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onLinked: () => void;
}

export function VercelLinkDialog({
  open,
  onOpenChange,
  projectName,
  onLinked,
}: VercelLinkDialogProps) {
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/vercel/projects")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        })
        .catch(() => toast.error("Failed to load Vercel projects"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleLink = async () => {
    setSaving(true);
    try {
      let vercelProjectId = selectedId;

      // Create new project if in "new" mode
      if (mode === "new" && newName.trim()) {
        const res = await fetch("/api/vercel/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (!res.ok) throw new Error("Failed to create Vercel project");
        const project = await res.json();
        vercelProjectId = project.id;
      }

      if (!vercelProjectId) {
        toast.error("Select or create a project");
        return;
      }

      // Save to hosting config
      const hostingRes = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting`
      );
      const existing = hostingRes.ok ? await hostingRes.json() : null;

      const hosting = existing ?? {
        environments: {
          production: { envVars: {}, deploymentTarget: "vercel" },
          staging: { envVars: {}, deploymentTarget: "vercel" },
        },
      };
      hosting.vercelProjectId = vercelProjectId;

      await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hosting),
        }
      );

      toast.success("Vercel project linked");
      onOpenChange(false);
      onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Vercel Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
              className="text-xs"
            >
              Existing
            </Button>
            <Button
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
              className="text-xs"
            >
              Create New
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No Vercel projects found
                </p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full flex items-center justify-between rounded-md border p-2 text-left text-sm transition-all ${
                      selectedId === p.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.framework && (
                        <p className="text-xs text-muted-foreground">
                          {p.framework}
                        </p>
                      )}
                    </div>
                    {selectedId === p.id && (
                      <Check className="size-4 text-green-500" />
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="vercel-name">Project name</Label>
              <Input
                id="vercel-name"
                placeholder="my-vercel-project"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={
              saving ||
              (mode === "existing" && !selectedId) ||
              (mode === "new" && !newName.trim())
            }
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : null}
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
