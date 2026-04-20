"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthShell } from "@/components/auth/AuthShell";

const inputClass =
  "mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-[var(--hse-icon-muted)] transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
      return;
    }

    if (data.user) {
      const profile = await getProfile(data.user.id, supabase);
      router.refresh();
      if (!isProfileComplete(profile)) {
        router.push(`/complete-profile?next=${encodeURIComponent(next)}`);
      } else {
        router.push(next);
      }
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError("Введи email для отправки ссылки."); return; }
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) { setError(translateError(error.message)); setLoading(false); return; }
    setMagicLinkSent(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) { setError(translateError(error.message)); setLoading(false); }
  }

  if (magicLinkSent) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-[var(--hse-blue)]/12 bg-[var(--hse-light)] px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hse-blue)]/10">
            <MailIcon />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Проверь почту</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ссылка отправлена на{" "}
            <span className="font-medium text-[var(--hse-blue)]">{email}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-500">Открой письмо и нажми на ссылку для входа.</p>
        </div>
        <button
          onClick={() => { setMagicLinkSent(false); setError(null); }}
          className="mt-5 w-full text-center text-sm text-[var(--hse-blue)] hover:underline"
        >
          Вернуться
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Вход</h1>
        <p className="mt-1 text-sm text-slate-500">Войди в свой аккаунт студента.</p>
      </div>

      {searchParams.get("error") && !error && (
        <ErrorBox message={translateUrlError(searchParams.get("error")!)} />
      )}

      <GoogleSignInButton label="Войти через Google" loading={loading} onClick={handleGoogleLogin} />

      <Divider label="или войди по email" />

      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className={inputClass} placeholder="student@university.ru"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">Пароль</label>
          <input
            id="password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className={inputClass} placeholder="••••••••"
          />
        </div>

        {error && <ErrorBox message={error} />}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-xl bg-[var(--hse-blue)] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)]"
        >
          {loading ? "Вхожу…" : "Войти по паролю"}
        </button>
      </form>

      <Divider label="или" />

      <button
        type="button" onClick={handleMagicLink} disabled={loading}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
      >
        Войти без пароля (magic link)
      </button>

      <p className="mt-6 text-center text-sm text-slate-500">
        Нет аккаунта?{" "}
        <Link href="/signup" className="font-medium text-[var(--hse-blue)] hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Неверный email или пароль.";
  if (msg.includes("Email not confirmed")) return "Сначала подтверди email — проверь почту.";
  if (msg.includes("Too many requests")) return "Слишком много попыток. Подожди немного.";
  if (msg.includes("User already registered")) return "Этот email уже зарегистрирован.";
  return msg;
}

function translateUrlError(code: string): string {
  if (code === "auth_failed") return "Не удалось подтвердить вход. Попробуй ещё раз.";
  if (code === "auth_callback") return "Ошибка при обработке ссылки. Войди снова.";
  return "Произошла ошибка при входе.";
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <hr className="flex-1 border-slate-200" />
      <span className="text-xs text-slate-400">{label}</span>
      <hr className="flex-1 border-slate-200" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </p>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="20" height="14" rx="2.5" stroke="var(--hse-blue)" strokeWidth="1.5" opacity="0.5" />
      <path d="m2 5 9 7 9-7" stroke="var(--hse-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

