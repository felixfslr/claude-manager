"use client";
// Renders a Claude AskUserQuestion tool_use as an answerable form. When the
// user submits, the composed answers are sent as a follow-up message via
// the thread's sendMessage — this starts a new run with --resume against the
// same session id, mirroring how the interactive Claude Code client handles it.
//
// State is keyed on the tool_use `id` via sessionStorage so answering once
// persists across remounts (e.g. when the ChatThread re-renders due to new
// events).

import { useEffect, useMemo, useState } from "react";
import { Check, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AskQuestion {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options?: { label: string; description?: string }[];
}

interface AskUserQuestionFormProps {
  toolUseId: string;
  input: unknown;
  onSubmit: (composed: string) => Promise<void>;
  disabled?: boolean;
}

function extractQuestions(input: unknown): AskQuestion[] {
  if (!input || typeof input !== "object") return [];
  const maybe = (input as { questions?: unknown }).questions;
  if (!Array.isArray(maybe)) return [];
  const out: AskQuestion[] = [];
  for (const q of maybe) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    if (typeof o.question !== "string") continue;
    const rawOptions = Array.isArray(o.options) ? o.options : [];
    const options: { label: string; description?: string }[] = [];
    for (const opt of rawOptions) {
      if (!opt || typeof opt !== "object") continue;
      const oo = opt as Record<string, unknown>;
      if (typeof oo.label !== "string") continue;
      options.push({
        label: oo.label,
        description: typeof oo.description === "string" ? oo.description : undefined,
      });
    }
    out.push({
      question: o.question,
      header: typeof o.header === "string" ? o.header : undefined,
      multiSelect: o.multiSelect === true,
      options,
    });
  }
  return out;
}

function storageKey(id: string): string {
  return `claude-manager:askuser:${id}`;
}

function loadSaved(id: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveAnswers(id: string, answers: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(id), JSON.stringify(answers));
  } catch {
    // ignore
  }
}

export function AskUserQuestionForm({
  toolUseId,
  input,
  onSubmit,
  disabled,
}: AskUserQuestionFormProps) {
  const questions = useMemo(() => extractQuestions(input), [input]);
  // One selected string per question (semicolon-joined when multiSelect). Empty = not answered yet.
  const [selections, setSelections] = useState<string[]>(() => questions.map(() => ""));
  const [customText, setCustomText] = useState<string[]>(() => questions.map(() => ""));
  const [submitting, setSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<string[] | null>(() =>
    loadSaved(toolUseId)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If a new tool_use id is mounted, check storage again.
    setSubmittedSummary(loadSaved(toolUseId));
  }, [toolUseId]);

  if (questions.length === 0) return null;

  if (submittedSummary) {
    return (
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
          <Check className="size-3.5" />
          Answered
        </div>
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {questions.map((q, i) => (
            <li key={i}>
              <span className="text-foreground">{q.header ?? `Q${i + 1}`}:</span>{" "}
              {submittedSummary[i] || "(no answer)"}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const setAnswer = (idx: number, value: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const next = prev.slice();
      if (!multiSelect) {
        next[idx] = value;
        return next;
      }
      const current = new Set(next[idx] ? next[idx].split("; ") : []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      next[idx] = Array.from(current).join("; ");
      return next;
    });
  };

  const allAnswered = questions.every((q, i) => {
    return (selections[i] && selections[i].length > 0) || customText[i].trim().length > 0;
  });

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    const answered = questions.map((q, i) => {
      const custom = customText[i].trim();
      const picked = selections[i];
      if (custom && !picked) return custom;
      if (picked && custom) return `${picked} (${custom})`;
      return picked || "";
    });
    const composed = questions
      .map((q, i) => {
        const label = q.header ?? `Q${i + 1}`;
        return `${i + 1}. ${label}: ${answered[i]}`;
      })
      .join("\n");
    try {
      await onSubmit(composed);
      saveAnswers(toolUseId, answered);
      setSubmittedSummary(answered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send answers");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
        <HelpCircle className="size-3.5" />
        Claude has questions
      </div>
      {questions.map((q, i) => {
        const multi = q.multiSelect === true;
        const selectedValues = new Set(selections[i] ? selections[i].split("; ") : []);
        return (
          <div key={i} className="space-y-1.5">
            <div className="text-sm">
              {q.header && (
                <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium mr-1.5 align-middle">
                  {q.header}
                </span>
              )}
              {q.question}
              {multi && (
                <span className="text-[10px] text-muted-foreground ml-1">(pick any)</span>
              )}
            </div>
            {q.options && q.options.length > 0 ? (
              <div className="space-y-1">
                {q.options.map((opt, j) => {
                  const active = multi
                    ? selectedValues.has(opt.label)
                    : selections[i] === opt.label;
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setAnswer(i, opt.label, multi)}
                      disabled={disabled || submitting}
                      className={`block w-full text-left rounded-md border p-2 text-xs transition-colors ${
                        active
                          ? "border-foreground bg-foreground/5 ring-1 ring-foreground/20"
                          : "border-border hover:border-foreground/30 hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[10px] text-muted-foreground">
                          {opt.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <input
              type="text"
              placeholder="Or type a custom answer…"
              value={customText[i]}
              onChange={(e) =>
                setCustomText((prev) => {
                  const next = prev.slice();
                  next[i] = e.target.value;
                  return next;
                })
              }
              disabled={disabled || submitting}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:border-ring"
            />
          </div>
        );
      })}
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex justify-end">
        <Button
          type="button"
          size="xs"
          onClick={handleSubmit}
          disabled={disabled || submitting || !allAnswered}
        >
          {submitting ? <Loader2 className="size-3 animate-spin" /> : null}
          Send answers
        </Button>
      </div>
    </div>
  );
}
