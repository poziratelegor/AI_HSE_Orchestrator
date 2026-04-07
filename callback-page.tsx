"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete, upsertProfile } from "@/lib/supabase/profile";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const supabase = getSupabaseBrowserClient();
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/dashboard";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage("Ссылка устарела или недействительна. Попробуй войти снова.");
          return;
        }
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace("/login?error=auth_failed");
        return;
      }

      let profile = await getProfile(user.id, supabase);

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
          profile = await getProfile(user.id, supabase);
        }
      }

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
      <div className="flex min-h-screen items-center justify-center bg-[#F3F6FA] px-6">
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
            className="mt-6 inline-flex items-center rounded-xl bg-[#003A8C] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0A4B9D] transition-colors"
          >
            Вернуться ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F6FA]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#003A8C]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="animate-spin">
            <circle cx="10" cy="10" r="8" stroke="#003A8C" strokeWidth="1.5" strokeDasharray="40" strokeDashoffset="15" />
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
      <div className="flex min-h-screen items-center justify-center bg-[#F3F6FA]">
        <p className="text-sm text-slate-500">Загрузка…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
