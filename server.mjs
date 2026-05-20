import { createServer } from "http";
import { createHmac } from "crypto";
import { parse } from "url";
import { parse as parseCookie } from "cookie";
import next from "next";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const COOKIE_NAME = "cm_auth";
const TOKEN_SECRET = "claude-manager-auth";

function getExpectedToken() {
  const password = process.env.DASHBOARD_PASSWORD || "";
  return createHmac("sha256", TOKEN_SECRET).update(password).digest("hex");
}

function authenticate(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return false;
  const cookies = parseCookie(cookieHeader);
  return cookies[COOKIE_NAME] === getExpectedToken();
}

const PROJECT_NAME_RE = /^[a-zA-Z0-9_-]{1,50}$/;
const WS_PATH_RE = /^\/ws\/terminal\/([^/]+?)(?:\/([^/]+))?$/;
const WS_HEADLESS_RE = /^\/ws\/headless\/([^/]+?)\/([^/]+)$/;
const RUN_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const HEADLESS_ROOT = path.join(os.homedir(), ".claude-manager", "headless");

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  const headlessWss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "/");
    const ttyMatch = pathname?.match(WS_PATH_RE);
    const headlessMatch = pathname?.match(WS_HEADLESS_RE);

    if (!ttyMatch && !headlessMatch) {
      socket.destroy();
      return;
    }

    if (!authenticate(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    if (ttyMatch) {
      const projectName = decodeURIComponent(ttyMatch[1]);
      const sessionSuffix = ttyMatch[2] ? decodeURIComponent(ttyMatch[2]) : null;
      if (!PROJECT_NAME_RE.test(projectName)) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      if (sessionSuffix && !PROJECT_NAME_RE.test(sessionSuffix)) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, projectName, sessionSuffix);
      });
      return;
    }

    // headlessMatch
    const projectName = decodeURIComponent(headlessMatch[1]);
    const runId = decodeURIComponent(headlessMatch[2]);
    if (!PROJECT_NAME_RE.test(projectName) || !RUN_ID_RE.test(runId)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    headlessWss.handleUpgrade(req, socket, head, (ws) => {
      headlessWss.emit("connection", ws, req, projectName, runId);
    });
  });

  wss.on("connection", (ws, req, projectName, sessionSuffix) => {
    const sessionName = sessionSuffix && sessionSuffix !== "default"
      ? `claude-${projectName}--${sessionSuffix}`
      : `claude-${projectName}`;
    let ptyProcess;

    try {
      ptyProcess = pty.spawn("tmux", ["attach-session", "-t", sessionName], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        env: { ...process.env, TERM: "xterm-256color" },
      });
    } catch {
      ws.send(`\r\nFailed to attach to tmux session "${sessionName}"\r\n`);
      ws.close();
      return;
    }

    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send("\r\n[Session ended]\r\n");
        ws.close();
      }
    });

    ws.on("message", (msg) => {
      const str = msg.toString();
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — treat as terminal input
      }
      ptyProcess.write(str);
    });

    ws.on("close", () => {
      ptyProcess.kill();
    });
  });

  // ----- Headless run WS bridge (disk-tail) ------------------------------
  // Reads ~/.claude-manager/headless/<project>/<runId>/{meta.json,events.jsonl}
  // and forwards new events to the client. Decoupled from the API process so
  // it survives Next dev-mode HMR and route module reloads.

  function safeJson(line) {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }

  async function readMetaSafe(metaPath) {
    try {
      const raw = await fsp.readFile(metaPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isTerminalStatus(status) {
    return (
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "orphaned"
    );
  }

  headlessWss.on("connection", async (ws, _req, projectName, runId) => {
    const runDir = path.join(HEADLESS_ROOT, projectName, runId);
    // Containment check.
    const resolvedDir = path.resolve(runDir);
    if (!resolvedDir.startsWith(path.resolve(HEADLESS_ROOT) + path.sep)) {
      ws.close();
      return;
    }
    const eventsPath = path.join(runDir, "events.jsonl");
    const metaPath = path.join(runDir, "meta.json");

    let offset = 0;
    let tail = "";
    let watcher = null;
    let metaWatcher = null;
    let closed = false;
    let pending = false;

    const send = (kind, payload) => {
      if (ws.readyState !== ws.OPEN) return;
      try {
        ws.send(JSON.stringify({ kind, payload }));
      } catch {
        // ignore
      }
    };

    const closeAll = (reason) => {
      if (closed) return;
      closed = true;
      try { watcher && watcher.close(); } catch {}
      try { metaWatcher && metaWatcher.close(); } catch {}
      send("closed", reason ? { reason } : undefined);
      try { ws.close(); } catch {}
    };

    const drainEvents = async () => {
      if (pending || closed) return;
      pending = true;
      try {
        let stat;
        try {
          stat = await fsp.stat(eventsPath);
        } catch {
          return; // no events yet
        }
        if (stat.size < offset) {
          // File truncated/rotated — restart from 0.
          offset = 0;
          tail = "";
        }
        if (stat.size === offset) return;
        const fd = await fsp.open(eventsPath, "r");
        try {
          const len = stat.size - offset;
          const buf = Buffer.alloc(len);
          await fd.read(buf, 0, len, offset);
          offset = stat.size;
          tail += buf.toString("utf-8");
          const lines = tail.split("\n");
          tail = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const parsed = safeJson(line);
            if (parsed) send("event", parsed);
          }
        } finally {
          await fd.close();
        }
      } catch (err) {
        console.error(`[headless-ws ${runId}] drain error:`, err);
      } finally {
        pending = false;
      }
    };

    const refreshMeta = async () => {
      const meta = await readMetaSafe(metaPath);
      if (!meta) return null;
      send("meta", meta);
      return meta;
    };

    // Initial replay: existing events + meta.
    await drainEvents();
    const initialMeta = await refreshMeta();
    if (initialMeta && isTerminalStatus(initialMeta.status)) {
      // Drain one more time in case the runner appended between reads.
      await drainEvents();
      closeAll(initialMeta.status);
      return;
    }

    // Live tail.
    try {
      watcher = fs.watch(runDir, { persistent: true }, (_eventType, filename) => {
        if (filename === "events.jsonl" || filename === null) {
          drainEvents().catch(() => {});
        }
        if (filename === "meta.json" || filename === null) {
          refreshMeta()
            .then((meta) => {
              if (meta && isTerminalStatus(meta.status)) {
                drainEvents().then(() => closeAll(meta.status));
              }
            })
            .catch(() => {});
        }
      });
    } catch (err) {
      console.error(`[headless-ws ${runId}] watch failed:`, err);
      closeAll("watch_error");
      return;
    }

    // Periodic poll as a safety net (some FS edge-cases miss notifications).
    const pollInterval = setInterval(() => {
      if (closed) return;
      drainEvents().catch(() => {});
      refreshMeta()
        .then((meta) => {
          if (meta && isTerminalStatus(meta.status)) {
            drainEvents().then(() => closeAll(meta.status));
          }
        })
        .catch(() => {});
    }, 2000);

    ws.on("close", () => {
      clearInterval(pollInterval);
      closeAll();
    });
  });

  server.listen(port, () => {
    console.log(
      `> Server listening at http://localhost:${port} as ${
        dev ? "development" : process.env.NODE_ENV
      }`
    );
  });
});
