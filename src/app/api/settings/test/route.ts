import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const { service } = await request.json();

    if (service === "github") {
      const token = await getToken("githubToken");
      if (!token) return NextResponse.json({ ok: false, error: "No token configured" });
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Invalid token" });
      const user = await res.json();
      return NextResponse.json({ ok: true, info: user.login });
    }

    if (service === "vercel") {
      const token = await getToken("vercelToken");
      if (!token) return NextResponse.json({ ok: false, error: "No token configured" });
      const res = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Invalid token" });
      const data = await res.json();
      return NextResponse.json({ ok: true, info: data.user?.username || data.user?.name || "Connected" });
    }

    if (service === "cloudflare") {
      const token = await getToken("cloudflareApiToken");
      if (!token) return NextResponse.json({ ok: false, error: "No token configured" });
      const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Invalid token" });
      const data = await res.json();
      return NextResponse.json({ ok: true, info: data.result?.status || "Active" });
    }

    if (service === "supabase") {
      const token = await getToken("supabaseAccessToken");
      if (!token) return NextResponse.json({ ok: false, error: "No token configured" });
      const res = await fetch("https://api.supabase.com/v1/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: "Invalid token" });
      const projects = await res.json();
      return NextResponse.json({ ok: true, info: `${projects.length} projects` });
    }

    return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
