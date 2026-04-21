"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, upsertProfile } from "@/lib/supabase/profile";
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
import { TelegramLinkCard } from "./TelegramLinkCard";

const HSE_NAME = "НИУ ВШЭ";
const PROGRAM_OTHER = "__other__";

const inputClass =
  "mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-[var(--hse-icon-muted)] transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]";

function Field({
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

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [campus, setCampus] = useState<Campus | "">("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | "">("");
  const [facultyId, setFacultyId] = useState<string>("");
  const [programSelect, setProgramSelect] = useState<string>("");
  const [programCustom, setProgramCustom] = useState<string>("");
  const [courseNumber, setCourseNumber] = useState<number | "">("");
  const [groupName, setGroupName] = useState("");

  const [preloadedProgram, setPreloadedProgram] = useState<string | null>(null);

  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

      if (profile?.full_name) setFullName(profile.full_name);
      else {
        const meta = user.user_metadata ?? {};
        const metaName = (meta.full_name ?? meta.name ?? "") as string;
        if (metaName) setFullName(metaName);
      }

      if (profile?.campus) setCampus(profile.campus as Campus);
      if (profile?.education_level) setEducationLevel(profile.education_level as EducationLevel);

      if (profile?.faculty) {
        const mapped = findFacultyIdByName(
          profile.faculty,
          (profile.campus as Campus | undefined) ?? undefined
        );
        if (mapped) setFacultyId(mapped);
      }

      if (profile?.program) setPreloadedProgram(profile.program);

      if (profile?.course_number) setCourseNumber(profile.course_number);
      if (profile?.group_name) setGroupName(profile.group_name);

      setInitializing(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleCampusChange(value: string) {
    const willReset = !!(facultyId || programSelect || programCustom);
    if (
      willReset &&
      value !== campus &&
      !window.confirm("Смена кампуса сбросит факультет и программу. Продолжить?")
    ) {
      return;
    }
    setCampus(value as Campus);
    setFacultyId("");
    setProgramSelect("");
    setProgramCustom("");
  }
  function handleLevelChange(value: string) {
    const willReset = !!(programSelect || programCustom || courseNumber);
    if (
      willReset &&
      value !== educationLevel &&
      !window.confirm("Смена ступени сбросит программу и курс. Продолжить?")
    ) {
      return;
    }
    setEducationLevel(value as EducationLevel);
    setProgramSelect("");
    setProgramCustom("");
    setCourseNumber("");
  }
  function handleFacultyChange(value: string) {
    const willReset = !!(programSelect || programCustom);
    if (
      willReset &&
      value !== facultyId &&
      !window.confirm("Смена факультета сбросит выбранную программу. Продолжить?")
    ) {
      return;
    }
    setFacultyId(value);
    setProgramSelect("");
    setProgramCustom("");
  }

  function validate(): string | null {
    if (!fullName.trim()) return "Введите ФИО.";
    if (!campus) return "Выберите кампус ВШЭ.";
    if (!educationLevel) return "Выберите ступень обучения.";
    if (!facultyId) return "Выберите факультет.";
    if (programSelect === PROGRAM_OTHER && !programCustom.trim()) {
      return "Введите название образовательной программы.";
    }
    if (!courseNumber) return "Выберите курс.";
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
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

    setSuccess(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Мой профиль</h1>
        <p className="mt-1 text-sm text-slate-500">
          Эти данные используются для генерации писем в деканат и персонализации ассистента.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--hse-border)] bg-white p-6 shadow-sm">
        {initializing ? (
          <div className="py-8 text-center text-sm text-slate-500">Загрузка профиля…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <Field id="email" label="Email">
              <input
                id="email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
              />
            </Field>

            <Field id="fullName" label="ФИО" required>
              <input
                id="fullName"
                type="text"
                required
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="campus" label="Кампус" required>
                <select
                  id="campus"
                  required
                  value={campus}
                  onChange={(e) => handleCampusChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— выберите —</option>
                  {CAMPUSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="educationLevel" label="Ступень обучения" required>
                <select
                  id="educationLevel"
                  required
                  value={educationLevel}
                  onChange={(e) => handleLevelChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— выберите —</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field id="faculty" label="Факультет" required>
              <select
                id="faculty"
                required
                value={facultyId}
                disabled={!campus}
                onChange={(e) => handleFacultyChange(e.target.value)}
                className={`${inputClass} ${!campus ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
              >
                <option value="">{campus ? "— выберите факультет —" : "Сначала выберите кампус"}</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.shortName ? `${f.name} (${f.shortName})` : f.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="program" label="Образовательная программа" hint="можно выбрать «Другое»">
              <select
                id="program"
                value={programSelect}
                disabled={!facultyId || !educationLevel}
                onChange={(e) => setProgramSelect(e.target.value)}
                className={`${inputClass} ${!facultyId || !educationLevel ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
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
                  className={`${inputClass} mt-2`}
                />
              )}
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="courseNumber" label="Курс" required>
                <select
                  id="courseNumber"
                  required
                  value={courseNumber}
                  disabled={!educationLevel}
                  onChange={(e) => setCourseNumber(e.target.value ? Number(e.target.value) : "")}
                  className={`${inputClass} ${!educationLevel ? "cursor-not-allowed bg-slate-50 opacity-60" : ""}`}
                >
                  <option value="">{educationLevel ? "— курс —" : "Сначала выберите ступень"}</option>
                  {courses.map((n) => (
                    <option key={n} value={n}>
                      {n} курс
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="groupName" label="Группа" hint="опционально">
                <input
                  id="groupName"
                  type="text"
                  maxLength={32}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="БПИ-241"
                  className={inputClass}
                />
              </Field>
            </div>

            {error && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
                Профиль сохранён.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[var(--hse-blue)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)]"
              >
                {loading ? "Сохраняю…" : "Сохранить изменения"}
              </button>
            </div>
          </form>
        )}
      </div>

      {!initializing && <TelegramLinkCard />}
    </div>
  );
}
