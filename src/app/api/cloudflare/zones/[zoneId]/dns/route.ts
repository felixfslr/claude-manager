import { NextRequest, NextResponse } from "next/server";
import {
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
} from "@/lib/cloudflare";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const records = await listDnsRecords(zoneId);
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list DNS records" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const body = await request.json();
    const record = await createDnsRecord(zoneId, body);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create DNS record" },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const { recordId, ...updates } = await request.json();
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }
    const record = await updateDnsRecord(zoneId, recordId, updates);
    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update DNS record" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const { recordId } = await request.json();
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }
    await deleteDnsRecord(zoneId, recordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete DNS record" },
      { status: 400 }
    );
  }
}
