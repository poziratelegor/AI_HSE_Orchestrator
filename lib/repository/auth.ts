import { cookies } from "next/headers";

function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(payload) as { sub?: string };
  } catch {
    return null;
  }
}

function extractAccessTokenFromCookie(rawValue: string): string | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return rawValue;
  }
}

export async function getCurrentUserIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();

  const authCookie = cookieStore
    .getAll()
    .find((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

  if (!authCookie?.value) return null;

  const token = extractAccessTokenFromCookie(authCookie.value);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  return payload?.sub ?? null;
}
