import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import {
  listLoops,
  saveLoop,
  newLoop,
  PLAN_IMPLEMENT_TEST_DEBUG_TEMPLATE,
} from "@/lib/loops";
import type { LoopPhase } from "@/lib/headless-types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const loops = await listLoops(name);
    return NextResponse.json(loops);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list loops" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      phases?: LoopPhase[];
      template?: "plan-implement-test-debug";
    };

    let phases: LoopPhase[] | undefined;
    if (body.template === "plan-implement-test-debug") {
      phases = PLAN_IMPLEMENT_TEST_DEBUG_TEMPLATE.map((p) => ({ ...p }));
    } else {
      phases = body.phases;
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!Array.isArray(phases) || phases.length === 0) {
      return NextResponse.json({ error: "phases must be a non-empty array" }, { status: 400 });
    }

    const loop = newLoop(name, body.name, phases, body.description);
    await saveLoop(loop);
    return NextResponse.json(loop, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create loop" },
      { status: 400 }
    );
  }
}
