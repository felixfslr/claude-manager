"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Save, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PromptFile } from "@/lib/prompts";

interface PromptsLibraryProps {
  projectName: string;
}

export function PromptsLibrary({ projectName }: PromptsLibraryProps) {
  const [list, setList] = useState<PromptFile[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [creatingNewName, setCreatingNewName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/prompts`);
      if (!res.ok) throw new Error("Failed to load prompts");
      const data = (await res.json()) as PromptFile[];
      setList(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, [projectName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadPrompt = async (filename: string) => {
    setSelected(filename);
    setContent("");
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/prompts/${encodeURIComponent(filename)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        setContent(data.content);
      }
    } catch {
      // ignore
    }
  };

  const save = async () => {
    if (!selected) return;
    setSavingState("saving");
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/prompts/${encodeURIComponent(selected)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setSavingState("saved");
      await refresh();
      setTimeout(() => setSavingState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSavingState("idle");
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(`Delete ${selected}?`)) return;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/prompts/${encodeURIComponent(selected)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      setSelected(null);
      setContent("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const createNew = () => {
    setCreatingNewName("");
  };

  const confirmCreate = async () => {
    if (!creatingNewName) return;
    let filename = creatingNewName.trim();
    if (!filename.endsWith(".md")) filename += ".md";
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/prompts/${encodeURIComponent(filename)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `# ${filename.replace(/\.md$/, "")}\n\n` }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Create failed");
      setCreatingNewName(null);
      await refresh();
      await loadPrompt(filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Prompts</Label>
          <Button size="xs" variant="ghost" onClick={createNew}>
            <Plus className="size-3" />
            New
          </Button>
        </div>
        {creatingNewName !== null && (
          <div className="space-y-1">
            <Input
              autoFocus
              value={creatingNewName}
              onChange={(e) => setCreatingNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmCreate();
                if (e.key === "Escape") setCreatingNewName(null);
              }}
              placeholder="filename.md"
            />
            <div className="flex gap-1">
              <Button size="xs" onClick={confirmCreate}>Create</Button>
              <Button size="xs" variant="ghost" onClick={() => setCreatingNewName(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {list === null ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : list.length === 0 ? (
          <div className="text-xs text-muted-foreground">No prompts yet.</div>
        ) : (
          <div className="space-y-1">
            {list.map((p) => (
              <button
                key={p.filename}
                type="button"
                onClick={() => loadPrompt(p.filename)}
                className={`w-full text-left rounded px-2 py-1.5 text-xs ${
                  selected === p.filename
                    ? "bg-foreground/5 border border-foreground/10"
                    : "bg-muted/40 hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium truncate">
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  {p.title}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{p.filename}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono">{selected}</Label>
              <div className="flex gap-1">
                <Button size="xs" onClick={save} disabled={savingState === "saving"}>
                  <Save className="size-3" />
                  {savingState === "saving" ? "Saving…" : savingState === "saved" ? "Saved" : "Save"}
                </Button>
                <Button size="xs" variant="destructive" onClick={remove}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono"
            />
          </>
        ) : (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Select a prompt or create a new one. Files live in <code>{`<project>/prompts/`}</code>.
          </div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    </div>
  );
}
