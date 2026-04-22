/**
 * Canonical base URL for Supabase Auth redirects.
 *
 * Why:
 * - In Vercel, users can open both production and preview domains.
 * - Supabase email/OAuth redirects must match allowed redirect URLs.
 * - Using a canonical origin prevents session fragmentation between domains.
 */
export function getCanonicalAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Build absolute redirect URL for Supabase auth actions.
 *
 * Falls back to current browser origin when NEXT_PUBLIC_APP_URL is not set
 * or invalid to keep local development flow working.
 */
export function buildAuthRedirectUrl(pathWithQuery: string): string {
  const canonical = getCanonicalAppUrl();
  const base =
    canonical ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return new URL(pathWithQuery, base).toString();
}

