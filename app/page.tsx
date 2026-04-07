import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * Root route /.
 * - Authed users → /dashboard
 * - Guests → marketing page
 *
 * NOTE: delete app/(marketing)/page.tsx — it conflicts with this file
 * (both resolve to /, this one takes precedence anyway).
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some(
    c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (hasSession) redirect("/dashboard");

  return <MarketingPage />;
}

// ─── Shared data ──────────────────────────────────────────────────────────────

const WORKFLOWS = [
  {
    title: "Официальные письма",
    desc: "Опиши ситуацию — получи готовое письмо в деканат, куратору или преподавателю.",
    icon: <LetterIcon />
  },
  {
    title: "Конспекты лекций",
    desc: "Загрузи аудио или текст — получи структурированный конспект с ключевыми идеями.",
    icon: <LectureIcon />
  },
  {
    title: "Задачи и дедлайны",
    desc: "Вставь расписание или силлабус — система выделит задачи в удобный список.",
    icon: <TaskIcon />
  },
  {
    title: "Ответы по материалам",
    desc: "Задай вопрос по загруженным документам — ответ придёт со ссылками на источники.",
    icon: <RagIcon />
  },
  {
    title: "Шпаргалки",
    desc: "Сжатый конспект по теме: определения, формулы и примеры на одной странице.",
    icon: <CheatIcon />
  },
  {
    title: "Тесты для самопроверки",
    desc: "По любой теме — карточки и вопросы с вариантами для подготовки к экзамену.",
    icon: <QuizIcon />
  }
];

const STEPS = [
  { num: "1", label: "Опиши задачу", detail: "Пиши как обычно, на естественном языке." },
  { num: "2", label: "Система выбирает сценарий", detail: "Оркестратор классифицирует запрос и запускает нужный workflow." },
  { num: "3", label: "Получи результат", detail: "Готовый текст, список задач, конспект или ответ по материалам." }
];

// ─── Marketing page ───────────────────────────────────────────────────────────

function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#003A8C]/50">StudyFlow</p>
            <p className="text-sm font-semibold leading-tight text-slate-900">AI Ассистент</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Войти
            </Link>
            <Link href="/signup" className="rounded-xl bg-[#003A8C] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0A4B9D]">
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center">
        <span className="inline-flex items-center rounded-full border border-[#003A8C]/15 bg-[#EAF1FB] px-3 py-1 text-xs font-medium text-[#003A8C]">
          AI-оркестратор для студентов
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Один запрос —<br />
          <span className="text-[#003A8C]">нужный результат</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Описывай задачи на естественном языке. Система сама определяет, что нужно: письмо, конспект, список задач или ответ по материалам.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/signup" className="rounded-xl bg-[#003A8C] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0A4B9D]">
            Начать бесплатно
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            Уже есть аккаунт
          </Link>
        </div>
      </section>

      {/* Example */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Пример</p>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            Напиши вежливое письмо куратору с просьбой перенести дедлайн по курсовой на следующую неделю, сошлись на болезнь.
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#003A8C]/10 bg-[#EAF1FB] px-4 py-3">
            <CheckCircleIcon />
            <p className="text-sm text-[#003A8C]/80">
              Определён сценарий: <strong>Официальное письмо.</strong> Готовлю текст с формальным обращением…
            </p>
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="border-t border-slate-100 bg-[#F8FAFC] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Что умеет ассистент</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-500">
            Шесть сценариев для повседневных учебных задач — все доступны из одного интерфейса.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOWS.map(w => (
              <div key={w.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#003A8C]">
                  {w.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Как это работает</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-5 hidden h-px w-[calc(100%-4rem)] bg-slate-200 sm:block" aria-hidden="true" />
                )}
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#003A8C]/20 bg-[#EAF1FB] text-sm font-semibold text-[#003A8C]">
                  {step.num}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.label}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-[#003A8C] py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-2xl font-semibold text-white">Готов попробовать?</h2>
          <p className="mt-3 text-sm text-blue-100/70">
            Создай аккаунт и начни использовать AI-ассистента прямо сейчас.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-[#003A8C] transition hover:bg-blue-50">
              Создать аккаунт
            </Link>
            <Link href="/login" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Войти
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-6">
        <p className="text-center text-xs text-slate-400">StudyFlow AI — AI-оркестратор для студентов</p>
      </footer>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="7" fill="#003A8C" opacity="0.15" />
      <path d="m5 8 2 2 4-4" stroke="#003A8C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LetterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4" />
      <path d="m3 5 7 5.5L17 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LectureIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 3a1 1 0 0 1 1-1h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="m6 7 1.5 1.5L11 5M6 12l1.5 1.5L11 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7h2M12 12h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function RagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 10a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function CheatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 15V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10l-4-2H4Z" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 8a2 2 0 1 1 2.5 1.9c-.5.1-.5.5-.5 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10" cy="12.5" r="0.75" fill="currentColor" />
    </svg>
  );
}
