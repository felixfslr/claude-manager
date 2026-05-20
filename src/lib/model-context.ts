// Maps a Claude model name to its context window in tokens, and helpers for
// computing how many of those tokens are currently in use from the `usage`
// shape emitted by the streamed `message_delta` and `result` events.
//
// Verified against https://platform.claude.com/docs/en/build-with-claude/context-windows
// Opus 4.6 and Sonnet 4.6 have a 1M window; everything else is 200k.

import type { HeadlessUsage } from "./headless-types";

export const DEFAULT_CONTEXT_WINDOW = 200_000;
export const LARGE_CONTEXT_WINDOW = 1_000_000;

/** Return the token budget for the given model, falling back to 200k. */
export function getContextWindow(model?: string): number {
  if (!model) return DEFAULT_CONTEXT_WINDOW;
  const m = model.toLowerCase();
  // The `[1m]` suffix (used by claude-opus-4-6[1m]) marks the explicit
  // 1M-token variant. Non-suffixed 4.6 models also ship with 1M.
  if (m.includes("opus-4-6") || m.includes("sonnet-4-6")) return LARGE_CONTEXT_WINDOW;
  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * All input + cache + output tokens count against the context window per the
 * docs. `cache_creation_input_tokens` and `cache_read_input_tokens` are
 * NOT already included in `input_tokens`, so we must sum all four fields.
 */
export function computeContextUsed(usage: HeadlessUsage | undefined): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.output_tokens ?? 0)
  );
}

/** Format a token count for display: 1.5k, 145k, 1.2M. */
export function formatWindowSize(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
  return String(tokens);
}
