"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";

interface EnvVar {
  id: string;
  key: string;
  value: string;
  target: string[];
}

interface EnvVarsEditorProps {
  projectName: string;
}

export function EnvVarsEditor({ projectName }: EnvVarsEditorProps) {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const fetchVars = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/env-vars`
      );
      if (res.ok) setVars(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/env-vars`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: newKey.trim(),
            value: newValue,
            targets: ["production", "preview", "development"],
          }),
        }
      );
      if (res.ok) {
        toast.success(`Added ${newKey}`);
        setNewKey("");
        setNewValue("");
        setShowAdd(false);
        fetchVars();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add env var");
      }
    } catch {
      toast.error("Failed to add env var");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (envId: string, key: string) => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/env-vars`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ envId }),
        }
      );
      if (res.ok) {
        toast.success(`Removed ${key}`);
        fetchVars();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to delete env var");
      }
    } catch {
      toast.error("Failed to delete env var");
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="h-16 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Environment Variables</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs"
        >
          <Plus className="size-3" data-icon="inline-start" />
          Add
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2">
          <div className="flex gap-2">
            <Input
              placeholder="KEY"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              className="flex-1 font-mono text-xs"
            />
            <Input
              placeholder="value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newKey.trim()} className="text-xs">
              {saving && <Loader2 className="size-3 animate-spin" data-icon="inline-start" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setNewKey("");
                setNewValue("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {vars.length > 0 ? (
        <div className="space-y-1">
          {vars.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-2 rounded px-2 py-1 bg-muted text-xs"
            >
              <span className="font-mono font-medium min-w-[100px]">
                {v.key}
              </span>
              <span className="font-mono text-muted-foreground flex-1 truncate">
                {visibleIds.has(v.id) ? v.value || "(empty)" : "••••••••"}
              </span>
              <button
                onClick={() => toggleVisibility(v.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                {visibleIds.has(v.id) ? (
                  <EyeOff className="size-3" />
                ) : (
                  <Eye className="size-3" />
                )}
              </button>
              <button
                onClick={() => handleDelete(v.id, v.key)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {vars.length === 0 ? "No environment variables" : ""}
        </p>
      )}
    </div>
  );
}
