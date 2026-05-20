"use client";
import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StepIndicator } from "./step-indicator";
import { FRAMEWORK_META } from "@/lib/framework-meta";
import { toast } from "sonner";
import { Plus, Loader2, Lock, Globe, Check } from "lucide-react";
import type { StackConfig, Framework, StylingOption, GitHubRepo, GitHubBranch } from "@/lib/types";

interface CreateProjectDialogProps {
  onCreated: () => void;
}

const DEFAULT_STACK: StackConfig = {
  framework: "none",
  styling: "none",
  typescript: true,
  eslint: true,
  prettier: false,
  shadcnUi: false,
};

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const FRAMEWORK_OPTIONS: { value: Framework; icon: string }[] = [
  { value: "none", icon: "📁" },
  { value: "nextjs", icon: "▲" },
  { value: "vite-react", icon: "⚡" },
  { value: "vite-vue", icon: "💚" },
  { value: "vite-svelte", icon: "🔥" },
  { value: "astro", icon: "🚀" },
  { value: "remix", icon: "💿" },
  { value: "express", icon: "🟢" },
  { value: "fastapi", icon: "🐍" },
  { value: "flask", icon: "🧪" },
  { value: "react-native", icon: "📱" },
  { value: "expo", icon: "📲" },
];

const STYLING_OPTIONS: { value: StylingOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "tailwind", label: "Tailwind" },
  { value: "css-modules", label: "CSS Modules" },
  { value: "styled-components", label: "Styled Components" },
];

