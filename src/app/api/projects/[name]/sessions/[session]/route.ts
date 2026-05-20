import { NextRequest, NextResponse } from "next/server";
import { startSession, stopSession, capturePaneOutput } from "@/lib/tmux";
import { sanitizeName } from "@/lib/shell";
import type { SessionAction } from "@/lib/types";

async function checkSessionError(projectName: string, session: string): Promise<string | null> {
  const base = `claude-${sanitizeName(projectName)}`;
  const sName = !session || session === "default" ? base : `${base}--${sanitizeName(session)}`;
  await new Promise((r) => setTimeout(r, 3000));
  const output = await capturePaneOutput(sName);
  if (!output) return "Session exited immediately – check server logs";
  const errorMatch = output.match(/Error:\s*(.+)/);
  if (errorMatch) return errorMatch[1].trim();
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; session: string }> }
) {
  try {
    const { name, session } = await params;
    sanitizeName(name);
    sanitizeName(session);
    const { action } = (await request.json()) as { action: SessionAction };

    switch (action) {
      case "start": {
        await startSession(name, session);
        const err = await checkSessionError(name, session);
        if (err) {
          return NextResponse.json({ error: err }, { status: 500 });
        }
        break;
      }
      case "stop":
        await stopSession(name, session);
        break;
      case "restart": {
        try {
          await stopSession(name, session);
        } catch {
          // might not be running
        }
        await new Promise((r) => setTimeout(r, 1000));
        await startSession(name, session);
        const err = await checkSessionError(name, session);
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
