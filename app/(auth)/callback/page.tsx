"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete, upsertProfile } from "@/lib/supabase/profile";

/**
 * Единый callback-маршрут для всех auth-сценариев:
 * - Google OAuth (PKCE: ?code=...)
 * - Magic link (PKCE: ?code=...)
 * - Email confirmation после signup (PKCE: ?code=...)
 *
 * После успешного обмена кода:
 * 1. Проверяем профиль пользователя
 * 2. Если не заполнен → /complete-profile
 * 3. Если заполнен → ?next или /dashboard
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const supabase = getSupabaseBrowserClient();
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/dashboard";

      // PKCE flow: обменять code на сессию
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[callback] exchangeCodeForSession error:", error.message);
          setErrorMessage("Ссылка устарела или недействительна. Попробуй войти снова.");
          return;
        }
      }

      // Получить текущего пользователя
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace("/login?error=auth_failed");
        return;
      }

      // Проверить наличие и полноту профиля
      let profile = await getProfile(user.id, supabase);

      // При первом входе через Google или подтверждении email:
      // попробовать создать профиль из user_metadata (заполняется на signup)
      if (!isProfileComplete(profile)) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const hasMetaData = meta.full_name || meta.university || meta.faculty;

        if (hasMetaData) {
          await upsertProfile(user.id, {
            full_name: typeof meta.full_name === "string" ? meta.full_name : null,
            email: user.email ?? null,
            university: typeof meta.university === "string" ? meta.university : null,
            faculty: typeof meta.faculty === "string" ? meta.faculty : null,
            group_name: typeof meta.group_name === "string" ? meta.group_name : null,
            course_number: typeof meta.course_number === "number" ? meta.course_number : null,
          }, supabase);
          // Перечитать обновлённый профиль
          profile = await getProfile(user.id, supabase);
        }
      }

      // Направить пользователя в зависимости от полноты профиля
      if (!isProfileComplete(profile)) {
        router.replace(`/complete-profile?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(next);
      }
    }

    handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Не удалось войти</h1>
        <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Вернуться ко входу
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <div className="animate-pulse space-y-3">
        <p className="text-4xl">🔐</p>
        <p className="text-sm text-gray-500">Входим в аккаунт…</p>
      </div>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-gray-500">Загрузка…</p>
      </main>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