export function CreateProjectDialog({ onCreated }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 0: Name & Source
  const [name, setName] = useState("");
  const [source, setSource] = useState<"empty" | "clone" | "github">("empty");
  const [gitCloneUrl, setGitCloneUrl] = useState("");

  // GitHub import
  const [ghRepos, setGhRepos] = useState<GitHubRepo[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSelected, setGhSelected] = useState<GitHubRepo | null>(null);
  const [ghBranches, setGhBranches] = useState<GitHubBranch[]>([]);
  const [ghBranch, setGhBranch] = useState("");
  const [ghSearch, setGhSearch] = useState("");

  // Step 1 (conditional): Stack
  const [stack, setStack] = useState<StackConfig>({ ...DEFAULT_STACK });

  // Step 2: GitHub
  const [createRepo, setCreateRepo] = useState(false);
  const [repoPrivate, setRepoPrivate] = useState(true);

  // Bump dependencies past framework defaults to true latest
  const [useLatestDependencies, setUseLatestDependencies] = useState(true);

  const steps = useMemo(
    () =>
      source === "empty"
        ? ["Name & Source", "Stack", "GitHub", "Confirm"]
        : ["Name & Source", "GitHub", "Confirm"],
    [source]
  );

  const fetchGhRepos = async () => {
    setGhLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      if (res.ok) setGhRepos(await res.json());
    } catch {} finally { setGhLoading(false); }
  };

  const fetchGhBranches = async (repo: GitHubRepo) => {
    const [owner, repoName] = repo.full_name.split("/");
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repoName}/branches`);
      if (res.ok) {
        const branches = await res.json();
        setGhBranches(branches);
        setGhBranch(repo.default_branch);
      }
    } catch {}
  };

  const lastStep = steps.length - 1;

  // Map logical step index to step name
  const currentStepName = steps[step];

  const frameworkMeta = FRAMEWORK_META[stack.framework];

  const reset = () => {
    setStep(0);
    setName("");
    setSource("empty");
    setGitCloneUrl("");
    setGhRepos([]);
    setGhSelected(null);
    setGhBranches([]);
    setGhBranch("");
    setGhSearch("");
    setStack({ ...DEFAULT_STACK });
    setCreateRepo(false);
    setRepoPrivate(true);
    setUseLatestDependencies(true);
    setError("");
    setLoading(false);
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name };

      if (source === "github" && ghSelected) {
        body.gitCloneUrl = ghSelected.clone_url;
        if (ghBranch && ghBranch !== ghSelected.default_branch) {
          body.branch = ghBranch;
        }
      } else if (source === "clone" && gitCloneUrl.trim()) {
        body.gitCloneUrl = gitCloneUrl.trim();
      }

      if (source === "empty" && stack.framework !== "none") {
        body.stack = stack;
        body.useLatestDependencies = useLatestDependencies;
      }

      if (createRepo && source === "empty" && !gitCloneUrl) {
        body.createRepo = true;
        body.repoPrivate = repoPrivate;
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const result = await res.json();

      if (result.githubError) {
        toast.warning(`Project created but GitHub failed: ${result.githubError}`);
      } else {
        toast.success(`Project "${name}" created`);
      }

      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (currentStepName === "Name & Source") {
      if (source === "github") return name.trim().length > 0 && !!ghSelected;
      return name.trim().length > 0 && (source === "empty" || gitCloneUrl.trim().length > 0);
    }
    return true;
  };

  const filteredRepos = ghSearch
    ? ghRepos.filter((r) => r.name.toLowerCase().includes(ghSearch.toLowerCase()))
    : ghRepos;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" data-icon="inline-start" />
        New Project
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>

        <StepIndicator steps={steps} currentStep={step} />

        <div className="min-h-[240px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step: Name & Source */}
            {currentStepName === "Name & Source" && (
              <motion.div
                key="step-name"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Project name</Label>
                  <Input
                    id="name"
                    placeholder="my-project"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={source === "empty" ? "default" : "outline"}
                      onClick={() => {
                        setSource("empty");
                        setStep(0); // Reset step when switching source
                      }}
                    >
                      Empty project
                    </Button>
                    <Button
                      size="sm"
                      variant={source === "clone" ? "default" : "outline"}
                      onClick={() => {
                        setSource("clone");
                        setStep(0);
                      }}
                    >
                      Clone URL
                    </Button>
                    <Button
                      size="sm"
                      variant={source === "github" ? "default" : "outline"}
                      onClick={() => {
                        setSource("github");
                        setStep(0);
                        if (ghRepos.length === 0) fetchGhRepos();
                      }}
                    >
                      GitHub
                    </Button>
                  </div>
                </div>
                {source === "clone" && (
                  <div className="space-y-2">
                    <Label htmlFor="clone-url">Git URL</Label>
                    <Input
                      id="clone-url"
                      placeholder="https://github.com/user/repo.git"
                      value={gitCloneUrl}
                      onChange={(e) => setGitCloneUrl(e.target.value)}
                    />
                  </div>
                )}
                {source === "github" && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Search repos..."
                      value={ghSearch}
                      onChange={(e) => setGhSearch(e.target.value)}
                      className="text-xs"
                    />
                    <div className="max-h-[140px] overflow-y-auto space-y-1">
                      {ghLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredRepos.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No repos found</p>
                      ) : (
                        filteredRepos.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setGhSelected(r);
                              if (!name) setName(r.name);
                              fetchGhBranches(r);
                            }}
                            className={`w-full flex items-center gap-2 rounded px-2 py-1 text-xs text-left ${
                              ghSelected?.id === r.id ? "bg-foreground/5 border border-foreground/10" : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            {r.private ? <Lock className="size-3 text-muted-foreground shrink-0" /> : <Globe className="size-3 text-muted-foreground shrink-0" />}
                            <span className="flex-1 truncate font-medium">{r.full_name}</span>
                            {r.language && <span className="text-muted-foreground">{r.language}</span>}
                            {ghSelected?.id === r.id && <Check className="size-3 text-green-500 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                    {ghSelected && ghBranches.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Branch</Label>
                        <select
                          value={ghBranch}
                          onChange={(e) => setGhBranch(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        >
                          {ghBranches.map((b) => (
                            <option key={b.name} value={b.name}>{b.name}{b.protected ? " (protected)" : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step: Stack Selection */}
            {currentStepName === "Stack" && (
              <motion.div
                key="step-stack"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Framework Grid */}
                <div className="space-y-2">
                  <Label>Framework</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {FRAMEWORK_OPTIONS.map(({ value, icon }) => {
                      const meta = FRAMEWORK_META[value];
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setStack((prev) => ({
                              ...prev,
                              framework: value,
                              // Reset incompatible options
                              styling: meta.supportsStyling ? prev.styling : "none",
                              shadcnUi: meta.supportsShadcn ? prev.shadcnUi : false,
                              typescript: meta.supportsTypescript ? prev.typescript : false,
                            }))
                          }
                          className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-all ${
                            stack.framework === value
                              ? "border-foreground bg-foreground/5 ring-1 ring-foreground/20"
                              : "border-border hover:border-foreground/30 hover:bg-muted"
                          }`}
                        >
                          <span className="text-base">{icon}</span>
                          <span className="truncate w-full text-center">
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Styling Options */}
                {frameworkMeta.supportsStyling && (
                  <div className="space-y-2">
                    <Label>Styling</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLING_OPTIONS.map(({ value, label }) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={stack.styling === value ? "default" : "outline"}
                          onClick={() =>
                            setStack((prev) => ({ ...prev, styling: value }))
                          }
                          className="text-xs"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toggle Options */}
                <div className="space-y-2">
                  {frameworkMeta.supportsTypescript && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">TypeScript</Label>
                      <Switch
                        checked={stack.typescript}
                        onCheckedChange={(checked) =>
                          setStack((prev) => ({ ...prev, typescript: checked }))
                        }
                      />
                    </div>
                  )}
                  {frameworkMeta.category !== "backend" && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">ESLint</Label>
                      <Switch
                        checked={stack.eslint}
                        onCheckedChange={(checked) =>
                          setStack((prev) => ({ ...prev, eslint: checked }))
                        }
                      />
                    </div>
                  )}
                  {frameworkMeta.category !== "backend" && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Prettier</Label>
                      <Switch
                        checked={stack.prettier}
                        onCheckedChange={(checked) =>
                          setStack((prev) => ({ ...prev, prettier: checked }))
                        }
                      />
                    </div>
                  )}
                  {frameworkMeta.supportsShadcn && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">shadcn/ui</Label>
                      <Switch
                        checked={stack.shadcnUi}
                        onCheckedChange={(checked) =>
                          setStack((prev) => ({ ...prev, shadcnUi: checked }))
                        }
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Use latest dependency versions</Label>
                      <p className="text-xs text-muted-foreground">
                        Runs npm-check-updates after scaffolding to bump every package past the framework&apos;s pinned defaults.
                      </p>
                    </div>
                    <Switch
                      checked={useLatestDependencies}
                      onCheckedChange={setUseLatestDependencies}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: GitHub */}
            {currentStepName === "GitHub" && (
              <motion.div
                key="step-github"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Optionally create a GitHub repository for this project.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={createRepo ? "default" : "outline"}
                    onClick={() => setCreateRepo(true)}
                    disabled={source === "clone"}
                  >
                    Create repo
                  </Button>
                  <Button
                    size="sm"
                    variant={!createRepo ? "default" : "outline"}
                    onClick={() => setCreateRepo(false)}
                  >
                    Skip
                  </Button>
                </div>
                {createRepo && (
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={repoPrivate ? "default" : "outline"}
                        onClick={() => setRepoPrivate(true)}
                      >
                        Private
                      </Button>
                      <Button
                        size="sm"
                        variant={!repoPrivate ? "default" : "outline"}
                        onClick={() => setRepoPrivate(false)}
                      >
                        Public
                      </Button>
                    </div>
                  </div>
                )}
                {source === "clone" && (
                  <p className="text-xs text-muted-foreground">
                    GitHub repo creation is skipped when cloning from an existing
                    URL.
                  </p>
                )}
              </motion.div>
            )}

            {/* Step: Confirm */}
            {currentStepName === "Confirm" && (
              <motion.div
                key="step-confirm"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground">
                  Review and confirm:
                </p>
                <div className="rounded-md border border-border bg-muted p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium">
                      {source === "github" ? "GitHub" : source === "clone" ? "Git clone" : "Empty"}
                    </span>
                  </div>
                  {source === "github" && ghSelected && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Repo</span>
                        <span className="font-mono text-xs">{ghSelected.full_name}</span>
                      </div>
                      {ghBranch && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Branch</span>
                          <span className="font-mono text-xs">{ghBranch}</span>
                        </div>
                      )}
                    </>
                  )}
                  {source === "clone" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {gitCloneUrl}
                      </span>
                    </div>
                  )}
                  {source === "empty" && stack.framework !== "none" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Framework</span>
                        <span className="font-medium">
                          {FRAMEWORK_META[stack.framework].label}
                        </span>
                      </div>
                      {frameworkMeta.supportsStyling &&
                        stack.styling !== "none" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Styling
                            </span>
                            <span className="font-medium">
                              {
                                STYLING_OPTIONS.find(
                                  (s) => s.value === stack.styling
                                )?.label
                              }
                            </span>
                          </div>
                        )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Options</span>
                        <span className="font-medium text-xs">
                          {[
                            stack.typescript && "TS",
                            stack.eslint && "ESLint",
                            stack.prettier && "Prettier",
                            stack.shadcnUi && "shadcn",
                          ]
                            .filter(Boolean)
                            .join(", ") || "None"}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GitHub repo</span>
                    <span className="font-medium">
                      {createRepo && source !== "clone"
                        ? repoPrivate
                          ? "Private"
                          : "Public"
                        : "Skip"}
                    </span>
                  </div>
                </div>
                {stack.framework !== "none" && source === "empty" && (
                  <p className="text-xs text-muted-foreground">
                    Scaffolding may take up to a minute depending on the
                    framework.
                  </p>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter>
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={loading}
            >
              Back
            </Button>
          )}
          {step < lastStep ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Creating...
                </>
              ) : (
                "Create project"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
