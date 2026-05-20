"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export function usePolling<T>(url: string, interval: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e as Error);
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, interval]);

  return { data, error, loading, refetch: fetchData };
}
