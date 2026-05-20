import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cm_auth";
const TOKEN_SECRET = "claude-manager-auth";

// Uses Web Crypto-compatible hex output to match middleware
function generateToken(password: string): string {
  return createHmac("sha256", TOKEN_SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export function getAuthToken(): string {
  const password = process.env.DASHBOARD_PASSWORD || "";
  return generateToken(password);
}

export async function setAuthCookie(): Promise<void> {
  const token = getAuthToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return false;
  return cookie.value === getAuthToken();
}

export { COOKIE_NAME };
