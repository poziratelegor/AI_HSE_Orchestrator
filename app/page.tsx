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
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--hse-blue)]/50">StudyFlow</p>
            <p className="text-sm font-semibold leading-tight text-slate-900">AI Ассистент</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Войти
            </Link>
            <Link href="/signup" className="rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--hse-blue-mid)]">
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center">
        <span className="inline-flex items-center rounded-full border border-[var(--hse-blue)]/15 bg-[var(--hse-light)] px-3 py-1 text-xs font-medium text-[var(--hse-blue)]">
          AI-оркестратор для студентов
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Один запрос —<br />
          <span className="text-[var(--hse-blue)]">нужный результат</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Описывай задачи на естественном языке. Система сама определяет, что нужно: письмо, конспект, список задач или ответ по материалам.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/signup" className="rounded-xl bg-[var(--hse-blue)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--hse-blue-mid)]">
            Начать бесплатно
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            Уже есть аккаунт
          </Link>
          <a
            href="#contacts"
            className="rounded-xl border border-[var(--hse-blue)]/20 px-6 py-3 text-sm font-medium text-[var(--hse-blue)] transition hover:bg-[var(--hse-light)]"
          >
            Контакты
          </a>
        </div>
      </section>

      {/* Боли студента */}
      <section className="bg-white pb-16 pt-4">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-[var(--hse-blue)]">
            Узнаёшь себя?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { emoji: "😰", title: "Письма в деканат", desc: "Каждый раз с нуля. Формулировки, тон, структура — тратишь час на то, что ИИ делает за 10 секунд." },
              { emoji: "🌊", title: "Завал материалов", desc: "Методичка 80 страниц, запись лекции 2 часа, статьи на английском. Не знаешь с чего начать." },
              { emoji: "⏱️", title: "Дедлайны везде", desc: "Силлабус, Moodle, чаты. Задачи разбросаны — постоянно что-то пропускаешь." }
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
                <div className="mb-3 text-3xl">{item.emoji}</div>
                <h3 className="mb-2 font-semibold text-[var(--hse-blue)]">{item.title}</h3>
                <p className="text-sm text-[var(--hse-text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <div className="rounded-2xl border border-slate-200 bg-[var(--hse-page-bg)] p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Пример</p>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            Напиши вежливое письмо куратору с просьбой перенести дедлайн по курсовой на следующую неделю, сошлись на болезнь.
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--hse-blue)]/10 bg-[var(--hse-light)] px-4 py-3">
            <CheckCircleIcon />
            <p className="text-sm text-[var(--hse-blue)]/80">
              Определён сценарий: <strong>Официальное письмо.</strong> Готовлю текст с формальным обращением…
            </p>
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="border-t border-slate-100 bg-[var(--hse-page-bg)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Что умеет ассистент</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-slate-500">
            Шесть сценариев для повседневных учебных задач — все доступны из одного интерфейса.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOWS.map(w => (
              <div key={w.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(15,45,105,0.12)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hse-light)] text-[var(--hse-blue)]">
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
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hse-blue)]/20 bg-[var(--hse-light)] text-sm font-semibold text-[var(--hse-blue)] transition-transform duration-200 hover:scale-110">
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
      <section className="border-t border-slate-100 bg-gradient-to-br from-[var(--hse-blue)] to-[var(--hse-blue-mid)] py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <h2 className="text-2xl font-semibold text-white">Готов попробовать?</h2>
          <p className="mt-3 text-sm text-blue-100/70">
            Создай аккаунт и начни использовать AI-ассистента прямо сейчас.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-[var(--hse-blue)] transition hover:bg-blue-50">
              Создать аккаунт
            </Link>
            <Link href="/login" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* Footer с контактами */}
      <footer id="contacts" className="border-t border-[var(--hse-border)] bg-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="mb-1 text-sm font-semibold text-[var(--hse-blue)]">StudyFlow AI</p>
              <p className="text-xs text-[var(--hse-text-muted)]">AI-ассистент для студентов НИУ ВШЭ</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--hse-blue)]">Telegram-бот</p>
              <a
                href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--hse-accent)] hover:underline"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                Открыть бота
              </a>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--hse-blue)]">Контакт</p>
              <p className="text-sm text-[var(--hse-text-muted)]">
                {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@studyflow.ai"}
              </p>
            </div>
          </div>
          <div className="mt-8 border-t border-[var(--hse-border)] pt-6 text-center">
            <p className="text-xs text-[var(--hse-text-muted)]">
              {new Date().getFullYear()} StudyFlow AI &mdash; сделано для ВШЭ
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="7" fill="var(--hse-blue)" opacity="0.15" />
      <path d="m5 8 2 2 4-4" stroke="var(--hse-blue)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
