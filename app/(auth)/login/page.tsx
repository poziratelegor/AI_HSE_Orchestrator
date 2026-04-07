"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const inputClass =
  "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-slate-400 transition focus:border-[#003A8C] focus:outline-none focus:ring-2 focus:ring-[#003A8C]/20";

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

    const redirectTo = `${window.location.origin}/callback?next=${encodeURIComponent(next)}`;
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
      options: { redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) { setError(translateError(error.message)); setLoading(false); }
  }

  if (magicLinkSent) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-[#003A8C]/12 bg-[#EAF1FB] px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#003A8C]/10">
            <MailIcon />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Проверь почту</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ссылка отправлена на{" "}
            <span className="font-medium text-[#003A8C]">{email}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-500">Открой письмо и нажми на ссылку для входа.</p>
        </div>
        <button
          onClick={() => { setMagicLinkSent(false); setError(null); }}
          className="mt-5 w-full text-center text-sm text-[#003A8C] hover:underline"
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
          className="w-full rounded-xl bg-[#003A8C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0A4B9D] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003A8C]/40"
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
        <Link href="/signup" className="font-medium text-[#003A8C] hover:underline">
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

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F3F6FA]">
      <div className="hidden lg:flex lg:w-[420px] lg:flex-col lg:justify-between bg-[#003A8C] px-10 py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200/60">StudyFlow</p>
          <p className="mt-1 text-xl font-semibold text-white">AI Ассистент</p>
        </div>
        <div>
          <blockquote className="text-blue-100/80 text-sm leading-relaxed">
            Один запрос на естественном языке — система сама выбирает нужный сценарий и возвращает результат.
          </blockquote>
          <ul className="mt-8 space-y-3">
            {["Генерация официальных писем", "Ответы по загруженным материалам", "Выделение задач и дедлайнов", "Конспекты лекций"].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-blue-100/70">
                <CheckMark />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-blue-200/30">StudyFlow AI</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#003A8C]/60">StudyFlow</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">AI Ассистент</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
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
      <rect x="1" y="4" width="20" height="14" rx="2.5" stroke="#003A8C" strokeWidth="1.5" opacity="0.5" />
      <path d="m2 5 9 7 9-7" stroke="#003A8C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="white" opacity="0.15" />
      <path d="m4 7 2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
