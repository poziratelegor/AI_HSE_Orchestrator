"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, isProfileComplete } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

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

  // Если уже авторизован — редиректнуть сразу
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
    if (!email.trim()) {
      setError("Введи email для отправки ссылки.");
      return;
    }
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}`
      }
    });

    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    }
  }

  if (magicLinkSent) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-6 py-8 text-center">
          <p className="text-4xl">📬</p>
          <h1 className="mt-3 text-xl font-semibold text-gray-900">Проверь почту</h1>
          <p className="mt-2 text-sm text-gray-600">
            Мы отправили ссылку для входа на{" "}
            <span className="font-medium text-indigo-700">{email}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-500">Открой письмо и нажми на ссылку.</p>
        </div>
        <button
          onClick={() => { setMagicLinkSent(false); setError(null); }}
          className="mt-5 w-full text-center text-sm text-indigo-600 hover:underline"
        >
          ← Вернуться
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="mb-8">
        <span className="text-2xl font-bold text-indigo-600">StudyFlow AI</span>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Вход</h1>
        <p className="mt-1 text-sm text-gray-500">Войди в свой аккаунт студента.</p>
      </div>

      {/* Ошибка из URL (?error=... после callback) */}
      {searchParams.get("error") && !error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {translateUrlError(searchParams.get("error")!)}
        </div>
      )}

      <GoogleSignInButton label="Войти через Google" loading={loading} onClick={handleGoogleLogin} />

      <div className="my-5 flex items-center gap-3">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400">или войди по email</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="student@university.ru"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Пароль</label>
          <input
            id="password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Вхожу…" : "Войти по паролю"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400">или</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      <button
        type="button" onClick={handleMagicLink} disabled={loading}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        Войти без пароля (magic link)
      </button>

      <p className="mt-6 text-center text-sm text-gray-600">
        Нет аккаунта?{" "}
        <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </main>
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
  if (code === "auth_callback") return "Ошибка при обработке ссылки. Попробуй войти снова.";
  if (code === "config") return "Ошибка конфигурации. Обратитесь к администратору.";
  return "Произошла ошибка при входе.";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
