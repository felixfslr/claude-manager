"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Upload,
  Loader2,
  Save,
  X,
  Pencil,
  FolderOpen,
} from "lucide-react";

interface SkillEntry {
  name: string;
  type: "folder" | "file";
  size: number;
  lastModified: string;
  hasSkillMd: boolean;
}

interface SkillFilesSectionProps {
  projectName: string;
}

export function SkillFilesSection({ projectName }: SkillFilesSectionProps) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const api = `/api/projects/${encodeURIComponent(projectName)}/skills`;

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(api);
      if (res.ok) setSkills(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleCreate = async () => {
    if (!newSkillName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName: newSkillName.trim(), content: newContent }),
      });
      if (res.ok) {
        toast.success(`Created skill "${newSkillName}"`);
        setNewSkillName("");
        setNewContent("");
        setShowCreate(false);
        fetchSkills();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create skill");
      }
    } catch {
      toast.error("Failed to create skill");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(api, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.extracted) {
          toast.success(`Installed skill "${data.skillName}" from ${file.name}`);
        } else {
          toast.success(`Uploaded ${file.name}`);
        }
        fetchSkills();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to upload");
      }
    } catch {
      toast.error("Failed to upload");
    }
    e.target.value = "";
  };

  const handleEdit = async (skillName: string) => {
    setEditingSkill(skillName);
    setEditLoading(true);
    try {
      const res = await fetch(`${api}/${encodeURIComponent(skillName)}`);
      if (res.ok) {
        const data = await res.json();
        setEditContent(data.content);
      } else {
        toast.error("Failed to load skill");
        setEditingSkill(null);
      }
    } catch {
      toast.error("Failed to load skill");
      setEditingSkill(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSkill) return;
    setSaving(true);
    try {
      const res = await fetch(`${api}/${encodeURIComponent(editingSkill)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        toast.success(`Saved ${editingSkill}`);
        setEditingSkill(null);
        setEditContent("");
        fetchSkills();
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

  const handleDelete = async (skillName: string) => {
    try {
      const res = await fetch(`${api}/${encodeURIComponent(skillName)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Deleted ${skillName}`);
        if (editingSkill === skillName) {
          setEditingSkill(null);
          setEditContent("");
        }
        fetchSkills();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (loading) {
    return <div className="h-16 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Skills</Label>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() =>
              document.getElementById(`skill-upload-${projectName}`)?.click()
            }
          >
            <Upload className="size-3" data-icon="inline-start" />
            Upload
            <input
              id={`skill-upload-${projectName}`}
              type="file"
              className="hidden"
              onChange={handleUpload}
              /* no accept filter — .skill files have no standard MIME type */
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreate(!showCreate)}
            className="text-xs"
          >
            <Plus className="size-3" data-icon="inline-start" />
            New
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Skills in <code>.claude/skills/</code> — upload <code>.skill</code> packages or create manually.
      </p>

      {showCreate && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2">
          <Input
            placeholder="skill-name"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            className="font-mono text-xs"
          />
          <textarea
            placeholder="SKILL.md content..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving || !newSkillName.trim()}
              className="text-xs"
            >
              {saving && <Loader2 className="size-3 animate-spin" data-icon="inline-start" />}
              Create
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setNewSkillName("");
                setNewContent("");
              }}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editingSkill && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium">{editingSkill}/SKILL.md</span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                setEditingSkill(null);
                setEditContent("");
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
          {editLoading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={saving}
                className="text-xs"
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
                ) : (
                  <Save className="size-3" data-icon="inline-start" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      )}

      {skills.length > 0 ? (
        <div className="space-y-1">
          {skills.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted text-xs group"
            >
              {s.type === "folder" ? (
                <FolderOpen className="size-3 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="size-3 text-muted-foreground shrink-0" />
              )}
              <span className="font-mono font-medium flex-1 truncate">
                {s.name}
              </span>
              {s.type === "folder" && s.hasSkillMd && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  SKILL.md
                </Badge>
              )}
              {s.type === "file" && (
                <span className="text-muted-foreground shrink-0">
                  {formatSize(s.size)}
                </span>
              )}
              <button
                onClick={() => handleEdit(s.name)}
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => handleDelete(s.name)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !showCreate && (
          <p className="text-xs text-muted-foreground">
            No skills yet. Upload a <code>.skill</code> package or create a new skill.
          </p>
        )
      )}
    </div>
  );
}
