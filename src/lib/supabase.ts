import { getToken } from "./settings";
import type { SupabaseProject, SupabaseTable } from "./types";

const BASE_URL = "https://api.supabase.com/v1";

async function supaFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getToken("supabaseAccessToken");
  if (!token) throw new Error("Supabase access token not configured");

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
    throw new Error((body as { message?: string }).message || `Supabase API error: ${res.status}`);
  }

  return res;
}

export async function listSupabaseProjects(): Promise<SupabaseProject[]> {
  const res = await supaFetch("/projects");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    region: p.region,
    status: p.status,
  }));
}

export async function listTables(projectRef: string): Promise<SupabaseTable[]> {
  // Use the database query endpoint
  const query = `
    SELECT table_schema, table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;
  const res = await supaFetch(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await res.json();

  const tableMap = new Map<string, SupabaseTable>();
  for (const row of rows) {
    if (!tableMap.has(row.table_name)) {
      tableMap.set(row.table_name, {
        schema: row.table_schema,
        name: row.table_name,
        columns: [],
      });
    }
    tableMap.get(row.table_name)!.columns.push({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
    });
  }

  return Array.from(tableMap.values());
}

export async function executeSql(projectRef: string, query: string): Promise<unknown[]> {
  const res = await supaFetch(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function listMigrations(projectRef: string): Promise<{ version: string; name: string }[]> {
  const res = await supaFetch(`/projects/${projectRef}/database/migrations`);
  return res.json();
}
