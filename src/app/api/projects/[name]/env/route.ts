import { NextRequest, NextResponse } from "next/server";
import { sanitizeName } from "@/lib/shell";
import { readEnvFile, writeEnvFile } from "@/lib/env-manager";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const env = new URL(request.url).searchParams.get("env") || "dev";
    const vars = await readEnvFile(name, env);
    return NextResponse.json(vars);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    sanitizeName(name);
    const { env, vars } = await request.json();
    await writeEnvFile(name, env, vars);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}
