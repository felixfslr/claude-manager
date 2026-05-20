"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";

type TerminalStatus = "connecting" | "connected" | "disconnected";

interface UseTerminalOptions {
  projectName: string;
  sessionName?: string;
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function useTerminal({
  projectName,
  sessionName,
  enabled,
  containerRef,
}: UseTerminalOptions) {
  const [status, setStatus] = useState<TerminalStatus>("disconnected");
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    fitAddonRef.current = null;
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      cleanup();
      return;
    }

    const container = containerRef.current;
    let disposed = false;

    async function init() {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all(
        [
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
        ]
      );

      // Load xterm CSS from public directory
      if (!document.querySelector('link[data-xterm-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/xterm.css";
        link.setAttribute("data-xterm-css", "");
        document.head.appendChild(link);
      }

      if (disposed) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        theme: {
          background: "#09090b",
          foreground: "#fafafa",
          cursor: "#fafafa",
          selectionBackground: "#27272a",
          black: "#09090b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#fafafa",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(container);

      // Small delay to let the container settle before fitting
      requestAnimationFrame(() => {
        if (!disposed) fitAddon.fit();
      });

      termRef.current = terminal;
      fitAddonRef.current = fitAddon;

      function connect() {
        if (disposed) return;
        setStatus("connecting");

        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        const sessionPath = sessionName && sessionName !== "default"
          ? `/${encodeURIComponent(sessionName)}`
          : "";
        const ws = new WebSocket(
          `${proto}//${location.host}/ws/terminal/${encodeURIComponent(projectName)}${sessionPath}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposed) return;
          setStatus("connected");
          // Send initial size
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            ws.send(
              JSON.stringify({
                type: "resize",
                cols: dims.cols,
                rows: dims.rows,
              })
            );
          }
        };

        ws.onmessage = (e) => {
          terminal.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data));
        };

        ws.onclose = () => {
          if (disposed) return;
          setStatus("disconnected");
          terminal.write("\r\n\x1b[33m[Disconnected — retrying...]\x1b[0m\r\n");
          retryTimerRef.current = setTimeout(() => {
            if (!disposed && enabledRef.current) connect();
          }, 3000);
        };

        ws.onerror = () => {
          // onclose will fire after this
        };

        terminal.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });
      }

      connect();

      // Resize observer
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (disposed) return;
          fitAddon.fit();
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "resize",
                cols: terminal.cols,
                rows: terminal.rows,
              })
            );
          }
        }, 100);
      });
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }

    let resizeCleanup: (() => void) | undefined;
    init().then((fn) => {
      resizeCleanup = fn;
    });

    return () => {
      disposed = true;
      resizeCleanup?.();
      cleanup();
    };
  }, [enabled, projectName, sessionName, containerRef, cleanup]);

  return { status };
}
