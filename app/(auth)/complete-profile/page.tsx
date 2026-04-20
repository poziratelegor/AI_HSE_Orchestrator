"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, upsertProfile } from "@/lib/supabase/profile";
import {
  AuthShell,
  authInputClass,
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
  getFacultyById,
  findFacultyIdByName
} from "@/lib/hse/programs";
import type { User } from "@supabase/supabase-js";

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

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [campus, setCampus] = useState<Campus | "">("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [facultyId, setFacultyId] = useState<string>("");
  const [programSelect, setProgramSelect] = useState<string>("");
  const [programCustom, setProgramCustom] = useState<string>("");
  const [courseNumber, setCourseNumber] = useState<number | "">("");
  const [groupName, setGroupName] = useState("");

  // Хранит preloaded program до того, как programs (из useMemo) появятся
  const [preloadedProgram, setPreloadedProgram] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  // ─── Каскадные опции ──────────────────────────────────────────────────────
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

  // ─── Подгрузка данных пользователя ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();
      if (error || !user) {
        router.replace("/login");
        return;
      }
      setUser(user);

      const profile = await getProfile(user.id, supabase);

      // ФИО
      if (profile?.full_name) {
        setFullName(profile.full_name);
      } else {
        const meta = user.user_metadata ?? {};
        const metaName = (meta.full_name ?? meta.name ?? "") as string;
        if (metaName) setFullName(metaName);
      }

      // Структурированные поля (если профиль уже был обновлён по новой схеме)
      if (profile?.campus) setCampus(profile.campus as Campus);
      if (profile?.education_level) setEducationLevel(profile.education_level as EducationLevel);

      // Faculty: если новых полей нет — пытаемся смапить старое имя
      if (profile?.faculty) {
        const mapped = findFacultyIdByName(
          profile.faculty,
          (profile.campus as Campus | undefined) ?? undefined
        );
        if (mapped) setFacultyId(mapped);
      }

      // Program — отложим установку до момента, когда programs появятся
      if (profile?.program) {
        setPreloadedProgram(profile.program);
      }

      if (profile?.course_number) setCourseNumber(profile.course_number);
      if (profile?.group_name) setGroupName(profile.group_name);

      setInitializing(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // После того как programs (для facultyId+level) посчитались — выставляем preloadedProgram
  useEffect(() => {
    if (!preloadedProgram || programSelect) return;
    if (programs.length === 0) {
      setProgramSelect(PROGRAM_OTHER);
      setProgramCustom(preloadedProgram);
      return;
    }
    if (programs.some((p) => p.name === preloadedProgram)) {
      setProgramSelect(preloadedProgram);
    } else {
      setProgramSelect(PROGRAM_OTHER);
      setProgramCustom(preloadedProgram);
    }
  }, [preloadedProgram, programs, programSelect]);

  // ─── Каскадные сбросы ─────────────────────────────────────────────────────
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
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);

    const facultyObj = getFacultyById(facultyId);
    const facultyName = facultyObj?.name ?? "";
    const program =
      programSelect === PROGRAM_OTHER ? programCustom.trim() : programSelect.trim();

    const { error: saveError } = await upsertProfile(
      user.id,
      {
        full_name: fullName.trim(),
        email: user.email ?? null,
        university: HSE_NAME,
        faculty: facultyName,
        group_name: groupName.trim() || null,
        course_number: Number(courseNumber),
        campus: campus as Campus,
        education_level: educationLevel as EducationLevel,
        program: program || null
      },
      supabase
    );

    if (saveError) {
      setError("Не удалось сохранить данные. Попробуйте ещё раз.");
      setLoading(false);
      return;
    }

    router.refresh();
    router.push(next);
  }

  if (initializing) {
    return (
      <AuthShell>
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">Загрузка…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Заполните профиль
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Данные нужны для генерации писем в деканат и персонализации.{" "}
          <span className="font-medium text-[var(--hse-blue)]">НИУ ВШЭ</span>.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
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

        {error && <AuthErrorBox message={error} />}

        <AuthPrimaryButton loading={loading}>
          {loading ? "Сохраняю…" : "Сохранить и продолжить"}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}
