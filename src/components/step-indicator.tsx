"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i <= currentStep
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < currentStep ? (
                <Check className="size-3.5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={cn(
                "text-xs hidden sm:inline",
                i === currentStep
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-6 transition-colors",
                i < currentStep
                  ? "bg-foreground"
                  : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
