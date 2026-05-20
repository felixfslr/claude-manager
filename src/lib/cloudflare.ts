import { getToken } from "./settings";
import type { CloudflareZone, CloudflareDnsRecord, CloudflareTunnel } from "./types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

async function cfFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getToken("cloudflareApiToken");
  if (!token) throw new Error("Cloudflare API token not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errors = (body as { errors?: { message: string }[] }).errors;
    throw new Error(
      errors?.[0]?.message || `Cloudflare API error: ${res.status}`
    );
  }

  return res;
}

// Zones

export async function listZones(): Promise<CloudflareZone[]> {
  const res = await cfFetch("/zones?per_page=50&status=active");
  const data = await res.json();
  return ((data as { result: Record<string, unknown>[] }).result || []).map(
    (z) => ({
      id: z.id as string,
      name: z.name as string,
      status: z.status as string,
    })
  );
}

export async function getZone(zoneId: string): Promise<CloudflareZone> {
  const res = await cfFetch(`/zones/${encodeURIComponent(zoneId)}`);
  const data = await res.json();
  const z = (data as { result: Record<string, unknown> }).result;
  return { id: z.id as string, name: z.name as string, status: z.status as string };
}

// DNS Records

export async function listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
  const res = await cfFetch(
    `/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100`
  );
  const data = await res.json();
  return ((data as { result: Record<string, unknown>[] }).result || []).map(
    (r) => ({
      id: r.id as string,
      type: r.type as string,
      name: r.name as string,
      content: r.content as string,
      proxied: r.proxied as boolean,
      ttl: r.ttl as number,
    })
  );
}

export async function createDnsRecord(
  zoneId: string,
  record: { type: string; name: string; content: string; proxied?: boolean; ttl?: number }
): Promise<CloudflareDnsRecord> {
  const res = await cfFetch(
    `/zones/${encodeURIComponent(zoneId)}/dns_records`,
    {
      method: "POST",
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied ?? true,
        ttl: record.ttl ?? 1,
      }),
    }
  );
  const data = await res.json();
  const r = (data as { result: Record<string, unknown> }).result;
  return {
    id: r.id as string,
    type: r.type as string,
    name: r.name as string,
    content: r.content as string,
    proxied: r.proxied as boolean,
    ttl: r.ttl as number,
  };
}

export async function updateDnsRecord(
  zoneId: string,
  recordId: string,
  updates: { type?: string; name?: string; content?: string; proxied?: boolean }
): Promise<CloudflareDnsRecord> {
  const res = await cfFetch(
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );
  const data = await res.json();
  const r = (data as { result: Record<string, unknown> }).result;
  return {
    id: r.id as string,
    type: r.type as string,
    name: r.name as string,
    content: r.content as string,
    proxied: r.proxied as boolean,
    ttl: r.ttl as number,
  };
}

export async function deleteDnsRecord(
  zoneId: string,
  recordId: string
): Promise<void> {
  await cfFetch(
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    { method: "DELETE" }
  );
}

// Tunnels

export async function listTunnels(): Promise<CloudflareTunnel[]> {
  const accountId = await getToken("cloudflareAccountId");
  if (!accountId) throw new Error("Cloudflare Account ID not configured");

  const res = await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel?is_deleted=false`
  );
  const data = await res.json();
  return ((data as { result: Record<string, unknown>[] }).result || []).map(
    (t) => ({
      id: t.id as string,
      name: t.name as string,
      status: t.status as string,
    })
  );
}

export async function createTunnel(
  name: string
): Promise<{ tunnel: CloudflareTunnel; token: string }> {
  const accountId = await getToken("cloudflareAccountId");
  if (!accountId) throw new Error("Cloudflare Account ID not configured");

  const res = await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        tunnel_secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
      }),
    }
  );
  const data = await res.json();
  const t = (data as { result: Record<string, unknown> }).result;

  // Get tunnel token
  const tokenRes = await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${t.id}/token`
  );
  const tokenData = await tokenRes.json();

  return {
    tunnel: {
      id: t.id as string,
      name: t.name as string,
      status: t.status as string,
    },
    token: (tokenData as { result: string }).result,
  };
}

export async function deleteTunnel(tunnelId: string): Promise<void> {
  const accountId = await getToken("cloudflareAccountId");
  if (!accountId) throw new Error("Cloudflare Account ID not configured");

  await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}`,
    { method: "DELETE" }
  );
}

export async function getTunnelToken(tunnelId: string): Promise<string> {
  const accountId = await getToken("cloudflareAccountId");
  if (!accountId) throw new Error("Cloudflare Account ID not configured");

  const res = await cfFetch(
    `/accounts/${encodeURIComponent(accountId)}/cfd_tunnel/${encodeURIComponent(tunnelId)}/token`
  );
  const data = await res.json();
  return (data as { result: string }).result;
}
