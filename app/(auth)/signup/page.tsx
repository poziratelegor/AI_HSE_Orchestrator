"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const COURSE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function FormField({
  id, label, required, hint, children
}: {
  id: string; label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [groupName, setGroupName] = useState("");
  const [courseNumber, setCourseNumber] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const supabase = getSupabaseBrowserClient();

  // Если уже залогинен — редирект
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): string | null {
    if (!fullName.trim()) return "Введи полное имя.";
    if (!email.trim()) return "Введи email.";
    if (password.length < 6) return "Пароль должен быть не менее 6 символов.";
    if (password !== confirmPassword) return "Пароли не совпадают.";
    if (!university.trim()) return "Введи название университета.";
    if (!faculty.trim()) return "Введи факультет.";
    if (!groupName.trim()) return "Введи номер или название группы.";
    if (!courseNumber) return "Выбери номер курса.";
    return null;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);

    // Данные профиля кладём в user_metadata — callback подхватит их при email confirmation
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          university,
          faculty,
          group_name: groupName,
          course_number: Number(courseNumber)
        }
      }
    });

    if (signUpError) {
      setError(translateError(signUpError.message));
      setLoading(false);
      return;
    }

    const user = data.user;
    const session = data.session;

    // Email confirmation выключен — сессия есть сразу
    if (session && user) {
      const { error: profileError } = await upsertProfile(user.id, {
        full_name: fullName,
        email: user.email ?? email,
        university,
        faculty,
        group_name: groupName,
        course_number: Number(courseNumber)
      }, supabase);

      router.refresh();
      if (profileError) {
        // Профиль не создался — onboarding поможет
        console.warn("[signup] profile upsert failed:", profileError);
        router.push(`/complete-profile?next=${encodeURIComponent(next)}`);
      } else {
        router.push(next);
      }
      return;
    }

    // Email confirmation включён — показать экран ожидания
    setRegisteredEmail(email);
    setEmailConfirmationSent(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
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

  // === Email confirmation отправлен ===
  if (emailConfirmationSent) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-xl border border-green-100 bg-green-50 px-6 py-8 text-center">
          <p className="text-4xl">✉️</p>
          <h1 className="mt-3 text-xl font-semibold text-gray-900">Подтверди email</h1>
          <p className="mt-2 text-sm text-gray-600">
            Письмо отправлено на{" "}
            <span className="font-medium text-green-700">{registeredEmail}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Открой его и нажми на ссылку — после этого ты войдёшь автоматически.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Войти
          </Link>
        </p>
      </main>
    );
  }

  // === Форма регистрации ===
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="mb-6">
        <span className="text-2xl font-bold text-indigo-600">StudyFlow AI</span>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Регистрация</h1>
        <p className="mt-1 text-sm text-gray-500">Создай аккаунт студента.</p>
      </div>

      <GoogleSignInButton
        label="Зарегистрироваться через Google"
        loading={loading}
        onClick={handleGoogleSignup}
      />

      <div className="my-5 flex items-center gap-3">
        <hr className="flex-1 border-gray-200" />
        <span className="text-xs text-gray-400">или заполни форму</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Личные данные */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Личные данные
          </legend>

          <FormField id="fullName" label="Полное имя" required>
            <input
              id="fullName" type="text" required autoComplete="name"
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович" className={inputClass}
            />
          </FormField>

          <FormField id="email" label="Email" required>
            <input
              id="email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="student@university.ru" className={inputClass}
            />
          </FormField>

          <FormField id="password" label="Пароль" required hint="Не менее 6 символов">
            <input
              id="password" type="password" required autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className={inputClass}
            />
          </FormField>

          <FormField id="confirmPassword" label="Подтверди пароль" required>
            <input
              id="confirmPassword" type="password" required autoComplete="new-password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" className={inputClass}
            />
          </FormField>
        </fieldset>

        {/* Учебные данные */}
        <fieldset className="space-y-3 pt-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Учёба
          </legend>

          <FormField id="university" label="Университет" required>
            <input
              id="university" type="text" required
              value={university} onChange={e => setUniversity(e.target.value)}
              placeholder="МГУ им. М.В. Ломоносова" className={inputClass}
            />
          </FormField>

          <FormField id="faculty" label="Факультет" required>
            <input
              id="faculty" type="text" required
              value={faculty} onChange={e => setFaculty(e.target.value)}
              placeholder="Факультет вычислительной математики и кибернетики"
              className={inputClass}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="groupName" label="Группа" required>
              <input
                id="groupName" type="text" required
                value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="317" className={inputClass}
              />
            </FormField>

            <FormField id="courseNumber" label="Курс" required>
              <select
                id="courseNumber" required
                value={courseNumber}
                onChange={e => setCourseNumber(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                <option value="">—</option>
                {COURSE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} курс</option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Регистрирую…" : "Создать аккаунт"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Войти
        </Link>
      </p>
    </main>
  );
}

function translateError(msg: string): string {
  if (msg.includes("User already registered")) return "Этот email уже зарегистрирован. Попробуй войти.";
  if (msg.includes("Password should be at least")) return "Пароль должен быть не менее 6 символов.";
  if (msg.includes("Unable to validate email")) return "Неверный формат email.";
  if (msg.includes("Too many requests")) return "Слишком много попыток. Подожди немного.";
  return msg;
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
