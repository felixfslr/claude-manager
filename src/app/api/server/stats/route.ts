import { NextResponse } from "next/server";
import os from "os";
import type { ServerStats } from "@/lib/types";

export async function GET() {
  const stats: ServerStats = {
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    cpuCount: os.cpus().length,
  };
  return NextResponse.json(stats);
}
