"use client";
// Renders a Claude Code TodoWrite tool_use input as an interactive-looking
// checklist. Each invocation of TodoWrite is a full snapshot of the list, so
// the latest snapshot per thread represents the current state.
//
// Status values come from the Claude Code TodoWrite tool spec:
//   pending | in_progress | completed
//
// If Claude emits something else we fall back to a generic dot.

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | string;
  activeForm?: string;
}

interface TodoChecklistProps {
  todos: TodoItem[];
  /** Render without the surrounding card border — used when pinned in header. */
  compact?: boolean;
}

/**
 * Extract todos from a TodoWrite tool_use block's `input` field. Returns an
 * empty array if the shape doesn't match.
 */
export function extractTodos(input: unknown): TodoItem[] {
  if (!input || typeof input !== "object") return [];
  const maybe = (input as { todos?: unknown }).todos;
  if (!Array.isArray(maybe)) return [];
  const out: TodoItem[] = [];
  for (const item of maybe) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;
    if (typeof i.content !== "string") continue;
    out.push({
      content: i.content,
      status: typeof i.status === "string" ? i.status : "pending",
      activeForm: typeof i.activeForm === "string" ? i.activeForm : undefined,
    });
  }
  return out;
}

export function TodoChecklist({ todos, compact }: TodoChecklistProps) {
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  const wrapper = compact
    ? "space-y-1.5"
    : "rounded-md border border-border bg-card p-3 space-y-2";

  return (
    <div className={wrapper}>
      <div className="flex items-center justify-between text-xs">
        <div className="font-medium">Todos</div>
        <div className="text-muted-foreground">
          {completed} / {total} done
        </div>
      </div>
      {total > 0 && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-foreground/70 transition-all"
            style={{ width: `${total === 0 ? 0 : (completed / total) * 100}%` }}
          />
        </div>
      )}
      <ul className="space-y-1">
        {todos.map((todo, i) => {
          const isInProgress = todo.status === "in_progress";
          const isCompleted = todo.status === "completed";
          const label = isInProgress && todo.activeForm ? todo.activeForm : todo.content;
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="size-3.5 text-green-500" />
                ) : isInProgress ? (
                  <Loader2 className="size-3.5 animate-spin text-blue-500" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground" />
                )}
              </span>
              <span
                className={
                  isCompleted
                    ? "line-through text-muted-foreground"
                    : isInProgress
                    ? "text-foreground font-medium"
                    : "text-foreground"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
