"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete, upsertProfile } from "@/lib/supabase/profile";

/**
 * OAuth/Magic-link callback.
 *
 * Логика:
 *  1) Клиент Supabase создан с detectSessionInUrl:true → он САМ обменяет
 *     ?code=... на сессию при инициализации. Мы НЕ зовём exchangeCodeForSession
 *     руками, иначе второй вызов получит уже использованный код и упадёт
 *     с ошибкой "ссылка устарела".
 *  2) В dev-режиме React strict mode useEffect срабатывает дважды —
 *     защищаемся через useRef.
 *  3) Ждём появления сессии короткими ретраями (до ~3с).
 *  4) Любые ошибки апсёрта профиля игнорируем — пользователя в любом случае
 *     ведём на /complete-profile, чтобы он сам заполнил анкету ВШЭ.
 *     Из Google нельзя получить ни кампус, ни факультет, ни программу — это
 *     нормально, что после OAuth открывается наша форма.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const supabase = getSupabaseBrowserClient();
    const next = searchParams.get("next") ?? "/dashboard";
    const urlError = searchParams.get("error") || searchParams.get("error_description");

    // Если Google/Supabase вернули ошибку прямо в URL — сразу показываем
    if (urlError) {
      setErrorMessage(decodeURIComponent(urlError));
      return;
    }

    async function waitForUser(maxMs = 4000, intervalMs = 200) {
      const deadline = Date.now() + maxMs;
      while (Date.now() < deadline) {
        const { data, error } = await supabase.auth.getUser();
        if (data?.user && !error) return data.user;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return null;
    }

    (async () => {
      const user = await waitForUser();

      if (!user) {
        // Авто-обмен detectSessionInUrl не сработал — возможно, код просрочен,
        // OAuth-прерван, или нет подключения. Мягко возвращаем на /login.
        setErrorMessage(
          "Не удалось завершить вход через провайдера. Попробуйте ещё раз."
        );
        return;
      }

      // Метадата от Google: name, full_name, picture, email
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const guessedName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;

      // Создаём минимальный профиль (без обязательных учебных полей).
      // Все новые колонки nullable → constraint'ы БД не помешают.
      // Если апсёрт упадёт — игнорируем и всё равно ведём на анкету.
      try {
        const existing = await getProfile(user.id, supabase);
        if (!existing) {
          await upsertProfile(
            user.id,
            {
              full_name: guessedName,
              email: user.email ?? null,
              university: "НИУ ВШЭ"
            },
            supabase
          );
        }
      } catch {
        // ignore — пользователь всё равно дозаполнит на /complete-profile
      }

      // Решаем куда отправить
      let profile = null;
      try {
        profile = await getProfile(user.id, supabase);
      } catch {
        profile = null;
      }

      if (!isProfileComplete(profile)) {
        router.replace(`/complete-profile?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(next);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--hse-page-bg)] px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" stroke="#dc2626" strokeWidth="1.5" />
              <path d="M10 6v5M10 14v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Не удалось войти</h1>
          <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center rounded-xl bg-[var(--hse-blue)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--hse-blue-mid)] transition-colors"
          >
            Вернуться ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hse-page-bg)]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hse-blue)]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="animate-spin">
            <circle cx="10" cy="10" r="8" stroke="var(--hse-blue)" strokeWidth="1.5" strokeDasharray="40" strokeDashoffset="15" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">Входим в аккаунт…</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--hse-page-bg)]">
        <p className="text-sm text-slate-500">Загрузка…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
