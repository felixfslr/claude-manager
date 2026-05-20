// Shared types for headless Claude runs, prompts library, and loops.
// IMPORTANT: this module must remain free of Node-only imports — it is
// imported from both server libs and client components.

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "bypassPermissions";

/** Matches the claude CLI --effort flag. "max" is Opus 4.6 only. */
export type EffortLevel = "low" | "medium" | "high" | "max";

export type HeadlessRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "orphaned";

/** What the UI POSTs to start a run. */
export interface HeadlessRunRequest {
  prompt: string;
  permissionMode: PermissionMode;
  model?: string;
  /** Passed through as `--effort` to the claude CLI. */
  effortLevel?: EffortLevel;
  maxTurns?: number;
  maxBudgetUsd?: number;
  appendSystemPrompt?: string;
  allowedTools?: string;
  disallowedTools?: string;
  addDirs?: string[];
  resumeSessionId?: string;
  forkSession?: boolean;
  /** If set, this run is a phase of a parent loop run. */
  parentLoopRunId?: string;
  /** If set, label this run with the loop phase name for display. */
  loopPhaseName?: string;
}

/** Token usage reported by Claude in `result` or `message_delta` events. */
export interface HeadlessUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** What we persist to meta.json next to the events file. */
export interface HeadlessRunMeta {
  runId: string;
  projectName: string;
  cwd: string;
  prompt: string;
  permissionMode: PermissionMode;
  model?: string;
  effortLevel?: EffortLevel;
  maxTurns?: number;
  maxBudgetUsd?: number;
  appendSystemPrompt?: string;
  allowedTools?: string;
  disallowedTools?: string;
  addDirs?: string[];
  resumeSessionId?: string;
  forkSession?: boolean;
  parentLoopRunId?: string;
  loopPhaseName?: string;
  status: HeadlessRunStatus;
  /** PID of the spawned `claude -p` process while it lives. */
  pid?: number;
  /** session_id reported in the first system.init event. */
  claudeSessionId?: string;
  startedAt: string;
  endedAt?: string;
  usage?: HeadlessUsage;
  totalCostUsd?: number;
  numTurns?: number;
  /** Final `result.subtype` (success | error_max_turns | ...). */
  resultSubtype?: string;
  /** Final assistant text from the result event, for loop pattern matching. */
  resultText?: string;
  exitCode?: number;
  errorMessage?: string;
  /** True when this run failed because Claude hit a usage/rate limit. */
  rateLimited?: boolean;
  /** ISO timestamp when the rate limit window is expected to reset. */
  rateLimitResetsAt?: string;
  /** If set, the auto-resume scheduler will kick off a /resume at this time. */
  autoResumeAt?: string;
  /** Set once the scheduler has started a resume for this run — prevents double-fire. */
  autoResumeStartedAt?: string;
  /** Prompt to use when auto-resuming. Defaults to "Continue." */
  autoResumePrompt?: string;
  /** Error from the last failed auto-resume attempt. */
  autoResumeError?: string;
}

/** Wire envelope sent over the WebSocket. */
export type HeadlessEventEnvelope =
  | { kind: "event"; payload: unknown }
  | { kind: "meta"; payload: HeadlessRunMeta }
  | { kind: "closed"; payload?: { reason?: string } };

// ----- Loops --------------------------------------------------------------

export interface LoopPhase {
  name: string;
  prompt: string;
  permissionMode: PermissionMode;
  /** Resume the previous phase's claude session_id via --resume. */
  resumePrevious?: boolean;
  /** Regex applied to result text — phase considered successful if it matches. */
  successPattern?: string;
  /** Regex applied to result text — phase considered failed if it matches. */
  failPattern?: string;
  /** Number of times this phase will retry on failure (default 0). */
  maxRetries?: number;
  model?: string;
  maxTurns?: number;
  appendSystemPrompt?: string;
  allowedTools?: string;
  disallowedTools?: string;
}

export interface LoopDef {
  id: string;
  projectName: string;
  name: string;
  description?: string;
  phases: LoopPhase[];
  createdAt: string;
  updatedAt: string;
}

export type LoopRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface LoopPhaseRun {
  phaseIndex: number;
  phaseName: string;
  attempt: number;
  runId: string;
  status: HeadlessRunStatus;
  startedAt: string;
  endedAt?: string;
}

export interface LoopRunState {
  loopRunId: string;
  loopId: string;
  projectName: string;
  status: LoopRunStatus;
  startedAt: string;
  endedAt?: string;
  currentPhaseIndex?: number;
  phaseRuns: LoopPhaseRun[];
  errorMessage?: string;
}
