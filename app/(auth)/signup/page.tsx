"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthShell, authInputClass, AuthDivider, AuthErrorBox, AuthPrimaryButton } from "@/components/auth/AuthShell";

const COURSE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function FormField({
  id, label, required, hint, children
}: {
  id: string; label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">({hint})</span>}
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, university, faculty, group_name: groupName, course_number: Number(courseNumber) }
      }
    });

    if (signUpError) {
      setError(translateError(signUpError.message));
      setLoading(false);
      return;
    }

    const user = data.user;
    const session = data.session;

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
        router.push(`/complete-profile?next=${encodeURIComponent(next)}`);
      } else {
        router.push(next);
      }
      return;
    }

    setRegisteredEmail(email);
    setEmailConfirmationSent(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) { setError(translateError(error.message)); setLoading(false); }
  }

  if (emailConfirmationSent) {
    return (
      <AuthShell>
        <div className="rounded-2xl border border-green-100 bg-green-50 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="1" y="4" width="20" height="14" rx="2.5" stroke="#16a34a" strokeWidth="1.5" opacity="0.6" />
              <path d="m2 5 9 7 9-7" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Подтверди email</h1>
          <p className="mt-2 text-sm text-slate-600">
            Письмо отправлено на{" "}
            <span className="font-medium text-green-700">{registeredEmail}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Открой его и нажми на ссылку — войдёшь автоматически.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-[var(--hse-blue)] hover:underline">Войти</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Регистрация</h1>
        <p className="mt-1 text-sm text-slate-500">Создай аккаунт студента.</p>
      </div>

      <GoogleSignInButton label="Зарегистрироваться через Google" loading={loading} onClick={handleGoogleSignup} />

      <AuthDivider label="или заполни форму" />

      <form onSubmit={handleSignup} className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Личные данные
          </legend>

          <FormField id="fullName" label="Полное имя" required>
            <input id="fullName" type="text" required autoComplete="name"
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович" className={authInputClass} />
          </FormField>

          <FormField id="email" label="Email" required>
            <input id="email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="student@university.ru" className={authInputClass} />
          </FormField>

          <FormField id="password" label="Пароль" required hint="Не менее 6 символов">
            <input id="password" type="password" required autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className={authInputClass} />
          </FormField>

          <FormField id="confirmPassword" label="Подтверди пароль" required>
            <input id="confirmPassword" type="password" required autoComplete="new-password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" className={authInputClass} />
          </FormField>
        </fieldset>

        <fieldset className="space-y-3 pt-1">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Учёба
          </legend>

          <FormField id="university" label="Университет" required>
            <input id="university" type="text" required
              value={university} onChange={e => setUniversity(e.target.value)}
              placeholder="МГУ им. М.В. Ломоносова" className={authInputClass} />
          </FormField>

          <FormField id="faculty" label="Факультет" required>
            <input id="faculty" type="text" required
              value={faculty} onChange={e => setFaculty(e.target.value)}
              placeholder="Факультет вычислительной математики" className={authInputClass} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="groupName" label="Группа" required>
              <input id="groupName" type="text" required
                value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="317" className={authInputClass} />
            </FormField>

            <FormField id="courseNumber" label="Курс" required>
              <select id="courseNumber" required
                value={courseNumber}
                onChange={e => setCourseNumber(e.target.value ? Number(e.target.value) : "")}
                className={authInputClass}>
                <option value="">—</option>
                {COURSE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} курс</option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>

        {error && <AuthErrorBox message={error} />}

        <AuthPrimaryButton loading={loading}>
          {loading ? "Регистрирую…" : "Создать аккаунт"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-[var(--hse-blue)] hover:underline">Войти</Link>
      </p>
    </AuthShell>
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
  return <Suspense><SignupForm /></Suspense>;
}
