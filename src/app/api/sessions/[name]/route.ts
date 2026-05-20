import { NextRequest, NextResponse } from "next/server";
import { startSession, stopSession, capturePaneOutput } from "@/lib/tmux";
import { sanitizeName } from "@/lib/shell";
import type { SessionAction } from "@/lib/types";

/**
 * Wait briefly after starting a session, then check the tmux pane
 * for an error message. Returns the error string or null.
 */
async function checkSessionError(projectName: string): Promise<string | null> {
  const sName = `claude-${sanitizeName(projectName)}`;
  // Give the process a moment to start (or fail)
  await new Promise((r) => setTimeout(r, 3000));
  const output = await capturePaneOutput(sName);
  if (!output) return "Session exited immediately – check server logs";
  const errorMatch = output.match(/Error:\s*(.+)/);
  if (errorMatch) return errorMatch[1].trim();
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { action } = (await request.json()) as { action: SessionAction };

    switch (action) {
      case "start": {
        await startSession(name);
        const err = await checkSessionError(name);
        if (err) {
          return NextResponse.json({ error: err }, { status: 500 });
        }
        break;
      }
      case "stop":
        await stopSession(name);
        break;
      case "restart": {
        try {
          await stopSession(name);
        } catch {
          // might not be running
        }
        await new Promise((r) => setTimeout(r, 1000));
        await startSession(name);
        const err = await checkSessionError(name);
        if (err) {
          return NextResponse.json({ error: err }, { status: 500 });
        }
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session operation failed" },
      { status: 400 }
    );
  }
}
