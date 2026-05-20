"use client";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LoopDef, LoopPhase, PermissionMode } from "@/lib/headless-types";

interface LoopEditorProps {
  projectName: string;
  loop: LoopDef;
  onClose: () => void;
}

const PERM_VALUES: PermissionMode[] = [
  "bypassPermissions",
  "default",
  "acceptEdits",
  "plan",
];

export function LoopEditor({ projectName, loop, onClose }: LoopEditorProps) {
  const [name, setName] = useState(loop.name);
  const [description, setDescription] = useState(loop.description ?? "");
  const [phases, setPhases] = useState<LoopPhase[]>(loop.phases);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updatePhase = (i: number, patch: Partial<LoopPhase>) => {
    setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const addPhase = () => {
    setPhases((prev) => [
      ...prev,
      { name: `Phase ${prev.length + 1}`, prompt: "", permissionMode: "bypassPermissions" },
    ]);
  };

  const removePhase = (i: number) => {
    setPhases((prev) => prev.filter((_, idx) => idx !== i));
  };

  const movePhase = (i: number, direction: -1 | 1) => {
    setPhases((prev) => {
      const next = [...prev];
      const j = i + direction;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const isNew = !loop.id;
      const url = isNew
        ? `/api/projects/${encodeURIComponent(projectName)}/loops`
        : `/api/projects/${encodeURIComponent(projectName)}/loops/${encodeURIComponent(loop.id)}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, phases }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{loop.id ? "Edit loop" : "New loop"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Phases</Label>
              <Button size="xs" variant="outline" onClick={addPhase}>
                <Plus className="size-3" />
                Add phase
              </Button>
            </div>
            {phases.map((phase, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={phase.name}
                    onChange={(e) => updatePhase(i, { name: e.target.value })}
                    className="flex-1"
                    placeholder="Phase name"
                  />
                  <Button size="icon-xs" variant="ghost" onClick={() => movePhase(i, -1)}>
                    ↑
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={() => movePhase(i, 1)}>
                    ↓
                  </Button>
                  <Button size="icon-xs" variant="destructive" onClick={() => removePhase(i)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Prompt (use <code>{"{{previous_result}}"}</code> for the previous phase&apos;s output)</Label>
                  <textarea
                    value={phase.prompt}
                    onChange={(e) => updatePhase(i, { prompt: e.target.value })}
                    rows={4}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Permission mode</Label>
                    <select
                      value={phase.permissionMode}
                      onChange={(e) =>
                        updatePhase(i, { permissionMode: e.target.value as PermissionMode })
                      }
                      className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    >
                      {PERM_VALUES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Max retries</Label>
                    <Input
                      type="number"
                      value={phase.maxRetries ?? ""}
                      onChange={(e) =>
                        updatePhase(i, {
                          maxRetries: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Success pattern (regex)</Label>
                    <Input
                      value={phase.successPattern ?? ""}
                      onChange={(e) => updatePhase(i, { successPattern: e.target.value || undefined })}
                      placeholder="TESTS PASS"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fail pattern (regex)</Label>
                    <Input
                      value={phase.failPattern ?? ""}
                      onChange={(e) => updatePhase(i, { failPattern: e.target.value || undefined })}
                      placeholder="TESTS FAIL"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-[10px]">Resume previous phase&apos;s session</Label>
                  <Switch
                    checked={phase.resumePrevious ?? false}
                    onCheckedChange={(checked) => updatePhase(i, { resumePrevious: checked })}
                  />
                </div>
              </div>
            ))}
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
