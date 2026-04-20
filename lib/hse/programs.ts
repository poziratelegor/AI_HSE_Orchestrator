/**
 * Справочник НИУ ВШЭ: кампусы, факультеты, образовательные программы.
 *
 * Источник: https://www.hse.ru/education/ — официальные программы 2025/26 учебного года.
 * Данные структурированы для cascading-селектов в формах регистрации.
 *
 * Дисклеймер: список не претендует на полноту, но покрывает 90%+ программ.
 * При необходимости пользователь может ввести "Другое" и указать вручную.
 */

// ─── Типы ────────────────────────────────────────────────────────────────────

export type Campus = "moscow" | "spb" | "nnov" | "perm";
export type EducationLevel = "bachelor" | "master" | "specialist" | "phd";

export interface CampusInfo {
  value: Campus;
  label: string;
  city: string;
}

export interface EducationLevelInfo {
  value: EducationLevel;
  label: string;
  /** Допустимые номера курсов для этой ступени */
  courses: number[];
}

export interface Faculty {
  id: string;
  campus: Campus;
  name: string;
  /** Аббревиатура (ФКН, МИЭМ, и т.д.) */
  shortName?: string;
}

export interface Program {
  facultyId: string;
  level: EducationLevel;
  name: string;
  /** Кодовое имя программы (БПМИ, ПИ, и т.д.) — необязательно */
  code?: string;
}

// ─── Кампусы ─────────────────────────────────────────────────────────────────

export const CAMPUSES: CampusInfo[] = [
  { value: "moscow", label: "Москва", city: "Москва" },
  { value: "spb", label: "Санкт-Петербург", city: "Санкт-Петербург" },
  { value: "nnov", label: "Нижний Новгород", city: "Нижний Новгород" },
  { value: "perm", label: "Пермь", city: "Пермь" }
];

// ─── Ступени образования ─────────────────────────────────────────────────────

export const EDUCATION_LEVELS: EducationLevelInfo[] = [
  { value: "bachelor", label: "Бакалавриат", courses: [1, 2, 3, 4] },
  { value: "specialist", label: "Специалитет", courses: [1, 2, 3, 4, 5] },
  { value: "master", label: "Магистратура", courses: [1, 2] },
  { value: "phd", label: "Аспирантура", courses: [1, 2, 3, 4] }
];

// ─── Факультеты ──────────────────────────────────────────────────────────────

export const FACULTIES: Faculty[] = [
  // ── МОСКВА ─────────────────────────────────────────────────────────────────
  { id: "msk-fcn", campus: "moscow", name: "Факультет компьютерных наук", shortName: "ФКН" },
  { id: "msk-miem", campus: "moscow", name: "МИЭМ им. А. Н. Тихонова", shortName: "МИЭМ" },
  { id: "msk-fen", campus: "moscow", name: "Факультет экономических наук", shortName: "ФЭН" },
  { id: "msk-icef", campus: "moscow", name: "Международный институт экономики и финансов", shortName: "МИЭФ" },
  { id: "msk-fmemp", campus: "moscow", name: "Факультет мировой экономики и мировой политики", shortName: "ФМЭиМП" },
  { id: "msk-gsb", campus: "moscow", name: "Высшая школа бизнеса", shortName: "ВШБ" },
  { id: "msk-law", campus: "moscow", name: "Факультет права" },
  { id: "msk-fsn", campus: "moscow", name: "Факультет социальных наук", shortName: "ФСН" },
  { id: "msk-fgn", campus: "moscow", name: "Факультет гуманитарных наук", shortName: "ФГН" },
  { id: "msk-fkmd", campus: "moscow", name: "Факультет креативных индустрий", shortName: "ФКИ" },
  { id: "msk-design", campus: "moscow", name: "Школа дизайна" },
  { id: "msk-math", campus: "moscow", name: "Факультет математики" },
  { id: "msk-physics", campus: "moscow", name: "Факультет физики" },
  { id: "msk-bio", campus: "moscow", name: "Факультет биологии и биотехнологии" },
  { id: "msk-chem", campus: "moscow", name: "Факультет химии" },
  { id: "msk-geo", campus: "moscow", name: "Факультет географии и геоинформационных технологий" },
  { id: "msk-urban", campus: "moscow", name: "Высшая школа урбанистики им. А. А. Высоковского", shortName: "ВШУ" },
  { id: "msk-other", campus: "moscow", name: "Другое подразделение / институт" },

  // ── САНКТ-ПЕТЕРБУРГ ───────────────────────────────────────────────────────
  { id: "spb-econ", campus: "spb", name: "Санкт-Петербургская школа экономики и менеджмента", shortName: "ШЭМ" },
  { id: "spb-soc", campus: "spb", name: "Санкт-Петербургская школа социальных наук", shortName: "ШСН" },
  { id: "spb-hum", campus: "spb", name: "Санкт-Петербургская школа гуманитарных наук и искусств", shortName: "ШГНИ" },
  { id: "spb-fizmat", campus: "spb", name: "Санкт-Петербургская школа физико-математических и компьютерных наук", shortName: "ШФМКН" },
  { id: "spb-other", campus: "spb", name: "Другое подразделение" },

  // ── НИЖНИЙ НОВГОРОД ───────────────────────────────────────────────────────
  { id: "nn-itmm", campus: "nnov", name: "Факультет информатики, математики и компьютерных наук" },
  { id: "nn-mngmt", campus: "nnov", name: "Факультет менеджмента" },
  { id: "nn-econ", campus: "nnov", name: "Факультет экономики" },
  { id: "nn-law", campus: "nnov", name: "Факультет права" },
  { id: "nn-hum", campus: "nnov", name: "Факультет гуманитарных наук" },
  { id: "nn-other", campus: "nnov", name: "Другое подразделение" },

  // ── ПЕРМЬ ─────────────────────────────────────────────────────────────────
  { id: "perm-econ", campus: "perm", name: "Факультет экономики, менеджмента и бизнес-информатики" },
  { id: "perm-soc", campus: "perm", name: "Факультет социально-гуманитарных наук" },
  { id: "perm-other", campus: "perm", name: "Другое подразделение" }
];

