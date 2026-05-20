// Heuristic rate-limit detection for failed headless runs.
//
// The Claude CLI wraps API errors in different shapes depending on where the
// limit was hit (API 429, usage quota, billing limit). We scan error strings
// for common patterns and try to extract a reset time if one was provided.
//
// This is intentionally forgiving: a false positive just shows the user a
// resume button they don't need; a false negative falls through to the
// regular "failed" path. When no reset time can be parsed we fall back to
// 1 hour from now so the user still gets an actionable button.

const RATE_LIMIT_PATTERNS = [
  /rate[\s_-]?limit/i,
  /quota\s*(exceeded|reached)/i,
  /\b429\b/,
  /too many requests/i,
  /usage.{0,20}(limit|exceeded|reached)/i,
  /limit.{0,20}reached/i,
  /limit.{0,20}exceeded/i,
  /try again in \d+/i,
  /billing.{0,20}limit/i,
];

const UNIT_MS: Record<string, number> = {
  second: 1000,
  sec: 1000,
  s: 1000,
  minute: 60_000,
  min: 60_000,
  m: 60_000,
  hour: 3_600_000,
  hr: 3_600_000,
  h: 3_600_000,
  day: 86_400_000,
  d: 86_400_000,
};

export function isRateLimitError(message: string | undefined): boolean {
  if (!message) return false;
  return RATE_LIMIT_PATTERNS.some((p) => p.test(message));
}

/**
 * Try to extract an ISO reset time from a rate-limit error message. Supports
 * several common formats; returns undefined if nothing matches.
 */
export function parseResetTime(message: string | undefined): string | undefined {
  if (!message) return undefined;

  // "try again in 45 seconds" / "retry after 5 min" / "in 2 hours"
  const relative = message.match(
    /(?:try again|retry(?:\s*after)?|available\s+in|resets?\s+in)[^\d]{0,10}(\d+)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d)\b/i
  );
  if (relative) {
    const n = parseInt(relative[1], 10);
    const unit = relative[2].toLowerCase();
    const ms = n * (UNIT_MS[unit] ?? 1000);
    return new Date(Date.now() + ms).toISOString();
  }

  // "resets at 2026-04-08T23:00:00Z" or bare ISO anywhere in the message
  const iso = message.match(
    /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/
  );
  if (iso) {
    const d = new Date(iso[1]);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // "resets: 1234567890" (unix seconds or millis)
  const unix = message.match(/reset(?:s|\s*at)?:?\s*(\d{10,13})/i);
  if (unix) {
    const raw = parseInt(unix[1], 10);
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return undefined;
}

export interface RateLimitDetection {
  isRateLimit: boolean;
  resetsAt?: string;
}

/**
 * Run detection over an error message (and optionally a few other signal
 * strings) and return both the classification and a reset time. When we
 * detect a rate limit but can't parse a time, we default to 1 hour out.
 */
export function detectRateLimit(...sources: (string | undefined)[]): RateLimitDetection {
  const combined = sources.filter((s): s is string => !!s).join("\n");
  if (!isRateLimitError(combined)) return { isRateLimit: false };
  const parsed = parseResetTime(combined);
  return {
    isRateLimit: true,
    resetsAt: parsed ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
