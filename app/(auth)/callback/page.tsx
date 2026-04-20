import { redirect } from "next/navigation";

/**
 * Legacy callback URL — оставлен для обратной совместимости.
 *
 * Боевой OAuth-обмен теперь происходит в server-side route handler:
 *   app/auth/callback/route.ts → /auth/callback
 *
 * Эта страница просто перебрасывает все query-параметры (включая ?code=, ?next=, ?error=)
 * на новый URL. Полезно, если в Supabase URL Configuration ещё где-то прописан
 * старый /callback или у кого-то открыта вкладка со старым редиректом.
 */
export default async function LegacyCallbackPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v.length > 0) qs.set(k, v[0]);
  }
  const target = qs.toString() ? `/auth/callback?${qs.toString()}` : "/auth/callback";
  redirect(target);
}
