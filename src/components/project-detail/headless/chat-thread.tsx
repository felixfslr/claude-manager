"use client";
// Chat-style view of a Claude headless session. Aggregates every run that
// shares a claudeSessionId and lets the user send follow-up messages via
// the existing /resume endpoint. One user turn = one run.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Square,
  Send,
  GitBranch,
  Trash2,
  AlertTriangle,
  User,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeadlessThread } from "@/hooks/use-headless-thread";
import { useTick } from "@/hooks/use-tick";
import { EventCard } from "./event-card";
import { VoiceInputButton } from "./voice-input-button";
import { RateLimitBanner } from "./rate-limit-banner";
import { TodoChecklist, extractTodos, type TodoItem } from "./todo-checklist";
import {
  StatusPill,
  PermissionBadge,
  formatCost,
  formatTokens,
  formatDuration,
} from "./run-bits";
import type { HeadlessRunMeta, HeadlessUsage } from "@/lib/headless-types";
import {
  computeContextUsed,
  formatWindowSize,
  getContextWindow,
} from "@/lib/model-context";

interface ChatThreadProps {
  projectName: string;
  initialRunId: string;
}

interface InitialRunFetch {
  meta: HeadlessRunMeta;
}

export function ChatThread({ projectName, initialRunId }: ChatThreadProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMeta, setInitialMeta] = useState<HeadlessRunMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Resolve the thread's sessionId from whichever runId is in the URL.
  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(initialRunId)}`
    )
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to load run");
        }
        return r.json() as Promise<InitialRunFetch>;
      })
      .then((data) => {
        if (cancelled) return;
        setInitialMeta(data.meta);
        if (data.meta.claudeSessionId) {
          setSessionId(data.meta.claudeSessionId);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, initialRunId]);

  const thread = useHeadlessThread({ projectName, sessionId });

  if (loadError) {
    return <div className="text-sm text-destructive">{loadError}</div>;
  }
  if (!initialMeta) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  // Edge case: the run never reached system.init, so there's no session id
  // to thread by. Fall back to a one-line notice. Users can retry or purge.
  if (!initialMeta.claudeSessionId) {
    return (
      <NoSessionFallback
        projectName={projectName}
        meta={initialMeta}
        onReload={() => router.refresh()}
      />
    );
  }

  return (
    <ChatThreadInner
      projectName={projectName}
      initialRunId={initialRunId}
      thread={thread}
      router={router}
    />
  );
}

function NoSessionFallback({
  projectName,
  meta,
  onReload,
}: {
  projectName: string;
  meta: HeadlessRunMeta;
  onReload: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="size-4 text-amber-500" />
        <span className="font-medium">Session not initialized</span>
        <StatusPill status={meta.status} />
      </div>
      <div className="text-xs text-muted-foreground">
        This run never produced a <code>system.init</code> event, so there&apos;s
        no session id to continue. The raw event log is still available on disk.
      </div>
      <div className="flex gap-2">
        <Button size="xs" variant="outline" onClick={onReload}>
          Reload
        </Button>
        <a
          className="text-xs underline text-muted-foreground hover:text-foreground"
          href={`/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(meta.runId)}`}
          target="_blank"
          rel="noreferrer"
        >
          View raw run
        </a>
      </div>
      <div className="text-xs text-muted-foreground line-clamp-3 italic">
        {meta.prompt}
      </div>
    </div>
  );
}

interface ChatThreadInnerProps {
  projectName: string;
  initialRunId: string;
  thread: ReturnType<typeof useHeadlessThread>;
  router: ReturnType<typeof useRouter>;
}

function ChatThreadInner({
  projectName,
  initialRunId,
  thread,
  router,
}: ChatThreadInnerProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to the bottom unless the user has scrolled up.
  const totalEventCount = useMemo(
    () =>
      Object.values(thread.events).reduce((sum, arr) => sum + arr.length, 0),
    [thread.events]
  );
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [totalEventCount, thread.runs.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    autoScrollRef.current = atBottom;
  };

  // Aggregate header metrics across every run in the thread.
  const aggregate = useMemo(() => {
    let totalCost = 0;
    let totalTurns = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    for (const r of thread.runs) {
      if (typeof r.totalCostUsd === "number") totalCost += r.totalCostUsd;
      if (typeof r.numTurns === "number") totalTurns += r.numTurns;
      if (r.usage?.input_tokens) inputTokens += r.usage.input_tokens;
      if (r.usage?.output_tokens) outputTokens += r.usage.output_tokens;
    }
    return { totalCost, totalTurns, inputTokens, outputTokens };
  }, [thread.runs]);

  const firstRun = thread.runs[0];
  const latest = thread.latestRun;
  const canSend = !sending && !thread.isBusy && input.trim().length > 0;

  // Live tick while any run is busy — drives the session timer & context widget.
  useTick(thread.isBusy, 1000);

  // Session timing. Total = sum of per-run durations (running runs use now).
  // Current turn = latest run's duration only.
  const { totalMs, currentTurnMs } = useMemo(() => {
    const now = Date.now();
    let total = 0;
    for (const r of thread.runs) {
      if (r.runId.startsWith("pending-local-")) continue;
      const start = new Date(r.startedAt).getTime();
      if (Number.isNaN(start)) continue;
      const end = r.endedAt ? new Date(r.endedAt).getTime() : now;
      total += Math.max(0, end - start);
    }
    let turn = 0;
    if (latest && !latest.runId.startsWith("pending-local-")) {
      const start = new Date(latest.startedAt).getTime();
      if (!Number.isNaN(start)) {
        const end = latest.endedAt ? new Date(latest.endedAt).getTime() : now;
        turn = Math.max(0, end - start);
      }
    }
    return { totalMs: total, currentTurnMs: turn };
    // `thread.isBusy` indirectly drives useTick above — each tick is a new render,
    // which re-enters this useMemo via updated Date.now(). We include runs for
    // structural changes.
  }, [thread.runs, latest]);

  // Context window usage: look at the latest run's usage + the init event to
  // determine the active model.
  const { contextUsed, contextWindow, contextUsage, resolvedModel } = useMemo(() => {
    const usage: HeadlessUsage | undefined = latest?.usage;
    const used = computeContextUsed(usage);
    // Prefer meta.model, then the model reported in the most recent init event.
    // The CLI emits `model` at the TOP LEVEL of system.init (NOT nested under
    // `.data`), so walk runs newest-first and check the top-level field.
    let model = latest?.model;
    if (!model) {
      outer: for (let i = thread.runs.length - 1; i >= 0; i--) {
        const evts = thread.events[thread.runs[i].runId] ?? [];
        for (const evt of evts) {
          if (!evt || typeof evt !== "object") continue;
          const e = evt as Record<string, unknown>;
          if (e.type !== "system" || e.subtype !== "init") continue;
          if (typeof e.model === "string") {
            model = e.model;
            break outer;
          }
          // Defensive fallback if the CLI ever moves it under .data.
          const data = e.data as Record<string, unknown> | undefined;
          if (typeof data?.model === "string") {
            model = data.model;
            break outer;
          }
        }
      }
    }
    return {
      contextUsed: used,
      contextWindow: getContextWindow(model),
      contextUsage: usage,
      resolvedModel: model,
    };
  }, [latest, thread.runs, thread.events]);

  const contextPct = contextWindow > 0 ? contextUsed / contextWindow : 0;
  const contextColor =
    contextPct > 0.85
      ? "bg-red-500"
      : contextPct > 0.6
      ? "bg-amber-500"
      : "bg-emerald-500";

  // Pinned todo list: find the most recent TodoWrite tool_use across all runs.
  const latestTodos = useMemo<TodoItem[]>(() => {
    // Walk runs newest-first, then events within a run newest-first, picking
    // the most recent assistant tool_use named "TodoWrite".
    for (let i = thread.runs.length - 1; i >= 0; i--) {
      const runId = thread.runs[i].runId;
      const evts = thread.events[runId] ?? [];
      for (let j = evts.length - 1; j >= 0; j--) {
        const evt = evts[j];
        if (!evt || typeof evt !== "object") continue;
        const e = evt as Record<string, unknown>;
        if (e.type !== "assistant") continue;
        const msg = e.message as { content?: unknown } | undefined;
        const blocks = Array.isArray(msg?.content) ? (msg!.content as unknown[]) : [];
        for (let k = blocks.length - 1; k >= 0; k--) {
          const block = blocks[k];
          if (!block || typeof block !== "object") continue;
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use" && b.name === "TodoWrite") {
            const todos = extractTodos(b.input);
            if (todos.length > 0) return todos;
          }
        }
      }
    }
    return [];
  }, [thread.runs, thread.events]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    const prompt = input;
    setInput("");
    setSending(true);
    setSendError(null);
    autoScrollRef.current = true;
    try {
      await thread.sendMessage(prompt);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
      // Restore the draft so the user doesn't lose their message.
      setInput(prompt);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
    if (e.key === "Escape" && thread.isBusy) {
      e.preventDefault();
      void thread.cancel();
    }
  };

  const handleFork = async () => {
    if (!latest || !latest.claudeSessionId) return;
    // Use the existing resume endpoint with forkSession=true. "Continue."
    // is the same default the old Resume button used.
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(latest.runId)}/resume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Continue.", forkSession: true }),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { runId: string };
      router.push(
        `/dashboard/${encodeURIComponent(projectName)}/headless/runs/${encodeURIComponent(data.runId)}`
      );
    }
  };

  const handlePurge = async () => {
    if (!firstRun) return;
    if (
      !confirm(
        "Permanently delete this run and its event log? Other runs in the thread will remain."
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/headless/${encodeURIComponent(initialRunId)}?purge=1`,
      { method: "DELETE" }
    );
    if (res.ok) {
      router.push(`/dashboard/${encodeURIComponent(projectName)}/headless`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header card: thread-wide metrics + actions */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {latest && <StatusPill status={latest.status} />}
            {latest && <PermissionBadge mode={latest.permissionMode} />}
            {resolvedModel && (
              <span className="text-xs text-muted-foreground">
                {resolvedModel}
              </span>
            )}
            {latest?.effortLevel && (
              <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-border bg-muted/40">
                effort: {latest.effortLevel}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · stream {thread.streamStatus}
            </span>
            <span className="text-xs text-muted-foreground">
              · {thread.runs.length} {thread.runs.length === 1 ? "turn" : "turns"}
            </span>
          </div>
          <div className="flex gap-1">
            {thread.isBusy ? (
              <Button size="xs" variant="destructive" onClick={thread.cancel}>
                <Square className="size-3" />
                Cancel
              </Button>
            ) : (
              <>
                <Button size="xs" variant="outline" onClick={handleFork}>
                  <GitBranch className="size-3" />
                  Fork
                </Button>
                <Button size="xs" variant="destructive" onClick={handlePurge}>
                  <Trash2 className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Session timer */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3" />
            <span className="text-[10px] uppercase tracking-wide">Total</span>
            <span className="font-mono text-foreground">{formatDuration(totalMs)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="text-[10px] uppercase tracking-wide">Current turn</span>
            <span className={`font-mono ${thread.isBusy ? "text-foreground" : "text-muted-foreground"}`}>
              {formatDuration(currentTurnMs)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Metric label="Tokens in" value={formatTokens(aggregate.inputTokens)} />
          <Metric
            label="Tokens out"
            value={formatTokens(aggregate.outputTokens)}
          />
          <Metric label="Cost" value={formatCost(aggregate.totalCost)} />
          <Metric label="Turns" value={String(aggregate.totalTurns)} />
        </div>
        {/* Context window usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground uppercase tracking-wide">
              Context
            </span>
            <span
              className="font-mono text-foreground"
              title={
                contextUsage
                  ? `input ${contextUsage.input_tokens ?? 0} + cache_create ${contextUsage.cache_creation_input_tokens ?? 0} + cache_read ${contextUsage.cache_read_input_tokens ?? 0} + output ${contextUsage.output_tokens ?? 0}`
                  : "no usage yet"
              }
            >
              {formatTokens(contextUsed)} / {formatWindowSize(contextWindow)} (
              {(contextPct * 100).toFixed(contextPct < 0.1 ? 1 : 0)}%)
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${contextColor}`}
              style={{ width: `${Math.min(100, contextPct * 100).toFixed(2)}%` }}
            />
          </div>
        </div>
        {latest?.claudeSessionId && (
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            session: {latest.claudeSessionId}
          </div>
        )}
        {latest?.errorMessage && (
          <div className="text-xs text-destructive whitespace-pre-wrap">
            {latest.errorMessage}
          </div>
        )}
      </div>

      {/* Rate-limit banner: shown when the latest run failed due to a rate
          limit and we have (or can schedule) an auto-resume. */}
      {latest && (latest.rateLimited || latest.autoResumeAt) && (
        <RateLimitBanner
          projectName={projectName}
          run={latest}
          onChanged={thread.refresh}
        />
      )}

      {/* Pinned todo list from latest TodoWrite call */}
      {latestTodos.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <TodoChecklist todos={latestTodos} compact />
        </div>
      )}

      {/* Chat timeline */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="space-y-4 max-h-[65vh] overflow-y-auto rounded-lg border border-border bg-background p-4"
      >
        {thread.status === "loading" && thread.runs.length === 0 && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {thread.status === "error" && (
          <div className="text-sm text-destructive">
            {thread.error ?? "Failed to load thread"}
          </div>
        )}
        {thread.runs.map((run) => (
          <ChatTurn
            key={run.runId}
            run={run}
            events={thread.events[run.runId] ?? []}
            onAskAnswer={thread.sendMessage}
          />
        ))}
        {thread.runs.length > 0 && thread.isBusy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Claude is working…</span>
          </div>
        )}
      </div>

      {/* Chat input */}
      <form
        onSubmit={handleSend}
        className="rounded-lg border border-border bg-card p-3 space-y-2"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={thread.isBusy || sending}
          placeholder={
            thread.isBusy
              ? "Claude is working… press Esc to cancel"
              : "Send a follow-up… (Enter to send, Shift+Enter for newline)"
          }
          rows={3}
          className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2">
          {sendError ? (
            <span className="text-xs text-destructive">{sendError}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Continues session {latest?.claudeSessionId?.slice(0, 8)}…
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <VoiceInputButton
              disabled={thread.isBusy || sending}
              onTranscription={(text) => {
                setInput((prev) => {
                  const trimmed = prev.trimEnd();
                  return trimmed ? `${trimmed} ${text}` : text;
                });
                textareaRef.current?.focus();
              }}
            />
            <Button type="submit" size="sm" disabled={!canSend}>
              {sending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

interface ChatTurnProps {
  run: HeadlessRunMeta;
  events: unknown[];
  onAskAnswer?: (composed: string) => Promise<void>;
}

function ChatTurn({ run, events, onAskAnswer }: ChatTurnProps) {
  // Filter out system + stream_event; the user bubble already represents
  // the user's message for this turn.
  const displayEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!e || typeof e !== "object") return false;
        const t = (e as { type?: string }).type;
        return t !== "stream_event" && t !== "system";
      }),
    [events]
  );
  const isPending = run.status === "pending";
  const isRunning = run.status === "running";

  return (
    <div className="space-y-2">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            <User className="size-3" /> you
          </div>
          <div className="whitespace-pre-wrap">{run.prompt}</div>
        </div>
      </div>

      {/* Assistant area */}
      <div className="space-y-2 pl-1">
        {isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Waiting for Claude to start…</span>
          </div>
        )}
        {displayEvents.length === 0 && isRunning && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Thinking…</span>
          </div>
        )}
        {displayEvents.map((event, i) => (
          <EventCard key={i} event={event} onAskAnswer={onAskAnswer} />
        ))}
        {/* Turn footer: per-run metrics */}
        {!isPending && (run.totalCostUsd != null || run.numTurns != null) && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pl-1">
            <StatusPill status={run.status} />
            {run.totalCostUsd != null && <span>{formatCost(run.totalCostUsd)}</span>}
            {run.usage?.output_tokens != null && (
              <span>{formatTokens(run.usage.output_tokens)} out</span>
            )}
            {run.numTurns != null && <span>{run.numTurns} turns</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
