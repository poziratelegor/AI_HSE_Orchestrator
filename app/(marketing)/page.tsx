import Link from "next/link";

const WORKFLOWS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="14" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="15" cy="14" r="3.5" fill="var(--hse-blue)" opacity="0.9"/>
        <path d="m13.5 14 1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Официальные письма",
    desc: "Опиши ситуацию — получи готовое письмо преподавателю, в деканат или учебный офис."
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 4a1 1 0 0 1 1-1h8l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M11 3v4h4" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="10" cy="13" r="3" fill="var(--hse-blue)" opacity="0.9"/>
        <path d="M10 11.5v1.5l1 1" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Конспекты лекций",
    desc: "Загрузи аудио или текст лекции — получи структурированный конспект с ключевыми идеями."
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <rect x="12" y="12" width="6" height="6" rx="1.5" fill="var(--hse-blue)" opacity="0.9"/>
        <path d="m13.5 15.5 1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Задачи и дедлайны",
    desc: "Вставь расписание или силлабус — система выделит задачи и дедлайны в удобный список."
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="16" height="16" rx="3" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M6 10a4 4 0 0 1 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="14" cy="13" r="3.5" fill="var(--hse-blue)" opacity="0.9"/>
        <path d="M12.5 13h3M14 11.5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Ответы по материалам",
    desc: "Задай вопрос по загруженным документам — ответ придёт со ссылками на источники."
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8l-3-2H4Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    title: "Шпаргалки",
    desc: "Сжатый конспект по теме: ключевые определения, формулы и примеры на одной странице."
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="5" width="16" height="11" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="10" cy="4" r="2" fill="currentColor" opacity="0.4"/>
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Тесты для самопроверки",
    desc: "По любой теме или тексту — карточки и вопросы с вариантами ответов для подготовки."
  }
];

const STEPS = [
  { num: "1", label: "Опиши задачу", detail: "Пиши как обычно, на естественном языке." },
  { num: "2", label: "Система выбирает сценарий", detail: "Оркестратор классифицирует запрос и выбирает нужный workflow." },
  { num: "3", label: "Получи результат", detail: "Готовый текст, список задач, конспект или ответ на вопрос." }
];

const STAGGER_DELAYS = ["0ms", "80ms", "160ms", "240ms", "320ms", "400ms"];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="animate-fade-in">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--hse-blue)]/50">StudyFlow</p>
            <p className="text-sm font-semibold leading-none text-slate-900">AI Ассистент</p>
          </div>
          <div className="flex items-center gap-3 animate-fade-in delay-100">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:text-slate-900"
            >
              Войти
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] active:scale-[0.98]"
            >
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center">
        <span className="animate-fade-in inline-flex items-center rounded-full border border-[var(--hse-blue)]/15 bg-[var(--hse-light)] px-3 py-1 text-xs font-medium text-[var(--hse-blue)]">
          AI-оркестратор для студентов
        </span>
        <h1 className="animate-slide-up delay-100 mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Один запрос —<br />
          <span className="text-[var(--hse-blue)]">нужный результат</span>
        </h1>
        <p className="animate-slide-up delay-200 mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Описывай задачи на естественном языке. Система сама определяет, что нужно: письмо, конспект, список задач или ответ по материалам.
        </p>
        <div className="animate-slide-up delay-300 mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="rounded-xl bg-[var(--hse-blue)] px-6 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] active:scale-[0.98]"
          >
            Начать бесплатно
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            Уже есть аккаунт
          </Link>
        </div>
      </section>

      {/* Example prompt */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <div className="animate-slide-up delay-400 rounded-2xl border border-slate-200 bg-[var(--hse-page-bg)] p-5 shadow-sm transition-shadow hover:shadow-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Пример запроса</p>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            Напиши вежливое письмо куратору с просьбой перенести дедлайн по курсовой на следующую неделю, сошлись на болезнь.
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--hse-blue)]/12 bg-[var(--hse-light)] px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--hse-blue)]">
              <circle cx="8" cy="8" r="7" fill="var(--hse-blue)" opacity="0.15"/>
              <path d="m5 8 2 2 4-4" stroke="var(--hse-blue)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-[var(--hse-blue)]/80">
              Определён сценарий: <strong>Официальное письмо</strong>. Готовлю текст с формальным обращением и аргументацией…
            </p>
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="border-t border-slate-100 bg-[var(--hse-page-bg)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="animate-slide-up text-center text-2xl font-semibold tracking-tight text-slate-900">
            Что умеет ассистент
          </h2>
          <p className="animate-slide-up delay-100 mx-auto mt-3 max-w-lg text-center text-sm text-slate-500">
            Шесть сценариев для повседневных учебных задач — все доступны из одного интерфейса.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOWS.map((w, i) => (
              <div
                key={w.title}
                className="animate-slide-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(15,45,105,0.12)]"
                style={{ animationDelay: STAGGER_DELAYS[i] }}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hse-light)] text-[var(--hse-blue)] transition-transform duration-200 group-hover:scale-110">
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
          <h2 className="animate-slide-up text-center text-2xl font-semibold tracking-tight text-slate-900">
            Как это работает
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="animate-slide-up relative text-center"
                style={{ animationDelay: `${i * 120}ms` }}
              >
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
          <h2 className="animate-slide-up text-2xl font-semibold text-white">Готов попробовать?</h2>
          <p className="animate-slide-up delay-100 mt-3 text-sm text-blue-100/75">
            Создай аккаунт и начни использовать AI-ассистента прямо сейчас.
          </p>
          <div className="animate-slide-up delay-200 mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-[var(--hse-blue)] transition-all duration-150 hover:bg-blue-50 active:scale-[0.98]"
            >
              Создать аккаунт
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-white/10 active:scale-[0.98]"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6">
        <p className="text-center text-xs text-slate-400">StudyFlow AI — AI-оркестратор для студентов</p>
      </footer>
    </div>
  );
}
