"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EnvVarsEditor } from "./env-vars-editor";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Upload,
  FileKey,
  Pencil,
  X,
} from "lucide-react";

interface EnvManagerSectionProps {
  projectName: string;
  hasVercel?: boolean;
}

type EnvTarget = "dev" | "staging" | "prod";

const ENV_LABELS: Record<EnvTarget, string> = {
  dev: ".env",
  staging: ".env.staging",
  prod: ".env.production",
};

export function EnvManagerSection({
  projectName,
  hasVercel,
}: EnvManagerSectionProps) {
  const [activeEnv, setActiveEnv] = useState<EnvTarget>("dev");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [syncing, setSyncing] = useState(false);

  const api = `/api/projects/${encodeURIComponent(projectName)}/env`;

  const fetchVars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}?env=${activeEnv}`);
      if (res.ok) setVars(await res.json());
      else setVars({});
    } catch {
      setVars({});
    } finally {
      setLoading(false);
    }
  }, [api, activeEnv]);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const saveVars = async (updated: Record<string, string>) => {
    setSaving(true);
    try {
      const res = await fetch(api, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: activeEnv, vars: updated }),
      });
      if (res.ok) {
        setVars(updated);
        toast.success(`Saved ${ENV_LABELS[activeEnv]}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    const updated = { ...vars, [newKey.trim()]: newValue };
    await saveVars(updated);
    setNewKey("");
    setNewValue("");
    setShowAdd(false);
  };

  const handleDelete = async (key: string) => {
    const updated = { ...vars };
    delete updated[key];
    await saveVars(updated);
  };

  const handleEditSave = async () => {
    if (!editingKey) return;
    const updated = { ...vars, [editingKey]: editValue };
    await saveVars(updated);
    setEditingKey(null);
    setEditValue("");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/env/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ env: activeEnv }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced ${data.synced} vars to Vercel`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to sync");
      }
    } catch {
      toast.error("Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const entries = Object.entries(vars);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileKey className="size-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Environment Variables</Label>
        </div>
        <div className="flex gap-1">
          {hasVercel && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="text-xs"
            >
              {syncing ? (
                <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
              ) : (
                <Upload className="size-3" data-icon="inline-start" />
              )}
              Sync to Vercel
            </Button>
          )}
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
      </div>

      {/* Environment Selector */}
      <div className="flex gap-1">
        {(Object.entries(ENV_LABELS) as [EnvTarget, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveEnv(key);
                setEditingKey(null);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                activeEnv === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Add new var */}
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
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !newKey.trim()}
              className="text-xs"
            >
              {saving && (
                <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
              )}
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

      {/* Vars list */}
      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      ) : entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key}>
              {editingKey === key ? (
                <div className="flex items-center gap-2 rounded px-2 py-1 bg-muted text-xs">
                  <span className="font-mono font-medium min-w-[100px]">
                    {key}
                  </span>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 font-mono text-xs h-6"
                    autoFocus
                  />
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={handleEditSave}
                    disabled={saving}
                  >
                    <Save className="size-3" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setEditingKey(null)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded px-2 py-1 bg-muted text-xs group">
                  <span className="font-mono font-medium min-w-[100px]">
                    {key}
                  </span>
                  <span className="font-mono text-muted-foreground flex-1 truncate">
                    {visibleKeys.has(key) ? value || "(empty)" : "••••••••"}
                  </span>
                  <button
                    onClick={() => toggleVisibility(key)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {visibleKeys.has(key) ? (
                      <EyeOff className="size-3" />
                    ) : (
                      <Eye className="size-3" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingKey(key);
                      setEditValue(value);
                    }}
                    className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(key)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No variables in {ENV_LABELS[activeEnv]}
        </p>
      )}

      {/* Vercel env vars */}
      {hasVercel && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">
              Vercel
            </Badge>
            <span className="text-xs text-muted-foreground">
              Remote environment variables
            </span>
          </div>
          <EnvVarsEditor projectName={projectName} />
        </div>
      )}
    </div>
  );
}
