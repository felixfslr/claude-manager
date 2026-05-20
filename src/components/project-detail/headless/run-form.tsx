"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PermissionModeWarning } from "./permission-mode-warning";
import { VoiceInputButton } from "./voice-input-button";
import { EffortSelector } from "./effort-selector";
import type { EffortLevel, PermissionMode } from "@/lib/headless-types";
import type { PromptFile } from "@/lib/prompts";
import type { PlanFile } from "@/lib/plans";

interface RunFormProps {
  projectName: string;
  onStarted?: (runId: string) => void;
}

const PERMISSION_OPTIONS: { value: PermissionMode; label: string; description: string }[] = [
  {
    value: "bypassPermissions",
    label: "Bypass (--dangerously-skip-permissions)",
    description: "No prompts. Full file/system access.",
  },
  { value: "default", label: "Default", description: "Prompts for everything." },
  { value: "acceptEdits", label: "Accept edits", description: "Auto-accept file edits, prompt for the rest." },
  { value: "plan", label: "Plan mode", description: "Read-only. Produces a plan, no changes." },
];

export function RunForm({ projectName, onStarted }: RunFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("bypassPermissions");
  const [model, setModel] = useState("");
  const [maxTurns, setMaxTurns] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [appendSystemPrompt, setAppendSystemPrompt] = useState("");
  const [allowedTools, setAllowedTools] = useState("");
  const [disallowedTools, setDisallowedTools] = useState("");
  const [addDirs, setAddDirs] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prompts, setPrompts] = useState<PromptFile[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");

  const [globalPlans, setGlobalPlans] = useState<PlanFile[]>([]);
  const [projectPlans, setProjectPlans] = useState<PlanFile[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");

  const [effortLevel, setEffortLevel] = useState<EffortLevel | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const stored = window.localStorage.getItem("claude-manager:effortLevel");
    if (stored === "low" || stored === "medium" || stored === "high" || stored === "max") {
      return stored;
    }
    return undefined;
  });

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectName)}/prompts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setPrompts)
      .catch(() => setPrompts([]));
    fetch(`/api/plans`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGlobalPlans)
      .catch(() => setGlobalPlans([]));
    fetch(`/api/projects/${encodeURIComponent(projectName)}/plans`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjectPlans)
      .catch(() => setProjectPlans([]));
  }, [projectName]);

  const loadSelectedPrompt = async (filename: string) => {
    setSelectedPrompt(filename);
    if (!filename) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/prompts/${encodeURIComponent(filename)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        setPrompt(data.content);
      }
    } catch {
      // ignore
    }
  };

  const loadSelectedPlan = async (value: string) => {
    setSelectedPlan(value);
    if (!value) return;
    // value format: "global:<filename>" or "project:<filename>"
    const [scope, ...rest] = value.split(":");
    const filename = rest.join(":");
    const url =
      scope === "global"
        ? `/api/plans/${encodeURIComponent(filename)}`
        : `/api/projects/${encodeURIComponent(projectName)}/plans/${encodeURIComponent(filename)}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        // Prefix with an explicit imperative so Claude treats the plan as a
        // task, not a document to discuss. Without this, long plan docs
        // sometimes get read as "help me think about this" and Claude asks
        // clarifying questions instead of executing.
        const prefix =
          "Führe diesen Plan Schritt für Schritt aus. Nutze TodoWrite, um den Fortschritt zu tracken. Wenn im Plan Fragen offen sind oder Entscheidungen nötig werden, nutze AskUserQuestion bevor du anfängst.\n\n---\n\n";
        setPrompt(prefix + data.content);
      }
    } catch {
      // ignore
    }
  };

  const updateEffortLevel = (next: EffortLevel | undefined) => {
    setEffortLevel(next);
    if (typeof window === "undefined") return;
    if (next) {
      window.localStorage.setItem("claude-manager:effortLevel", next);
    } else {
      window.localStorage.removeItem("claude-manager:effortLevel");
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!prompt.trim()) {
      setError("Prompt is required");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        prompt,
        permissionMode,
      };
      if (model.trim()) body.model = model.trim();
      if (effortLevel) body.effortLevel = effortLevel;
      if (maxTurns.trim()) body.maxTurns = Number(maxTurns);
      if (maxBudget.trim()) body.maxBudgetUsd = Number(maxBudget);
      if (appendSystemPrompt.trim()) body.appendSystemPrompt = appendSystemPrompt;
      if (allowedTools.trim()) body.allowedTools = allowedTools.trim();
      if (disallowedTools.trim()) body.disallowedTools = disallowedTools.trim();
      if (addDirs.trim()) {
        body.addDirs = addDirs.split(",").map((d) => d.trim()).filter(Boolean);
      }

      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/headless`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start run");
      }
      const data = (await res.json()) as { runId: string };
      if (onStarted) onStarted(data.runId);
      router.push(
        `/dashboard/${encodeURIComponent(projectName)}/headless/runs/${encodeURIComponent(data.runId)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const hasPlans = globalPlans.length > 0 || projectPlans.length > 0;

  const appendTranscription = (text: string) => {
    setPrompt((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return text;
      return `${trimmed} ${text}`;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prompts.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Load from prompts library</Label>
            <select
              value={selectedPrompt}
              onChange={(e) => loadSelectedPrompt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— pick a prompt —</option>
              {prompts.map((p) => (
                <option key={p.filename} value={p.filename}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {hasPlans && (
          <div className="space-y-1.5">
            <Label className="text-xs">Load from plans library</Label>
            <select
              value={selectedPlan}
              onChange={(e) => loadSelectedPlan(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— pick a plan —</option>
              {globalPlans.length > 0 && (
                <optgroup label="Global (~/.claude/plans)">
                  {globalPlans.map((p) => (
                    <option key={`global:${p.filename}`} value={`global:${p.filename}`}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {projectPlans.length > 0 && (
                <optgroup label="Project (./plans)">
                  {projectPlans.map((p) => (
                    <option key={`project:${p.filename}`} value={`project:${p.filename}`}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className="text-xs">Prompt</Label>
          <VoiceInputButton onTranscription={appendTranscription} />
        </div>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          placeholder="Tell Claude what to do…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Permission mode</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {PERMISSION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPermissionMode(opt.value)}
              className={`text-left rounded-md border p-2 transition-colors ${
                permissionMode === opt.value
                  ? "border-foreground bg-foreground/5 ring-1 ring-foreground/20"
                  : "border-border hover:border-foreground/30 hover:bg-muted"
              }`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[11px] text-muted-foreground">{opt.description}</div>
            </button>
          ))}
        </div>
        <PermissionModeWarning mode={permissionMode} />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="size-3.5" />
        {showAdvanced ? "Hide advanced" : "Advanced options"}
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <EffortSelector value={effortLevel} onChange={updateEffortLevel} model={model} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Model (e.g. opus, sonnet)</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="default" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max turns</Label>
              <Input
                type="number"
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
                placeholder="unlimited"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max budget (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="unlimited"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Add dirs (comma-separated)</Label>
              <Input value={addDirs} onChange={(e) => setAddDirs(e.target.value)} placeholder="../shared,../lib" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Allowed tools</Label>
            <Input
              value={allowedTools}
              onChange={(e) => setAllowedTools(e.target.value)}
              placeholder="Read,Edit,Bash(npm run *)"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Disallowed tools</Label>
            <Input
              value={disallowedTools}
              onChange={(e) => setDisallowedTools(e.target.value)}
              placeholder="WebFetch,WebSearch"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Append system prompt</Label>
            <textarea
              value={appendSystemPrompt}
              onChange={(e) => setAppendSystemPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
            />
          </div>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Starting…
            </>
          ) : (
            <>
              <Play className="size-4" data-icon="inline-start" />
              Start run
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
