"use client";
import { useState } from "react";
import { ChevronRight, Bot, User, Wrench, Settings, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TodoChecklist, extractTodos } from "./todo-checklist";
import { AskUserQuestionForm } from "./ask-question-form";

interface EventCardProps {
  event: unknown;
  /**
   * Optional handler called when the user answers an AskUserQuestion form.
   * The composed answer text will be sent as a follow-up message. If not
   * provided, the form renders but submission is disabled.
   */
  onAskAnswer?: (composedAnswer: string) => Promise<void>;
}

interface RawBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  [k: string]: unknown;
}

function getBlocks(message: unknown): RawBlock[] {
  if (!message || typeof message !== "object") return [];
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (Array.isArray(content)) return content as RawBlock[];
  return [];
}

function CollapsibleJson({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value, null, 2);
  const truncated = text.length > 240 ? text.slice(0, 240) + "…" : text;
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? "Hide" : "Show"}
      </button>
      <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px] text-muted-foreground">
        {open ? text : truncated}
      </pre>
    </div>
  );
}

export function EventCard({ event, onAskAnswer }: EventCardProps) {
  if (!event || typeof event !== "object") return null;
  const e = event as Record<string, unknown>;
  const type = e.type as string | undefined;
  const subtype = e.subtype as string | undefined;

  // ----- system events ----------------------------------------------------
  if (type === "system") {
    if (subtype === "init") {
      // The CLI emits model/session_id at the TOP LEVEL of system.init.
      // Fall back to .data for forward-compat if that ever changes.
      const data = e.data as Record<string, unknown> | undefined;
      const model =
        typeof e.model === "string" ? e.model : typeof data?.model === "string" ? data.model : undefined;
      const sessionId =
        typeof e.session_id === "string"
          ? e.session_id
          : typeof data?.session_id === "string"
          ? data.session_id
          : undefined;
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="size-3.5" />
          <span>session started</span>
          {model && (
            <Badge variant="outline" className="text-[10px]">{model}</Badge>
          )}
          {sessionId && (
            <span className="font-mono text-[10px] truncate">{sessionId}</span>
          )}
        </div>
      );
    }
    if (subtype === "api_retry") {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
          <span>API retry</span>
          {typeof e.attempt === "number" && (
            <span className="text-muted-foreground">
              attempt {e.attempt as number}/{e.max_retries as number}
            </span>
          )}
          {typeof e.error === "string" && <span className="text-muted-foreground">{e.error}</span>}
        </div>
      );
    }
    if (subtype === "compact_boundary") {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="size-3.5" />
          <span>context compacted</span>
        </div>
      );
    }
    return null;
  }

  // ----- result event -----------------------------------------------------
  if (type === "result") {
    const ok = subtype === "success";
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {ok ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <XCircle className="size-4 text-destructive" />
          )}
          {ok ? "Run finished" : `Run ended: ${subtype}`}
        </div>
        {typeof e.result === "string" && (
          <div className="mt-2 whitespace-pre-wrap text-sm">{e.result as string}</div>
        )}
      </div>
    );
  }

  // ----- assistant message ------------------------------------------------
  if (type === "assistant") {
    const blocks = getBlocks(e.message);
    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="size-3.5" /> assistant
        </div>
        {blocks.map((block, i) => {
          if (block.type === "text") {
            return (
              <div key={i} className="whitespace-pre-wrap text-sm">
                {block.text}
              </div>
            );
          }
          if (block.type === "tool_use") {
            // Special-case TodoWrite: render as a checklist instead of raw JSON.
            if (block.name === "TodoWrite") {
              const todos = extractTodos(block.input);
              if (todos.length > 0) {
                return <TodoChecklist key={i} todos={todos} />;
              }
            }
            // Special-case AskUserQuestion: render as an answerable form.
            if (block.name === "AskUserQuestion" && block.id) {
              return (
                <AskUserQuestionForm
                  key={i}
                  toolUseId={block.id}
                  input={block.input}
                  onSubmit={
                    onAskAnswer ??
                    (async () => {
                      // No handler wired in — form submission is a no-op but
                      // the visible summary still updates via sessionStorage.
                    })
                  }
                  disabled={!onAskAnswer}
                />
              );
            }
            return (
              <div key={i} className="rounded border border-border/60 bg-muted/40 p-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Wrench className="size-3.5" />
                  {block.name}
                </div>
                <CollapsibleJson value={block.input} />
              </div>
            );
          }
          return (
            <div key={i} className="text-xs text-muted-foreground">
              [unknown block: {block.type}]
            </div>
          );
        })}
      </div>
    );
  }

  // ----- user message (tool_result) --------------------------------------
  if (type === "user") {
    const blocks = getBlocks(e.message);
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="size-3.5" /> tool result
        </div>
        {blocks.map((block, i) => {
          if (block.type === "tool_result") {
            return <CollapsibleJson key={i} value={block.content} />;
          }
          if (block.type === "text") {
            return (
              <div key={i} className="whitespace-pre-wrap text-xs text-muted-foreground">
                {block.text}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // ----- stream_event (partial deltas) — render only as a dot ------------
  if (type === "stream_event") {
    return null;
  }

  // ----- synthetic / unknown ---------------------------------------------
  return (
    <div className="text-xs text-muted-foreground">
      <CollapsibleJson value={event} />
    </div>
  );
}
