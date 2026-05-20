import { NextRequest, NextResponse } from "next/server";
import { listTemplates, saveTemplate } from "@/lib/templates";

export async function GET() {
  try {
    const templates = await listTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const template = await request.json();
    await saveTemplate(template);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 }
    );
  }
}
