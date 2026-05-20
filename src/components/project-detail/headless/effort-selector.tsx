"use client";
// Segmented control for the claude --effort flag. "max" is only available
// on Opus 4.6; we disable the button unless the model field is empty (i.e.
// user's configured default) or explicitly references opus-4-6.

import { Label } from "@/components/ui/label";
import type { EffortLevel } from "@/lib/headless-types";

interface EffortSelectorProps {
  value: EffortLevel | undefined;
  onChange: (next: EffortLevel | undefined) => void;
  /** Current model field from the run form. Used to gate "Max". */
  model?: string;
}

const OPTIONS: { value: EffortLevel; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "Fast, minimal reasoning" },
  { value: "medium", label: "Medium", description: "Balanced default" },
  { value: "high", label: "High", description: "Deeper reasoning" },
  { value: "max", label: "Max", description: "Opus 4.6 only" },
];

export function EffortSelector({ value, onChange, model }: EffortSelectorProps) {
  const modelLower = (model ?? "").toLowerCase();
  const maxAllowed = !modelLower || modelLower.includes("opus-4-6") || modelLower === "opus";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Effort level</Label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {OPTIONS.map((opt) => {
          const disabled = opt.value === "max" && !maxAllowed;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`rounded-md border p-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                selected
                  ? "border-foreground bg-foreground/5 ring-1 ring-foreground/20"
                  : "border-border hover:border-foreground/30 hover:bg-muted"
              }`}
              title={disabled ? "Max requires Opus 4.6" : opt.description}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">
                {opt.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
