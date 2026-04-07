"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile, upsertProfile } from "@/lib/supabase/profile";
import { AuthShell, authInputClass, AuthErrorBox, AuthPrimaryButton } from "@/components/auth/AuthShell";
import type { User } from "@supabase/supabase-js";

const COURSE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [groupName, setGroupName] = useState("");
  const [courseNumber, setCourseNumber] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.replace("/login"); return; }
      setUser(user);

      const profile = await getProfile(user.id, supabase);
      if (profile?.full_name) setFullName(profile.full_name);
      if (profile?.university) setUniversity(profile.university);
      if (profile?.faculty) setFaculty(profile.faculty);
      if (profile?.group_name) setGroupName(profile.group_name);
      if (profile?.course_number) setCourseNumber(profile.course_number);

      if (!profile?.full_name) {
        const meta = user.user_metadata ?? {};
        const metaName = (meta.full_name ?? meta.name ?? "") as string;
        if (metaName) setFullName(metaName);
      }

      setInitializing(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): string | null {
    if (!fullName.trim()) return "Введи полное имя.";
    if (!university.trim()) return "Введи название университета.";
    if (!faculty.trim()) return "Введи факультет.";
    if (!groupName.trim()) return "Введи номер или название группы.";
    if (!courseNumber) return "Выбери номер курса.";
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!user) return;

    setLoading(true);
    setError(null);

    const { error: saveError } = await upsertProfile(user.id, {
      full_name: fullName,
      email: user.email ?? null,
      university,
      faculty,
      group_name: groupName,
      course_number: Number(courseNumber)
    }, supabase);

    if (saveError) {
      setError("Не удалось сохранить данные. Попробуй ещё раз.");
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Заполни профиль</h1>
        <p className="mt-1 text-sm text-slate-500">
          Данные об учёбе нужны для генерации писем и персонализации.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
            Полное имя <span className="text-red-500">*</span>
          </label>
          <input id="fullName" type="text" required autoComplete="name"
            value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Иванов Иван Иванович" className={authInputClass} />
        </div>

        <div>
          <label htmlFor="university" className="block text-sm font-medium text-slate-700">
            Университет <span className="text-red-500">*</span>
          </label>
          <input id="university" type="text" required
            value={university} onChange={e => setUniversity(e.target.value)}
            placeholder="МГУ им. М.В. Ломоносова" className={authInputClass} />
        </div>

        <div>
          <label htmlFor="faculty" className="block text-sm font-medium text-slate-700">
            Факультет <span className="text-red-500">*</span>
          </label>
          <input id="faculty" type="text" required
            value={faculty} onChange={e => setFaculty(e.target.value)}
            placeholder="Факультет вычислительной математики" className={authInputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-slate-700">
              Группа <span className="text-red-500">*</span>
            </label>
            <input id="groupName" type="text" required
              value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="317" className={authInputClass} />
          </div>

          <div>
            <label htmlFor="courseNumber" className="block text-sm font-medium text-slate-700">
              Курс <span className="text-red-500">*</span>
            </label>
            <select id="courseNumber" required
              value={courseNumber}
              onChange={e => setCourseNumber(e.target.value ? Number(e.target.value) : "")}
              className={authInputClass}>
              <option value="">—</option>
              {COURSE_OPTIONS.map(n => (
                <option key={n} value={n}>{n} курс</option>
              ))}
            </select>
          </div>
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
  return <Suspense><CompleteProfileForm /></Suspense>;
}