// ─── Образовательные программы ───────────────────────────────────────────────

export const PROGRAMS: Program[] = [
  // ─── ФКН (Москва) ──────────────────────────────────────────────────────────
  // Бакалавриат
  { facultyId: "msk-fcn", level: "bachelor", name: "Прикладная математика и информатика", code: "ПМИ" },
  { facultyId: "msk-fcn", level: "bachelor", name: "Программная инженерия", code: "ПИ" },
  { facultyId: "msk-fcn", level: "bachelor", name: "Прикладной анализ данных и искусственный интеллект", code: "ПАДиИИ" },
  { facultyId: "msk-fcn", level: "bachelor", name: "Дизайн и программирование", code: "ДиП" },
  { facultyId: "msk-fcn", level: "bachelor", name: "Совместный бакалавриат НИУ ВШЭ и Центрального университета", code: "СовПМИ" },
  { facultyId: "msk-fcn", level: "bachelor", name: "Кибербезопасность" },
  // Магистратура
  { facultyId: "msk-fcn", level: "master", name: "Науки о данных" },
  { facultyId: "msk-fcn", level: "master", name: "Системная и программная инженерия" },
  { facultyId: "msk-fcn", level: "master", name: "Финансовые технологии и анализ данных", code: "ФТАД" },
  { facultyId: "msk-fcn", level: "master", name: "Машинное обучение и высоконагруженные системы" },
  { facultyId: "msk-fcn", level: "master", name: "Анализ данных в биологии и медицине" },
  { facultyId: "msk-fcn", level: "master", name: "Магистр по компьютерным наукам", code: "MCS" },
  { facultyId: "msk-fcn", level: "master", name: "Совместная программа с СберУниверситетом по AI" },
  // Аспирантура
  { facultyId: "msk-fcn", level: "phd", name: "Информатика и вычислительная техника" },
  { facultyId: "msk-fcn", level: "phd", name: "Математика и механика" },

  // ─── МИЭМ (Москва) ─────────────────────────────────────────────────────────
  { facultyId: "msk-miem", level: "bachelor", name: "Прикладная математика" },
  { facultyId: "msk-miem", level: "bachelor", name: "Информатика и вычислительная техника" },
  { facultyId: "msk-miem", level: "bachelor", name: "Информационная безопасность" },
  { facultyId: "msk-miem", level: "bachelor", name: "Компьютерная безопасность" },
  { facultyId: "msk-miem", level: "bachelor", name: "Инфокоммуникационные технологии и системы связи", code: "ИКТиСС" },
  { facultyId: "msk-miem", level: "master", name: "Кибербезопасность" },
  { facultyId: "msk-miem", level: "master", name: "Интернет вещей и киберфизические системы" },
  { facultyId: "msk-miem", level: "master", name: "Системы больших данных" },
  { facultyId: "msk-miem", level: "specialist", name: "Компьютерная безопасность" },

  // ─── ФЭН (Москва) ──────────────────────────────────────────────────────────
  { facultyId: "msk-fen", level: "bachelor", name: "Экономика" },
  { facultyId: "msk-fen", level: "bachelor", name: "Экономика и статистика" },
  { facultyId: "msk-fen", level: "bachelor", name: "Экономический анализ" },
  { facultyId: "msk-fen", level: "bachelor", name: "Совместная программа НИУ ВШЭ и РЭШ" },
  { facultyId: "msk-fen", level: "master", name: "Экономика" },
  { facultyId: "msk-fen", level: "master", name: "Прикладная экономика" },
  { facultyId: "msk-fen", level: "master", name: "Финансы и кредит" },
  { facultyId: "msk-fen", level: "master", name: "Финансовая экономика", code: "MAE" },
  { facultyId: "msk-fen", level: "master", name: "Статистическое моделирование и актуарные расчёты" },

  // ─── МИЭФ (Москва) ─────────────────────────────────────────────────────────
  { facultyId: "msk-icef", level: "bachelor", name: "Экономика (совместная программа с University of London / LSE)" },
  { facultyId: "msk-icef", level: "master", name: "Финансовая экономика" },
  { facultyId: "msk-icef", level: "master", name: "Международный финансовый менеджмент" },

  // ─── ФМЭиМП (Москва) ───────────────────────────────────────────────────────
  { facultyId: "msk-fmemp", level: "bachelor", name: "Мировая экономика" },
  { facultyId: "msk-fmemp", level: "bachelor", name: "Международные отношения" },
  { facultyId: "msk-fmemp", level: "bachelor", name: "Востоковедение" },
  { facultyId: "msk-fmemp", level: "master", name: "Международные отношения в Евразии" },
  { facultyId: "msk-fmemp", level: "master", name: "Международная экономика" },
  { facultyId: "msk-fmemp", level: "master", name: "Востоковедение" },

  // ─── ВШБ (Москва) ──────────────────────────────────────────────────────────
  { facultyId: "msk-gsb", level: "bachelor", name: "Менеджмент" },
  { facultyId: "msk-gsb", level: "bachelor", name: "Бизнес-информатика" },
  { facultyId: "msk-gsb", level: "bachelor", name: "Маркетинг и рыночная аналитика" },
  { facultyId: "msk-gsb", level: "bachelor", name: "Логистика и управление цепями поставок" },
  { facultyId: "msk-gsb", level: "bachelor", name: "Управление бизнесом", code: "BBA" },
  { facultyId: "msk-gsb", level: "master", name: "Маркетинг и менеджмент" },
  { facultyId: "msk-gsb", level: "master", name: "Бизнес-аналитика и системы больших данных" },
  { facultyId: "msk-gsb", level: "master", name: "MBA" },
  { facultyId: "msk-gsb", level: "master", name: "Стратегическое управление логистикой" },

  // ─── Право (Москва) ────────────────────────────────────────────────────────
  { facultyId: "msk-law", level: "bachelor", name: "Юриспруденция" },
  { facultyId: "msk-law", level: "bachelor", name: "Юриспруденция: цифровой юрист" },
  { facultyId: "msk-law", level: "bachelor", name: "Юриспруденция: частное право" },
  { facultyId: "msk-law", level: "master", name: "Корпоративный юрист" },
  { facultyId: "msk-law", level: "master", name: "Право информационных технологий и интеллектуальной собственности" },
  { facultyId: "msk-law", level: "master", name: "Уголовное право, криминология, уголовно-исполнительное право" },

  // ─── ФСН (Москва) ──────────────────────────────────────────────────────────
  { facultyId: "msk-fsn", level: "bachelor", name: "Политология" },
  { facultyId: "msk-fsn", level: "bachelor", name: "Психология" },
  { facultyId: "msk-fsn", level: "bachelor", name: "Социология" },
  { facultyId: "msk-fsn", level: "bachelor", name: "Государственное и муниципальное управление", code: "ГМУ" },
  { facultyId: "msk-fsn", level: "master", name: "Прикладная социальная психология" },
  { facultyId: "msk-fsn", level: "master", name: "Прикладная политология" },
  { facultyId: "msk-fsn", level: "master", name: "Социология публичной сферы и социальных коммуникаций" },

  // ─── ФГН (Москва) ──────────────────────────────────────────────────────────
  { facultyId: "msk-fgn", level: "bachelor", name: "История" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Философия" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Филология" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Культурология" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Античность" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Иностранные языки и межкультурная коммуникация" },
  { facultyId: "msk-fgn", level: "bachelor", name: "Фундаментальная и прикладная лингвистика", code: "ФиПЛ" },
  { facultyId: "msk-fgn", level: "master", name: "История" },
  { facultyId: "msk-fgn", level: "master", name: "Цифровые методы в гуманитарных науках" },

  // ─── ФКИ / Креативные индустрии (Москва) ──────────────────────────────────
  { facultyId: "msk-fkmd", level: "bachelor", name: "Журналистика" },
  { facultyId: "msk-fkmd", level: "bachelor", name: "Медиакоммуникации" },
  { facultyId: "msk-fkmd", level: "bachelor", name: "Реклама и связи с общественностью" },
  { facultyId: "msk-fkmd", level: "master", name: "Журналистика данных" },
  { facultyId: "msk-fkmd", level: "master", name: "Менеджмент в СМИ" },

  // ─── Школа дизайна (Москва) ────────────────────────────────────────────────
  { facultyId: "msk-design", level: "bachelor", name: "Дизайн" },
  { facultyId: "msk-design", level: "bachelor", name: "Мода" },
  { facultyId: "msk-design", level: "master", name: "Коммуникационный дизайн" },
  { facultyId: "msk-design", level: "master", name: "Дизайн среды" },

  // ─── Математика, физика, биология, химия (Москва) ─────────────────────────
  { facultyId: "msk-math", level: "bachelor", name: "Математика" },
  { facultyId: "msk-math", level: "master", name: "Математика" },
  { facultyId: "msk-physics", level: "bachelor", name: "Физика" },
  { facultyId: "msk-physics", level: "master", name: "Физика" },
  { facultyId: "msk-bio", level: "bachelor", name: "Биология" },
  { facultyId: "msk-bio", level: "master", name: "Молекулярная и клеточная биология" },
  { facultyId: "msk-chem", level: "bachelor", name: "Химия" },
  { facultyId: "msk-geo", level: "bachelor", name: "География глобальных изменений и геоинформационные технологии" },

  // ─── ВШУ (Москва) ──────────────────────────────────────────────────────────
  { facultyId: "msk-urban", level: "bachelor", name: "Городское планирование" },
  { facultyId: "msk-urban", level: "master", name: "Управление пространственным развитием городов" },

  // ─── СПб ──────────────────────────────────────────────────────────────────
  // ШЭМ
  { facultyId: "spb-econ", level: "bachelor", name: "Экономика" },
  { facultyId: "spb-econ", level: "bachelor", name: "Менеджмент" },
  { facultyId: "spb-econ", level: "bachelor", name: "Логистика и управление цепями поставок" },
  { facultyId: "spb-econ", level: "bachelor", name: "Бизнес-информатика" },
  { facultyId: "spb-econ", level: "bachelor", name: "Управление и аналитика в государственном секторе" },
  { facultyId: "spb-econ", level: "master", name: "Экономика" },
  { facultyId: "spb-econ", level: "master", name: "Финансы" },
  { facultyId: "spb-econ", level: "master", name: "Бизнес-аналитика и big data" },
  // ШСН
  { facultyId: "spb-soc", level: "bachelor", name: "Политология и мировая политика" },
  { facultyId: "spb-soc", level: "bachelor", name: "Социология и социальная информатика" },
  { facultyId: "spb-soc", level: "bachelor", name: "Юриспруденция" },
  { facultyId: "spb-soc", level: "bachelor", name: "Государственное и муниципальное управление" },
  { facultyId: "spb-soc", level: "master", name: "Сравнительная политика Евразии" },
  { facultyId: "spb-soc", level: "master", name: "Современный социальный анализ" },
  // ШГНИ
  { facultyId: "spb-hum", level: "bachelor", name: "История" },
  { facultyId: "spb-hum", level: "bachelor", name: "Филология" },
  { facultyId: "spb-hum", level: "bachelor", name: "Востоковедение" },
  { facultyId: "spb-hum", level: "bachelor", name: "Иностранные языки и межкультурная коммуникация" },
  { facultyId: "spb-hum", level: "bachelor", name: "Дизайн" },
  { facultyId: "spb-hum", level: "master", name: "Восточноевропейские исследования" },
  // ШФМКН
  { facultyId: "spb-fizmat", level: "bachelor", name: "Прикладная математика и информатика" },
  { facultyId: "spb-fizmat", level: "bachelor", name: "Прикладной анализ данных" },
  { facultyId: "spb-fizmat", level: "bachelor", name: "Информатика и вычислительная техника" },
  { facultyId: "spb-fizmat", level: "master", name: "Анализ данных и искусственный интеллект" },

  // ─── НИЖНИЙ НОВГОРОД ──────────────────────────────────────────────────────
  { facultyId: "nn-itmm", level: "bachelor", name: "Прикладная математика и информатика" },
  { facultyId: "nn-itmm", level: "bachelor", name: "Программная инженерия" },
  { facultyId: "nn-itmm", level: "bachelor", name: "Бизнес-информатика" },
  { facultyId: "nn-itmm", level: "bachelor", name: "Фундаментальная и прикладная лингвистика" },
  { facultyId: "nn-itmm", level: "master", name: "Цифровое право и LegalTech" },
  { facultyId: "nn-itmm", level: "master", name: "Системы больших данных" },
  { facultyId: "nn-mngmt", level: "bachelor", name: "Менеджмент" },
  { facultyId: "nn-mngmt", level: "master", name: "Маркетинг" },
  { facultyId: "nn-econ", level: "bachelor", name: "Экономика" },
  { facultyId: "nn-econ", level: "master", name: "Финансы" },
  { facultyId: "nn-law", level: "bachelor", name: "Юриспруденция" },
  { facultyId: "nn-hum", level: "bachelor", name: "Иностранные языки и межкультурная коммуникация" },

  // ─── ПЕРМЬ ────────────────────────────────────────────────────────────────
  { facultyId: "perm-econ", level: "bachelor", name: "Экономика" },
  { facultyId: "perm-econ", level: "bachelor", name: "Менеджмент" },
  { facultyId: "perm-econ", level: "bachelor", name: "Бизнес-информатика" },
  { facultyId: "perm-econ", level: "bachelor", name: "Программная инженерия" },
  { facultyId: "perm-econ", level: "master", name: "Маркетинг" },
  { facultyId: "perm-econ", level: "master", name: "Финансы" },
  { facultyId: "perm-soc", level: "bachelor", name: "Государственное и муниципальное управление" },
  { facultyId: "perm-soc", level: "bachelor", name: "Юриспруденция" },
  { facultyId: "perm-soc", level: "bachelor", name: "История" }
];

// ─── Хелперы ─────────────────────────────────────────────────────────────────

/** Возвращает факультеты выбранного кампуса. */
export function getFacultiesByCampus(campus: Campus): Faculty[] {
  return FACULTIES.filter((f) => f.campus === campus);
}

/** Возвращает программы для факультета и ступени образования. */
export function getProgramsByFacultyAndLevel(
  facultyId: string,
  level: EducationLevel
): Program[] {
  return PROGRAMS.filter((p) => p.facultyId === facultyId && p.level === level);
}

/** Возвращает допустимые курсы для ступени. */
export function getCoursesByLevel(level: EducationLevel): number[] {
  const info = EDUCATION_LEVELS.find((l) => l.value === level);
  return info?.courses ?? [1, 2, 3, 4];
}

/** Человекочитаемое название кампуса. */
export function campusLabel(value: Campus | null | undefined): string {
  if (!value) return "";
  return CAMPUSES.find((c) => c.value === value)?.label ?? value;
}

/** Человекочитаемое название ступени образования. */
export function educationLevelLabel(value: EducationLevel | null | undefined): string {
  if (!value) return "";
  return EDUCATION_LEVELS.find((l) => l.value === value)?.label ?? value;
}

/** Получить факультет по id. */
export function getFacultyById(id: string | null | undefined): Faculty | null {
  if (!id) return null;
  return FACULTIES.find((f) => f.id === id) ?? null;
}

/** Найти id факультета по его имени (для миграции существующих профилей). */
export function findFacultyIdByName(name: string | null | undefined, campus?: Campus): string | null {
  if (!name) return null;
  const haystack = campus ? FACULTIES.filter((f) => f.campus === campus) : FACULTIES;
  const exact = haystack.find((f) => f.name === name || f.shortName === name);
  if (exact) return exact.id;
  const lower = name.toLowerCase();
  const fuzzy = haystack.find(
    (f) => f.name.toLowerCase().includes(lower) || lower.includes(f.name.toLowerCase())
  );
  return fuzzy?.id ?? null;
}
