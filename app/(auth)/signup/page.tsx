"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/supabase/profile";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import {
  AuthShell,
  authInputClass,
  AuthDivider,
  AuthErrorBox,
  AuthPrimaryButton
} from "@/components/auth/AuthShell";
import {
  CAMPUSES,
  EDUCATION_LEVELS,
  type Campus,
  type EducationLevel,
  getFacultiesByCampus,
  getProgramsByFacultyAndLevel,
  getCoursesByLevel,
  getFacultyById
} from "@/lib/hse/programs";

const HSE_NAME = "НИУ ВШЭ";
const PROGRAM_OTHER = "__other__";

function FormField({
  id,
  label,
  required,
  hint,
  children
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
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

  // Личные данные
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Учёба (ВШЭ)
  const [campus, setCampus] = useState<Campus | "">("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [facultyId, setFacultyId] = useState<string>("");
  const [programSelect, setProgramSelect] = useState<string>("");
  const [programCustom, setProgramCustom] = useState<string>("");
  const [courseNumber, setCourseNumber] = useState<number | "">("");
  const [groupName, setGroupName] = useState("");

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

  // ─── Каскадные селекты ────────────────────────────────────────────────────
  const faculties = useMemo(
    () => (campus ? getFacultiesByCampus(campus as Campus) : []),
    [campus]
  );

  const programs = useMemo(
    () =>
      facultyId && educationLevel
        ? getProgramsByFacultyAndLevel(facultyId, educationLevel as EducationLevel)
        : [],
    [facultyId, educationLevel]
  );

  const courses = useMemo(
    () => (educationLevel ? getCoursesByLevel(educationLevel as EducationLevel) : [1, 2, 3, 4]),
    [educationLevel]
  );

  // Сброс зависимых полей при смене вышестоящих
  function handleCampusChange(value: string) {
    setCampus(value as Campus);
    setFacultyId("");
    setProgramSelect("");
    setProgramCustom("");
  }
  function handleLevelChange(value: string) {
    setEducationLevel(value as EducationLevel);
    setProgramSelect("");
    setProgramCustom("");
    setCourseNumber("");
  }
  function handleFacultyChange(value: string) {
    setFacultyId(value);
    setProgramSelect("");
    setProgramCustom("");
  }

  // ─── Валидация ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!fullName.trim()) return "Введите полное имя.";
    if (!email.trim()) return "Введите email.";
    if (password.length < 6) return "Пароль должен быть не менее 6 символов.";
    if (password !== confirmPassword) return "Пароли не совпадают.";
    if (!campus) return "Выберите кампус ВШЭ.";
    if (!educationLevel) return "Выберите ступень обучения.";
    if (!facultyId) return "Выберите факультет.";
    if (programSelect === PROGRAM_OTHER && !programCustom.trim()) {
      return "Введите название образовательной программы.";
    }
    if (!courseNumber) return "Выберите курс.";
    return null;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const facultyObj = getFacultyById(facultyId);
    const facultyName = facultyObj?.name ?? "";
    const program =
      programSelect === PROGRAM_OTHER ? programCustom.trim() : programSelect.trim();

    const profilePayload = {
      full_name: fullName.trim(),
      email: email.trim(),
      university: HSE_NAME,
      faculty: facultyName,
      group_name: groupName.trim() || null,
      course_number: Number(courseNumber),
      campus: campus as Campus,
      education_level: educationLevel as EducationLevel,
      program: program || null
    };

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: profilePayload }
    });

    if (signUpError) {
      setError(translateError(signUpError.message));
      setLoading(false);
      return;
    }

    const user = data.user;
    const session = data.session;

    if (session && user) {
      const { error: profileError } = await upsertProfile(
        user.id,
        { ...profilePayload, email: user.email ?? profilePayload.email },
        supabase
      );

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
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    });
    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    }
  }

  // ─── Email confirmation success ───────────────────────────────────────────
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
          <h1 className="text-lg font-semibold text-slate-900">Подтвердите email</h1>
          <p className="mt-2 text-sm text-slate-600">
            Письмо отправлено на{" "}
            <span className="font-medium text-green-700">{registeredEmail}</span>.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Откройте его и нажмите на ссылку — войдёте автоматически.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-[var(--hse-blue)] hover:underline">
            Войти
          </Link>
        </p>
      </AuthShell>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Регистрация в StudyFlow AI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Для студентов <span className="font-medium text-[var(--hse-blue)]">НИУ ВШЭ</span> —
          бесплатно, без приглашений.
        </p>
      </div>

      <GoogleSignInButton
        label="Зарегистрироваться через Google"
        loading={loading}
        onClick={handleGoogleSignup}
      />

      <AuthDivider label="или заполните форму" />

      <form onSubmit={handleSignup} className="space-y-5">
        {/* ── Личные данные ─────────────────────────────────────────────── */}
        <fieldset className="space-y-3">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Личные данные
          </legend>

          <FormField id="fullName" label="ФИО" required>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className={authInputClass}
            />
          </FormField>

          <FormField id="email" label="Email" required hint="лучше корпоративный @edu.hse.ru">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivivanov@edu.hse.ru"
              className={authInputClass}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="password" label="Пароль" required hint="мин. 6 символов">
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={authInputClass}
              />
            </FormField>

            <FormField id="confirmPassword" label="Повторите пароль" required>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={authInputClass}
              />
            </FormField>
          </div>
        </fieldset>

        {/* ── Учёба ─────────────────────────────────────────────────────── */}
        <fieldset className="space-y-3 pt-1">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Учёба в НИУ ВШЭ
          </legend>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="campus" label="Кампус" required>
              <select
                id="campus"
                required
                value={campus}
                onChange={(e) => handleCampusChange(e.target.value)}
                className={authInputClass}
              >
                <option value="">— выберите —</option>
                {CAMPUSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="educationLevel" label="Ступень обучения" required>
              <select
                id="educationLevel"
                required
                value={educationLevel}
                onChange={(e) => handleLevelChange(e.target.value)}
                className={authInputClass}
              >
                <option value="">— выберите —</option>
                {EDUCATION_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField id="faculty" label="Факультет" required>
            <select
              id="faculty"
              required
              value={facultyId}
              disabled={!campus}
              onChange={(e) => handleFacultyChange(e.target.value)}
              className={`${authInputClass} ${!campus ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
            >
              <option value="">{campus ? "— выберите факультет —" : "Сначала выберите кампус"}</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.shortName ? `${f.name} (${f.shortName})` : f.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="program" label="Образовательная программа" hint="можно выбрать «Другое»">
            <select
              id="program"
              value={programSelect}
              disabled={!facultyId || !educationLevel}
              onChange={(e) => setProgramSelect(e.target.value)}
              className={`${authInputClass} ${!facultyId || !educationLevel ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
            >
              <option value="">
                {!facultyId || !educationLevel
                  ? "Сначала выберите факультет и ступень"
                  : programs.length === 0
                    ? "— нет программ для этой ступени —"
                    : "— выберите программу —"}
              </option>
              {programs.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.code ? `${p.name} (${p.code})` : p.name}
                </option>
              ))}
              {(facultyId && educationLevel) && (
                <option value={PROGRAM_OTHER}>Другое (ввести вручную)</option>
              )}
            </select>

            {programSelect === PROGRAM_OTHER && (
              <input
                type="text"
                value={programCustom}
                onChange={(e) => setProgramCustom(e.target.value)}
                placeholder="Например: Цифровая лингвистика"
                className={`${authInputClass} mt-2`}
                autoFocus
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="courseNumber" label="Курс" required>
              <select
                id="courseNumber"
                required
                value={courseNumber}
                disabled={!educationLevel}
                onChange={(e) => setCourseNumber(e.target.value ? Number(e.target.value) : "")}
                className={`${authInputClass} ${!educationLevel ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
              >
                <option value="">{educationLevel ? "— курс —" : "Сначала выберите ступень"}</option>
                {courses.map((n) => (
                  <option key={n} value={n}>
                    {n} курс
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="groupName" label="Группа" hint="опционально">
              <input
                id="groupName"
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="БПИ-241"
                className={authInputClass}
              />
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
        <Link href="/login" className="font-medium text-[var(--hse-blue)] hover:underline">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}

function translateError(msg: string): string {
  if (msg.includes("User already registered"))
    return "Этот email уже зарегистрирован. Попробуйте войти.";
  if (msg.includes("Password should be at least"))
    return "Пароль должен быть не менее 6 символов.";
  if (msg.includes("Unable to validate email")) return "Неверный формат email.";
  if (msg.includes("Too many requests")) return "Слишком много попыток. Подождите немного.";
  return msg;
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
