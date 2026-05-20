"use client";
// Re-renders the consuming component at a fixed interval while `active` is
// true. Used by the session timer in chat-thread to advance the live clock.

import { useEffect, useState } from "react";

export function useTick(active: boolean, intervalMs = 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return tick;
}
