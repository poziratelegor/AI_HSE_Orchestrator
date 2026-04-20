import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * Root route /.
 * - Authed users → /dashboard
 * - Guests → marketing page
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (hasSession) redirect("/dashboard");

  return <MarketingPage />;
}

// ─── Shared data ──────────────────────────────────────────────────────────────

const WORKFLOWS = [
  {
    title: "Официальные письма",
    desc: "Опишите ситуацию — получите готовое письмо в учебный офис, куратору или преподавателю с правильным обращением.",
    badge: "letter",
    icon: <LetterIcon />
  },
  {
    title: "Конспекты лекций",
    desc: "Загрузите аудио или PDF — получите структурированный конспект с ключевыми идеями и таймкодами.",
    badge: "lecture",
    icon: <LectureIcon />
  },
  {
    title: "Задачи и дедлайны",
    desc: "Скопируйте силлабус, расписание из MyHSE или текст из чата — система выделит задачи в Kanban.",
    badge: "tasks",
    icon: <TaskIcon />
  },
  {
    title: "Q&A по материалам",
    desc: "Загрузите PDF или ссылку на YouTube — задайте вопрос, ответ придёт со ссылками на источники.",
    badge: "rag",
    icon: <RagIcon />
  },
  {
    title: "Шпаргалки",
    desc: "Сжатый конспект по теме: определения, формулы и примеры на одной странице — для быстрого повторения.",
    badge: "cheat",
    icon: <CheatIcon />
  },
  {
    title: "Тесты для самопроверки",
    desc: "Карточки и вопросы с вариантами по любой теме — чтобы проверить себя перед коллоквиумом или экзаменом.",
    badge: "quiz",
    icon: <QuizIcon />
  },
  {
    title: "План подготовки",
    desc: "Скажите дату экзамена и тему — получите план: что повторять каждый день до зачётной недели.",
    badge: "plan",
    icon: <PlanIcon />
  },
  {
    title: "Объяснение «как для друга»",
    desc: "Не понятна тема? Получите объяснение простым языком с аналогиями и примерами.",
    badge: "explain",
    icon: <ExplainIcon />
  },
  {
    title: "Подсказка сценария",
    desc: "Не знаете, что нужно? Опишите задачу — система подскажет, какой инструмент подходит.",
    badge: "router",
    icon: <CompassIcon />
  }
];

const STEPS = [
  {
    num: "1",
    label: "Опишите задачу",
    detail: "Свободным текстом или голосом — как написали бы другу. Без шаблонов и форм."
  },
  {
    num: "2",
    label: "Оркестратор выбирает сценарий",
    detail: "AI определяет, что нужно: письмо, конспект, задачи или ответ по материалам — за секунды."
  },
  {
    num: "3",
    label: "Получите готовый результат",
    detail: "Текст, список, конспект или ответ со ссылками — сразу можно копировать или скачать."
  }
];

const STATS = [
  { value: "9", label: "AI-сценариев" },
  { value: "4", label: "кампуса ВШЭ" },
  { value: "2", label: "канала: web + Telegram" },
  { value: "<10 сек", label: "среднее время ответа" }
];

const HSE_INTEGRATIONS = [
  { name: "SmartLMS", desc: "Импорт расписания и заданий из Moodle" },
  { name: "MyHSE", desc: "Расписание занятий и преподаватели" },
  { name: "Telegram", desc: "Голосовые, фото и текст прямо в боте" },
  { name: "iCal / Google", desc: "Календари экспорта дедлайнов" }
];

// ─── Marketing page ───────────────────────────────────────────────────────────

function MarketingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* Декоративный градиентный фон вверху */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[800px] overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--hse-blue)]/15 blur-3xl" />
        <div className="absolute -right-24 top-12 h-80 w-80 rounded-full bg-[var(--hse-accent)]/15 blur-3xl" />
        <div className="absolute left-1/2 top-72 h-96 w-96 -translate-x-1/2 rounded-full bg-[var(--hse-light)]/40 blur-3xl" />
      </div>

      {/* ─── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hse-blue)] text-white shadow-sm transition group-hover:scale-105">
              <SparkleIcon />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-blue)]/60 leading-none">
                StudyFlow
              </p>
              <p className="text-sm font-semibold leading-tight text-slate-900">AI для ВШЭ</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-slate-900">
              Возможности
            </a>
            <a href="#how" className="transition hover:text-slate-900">
              Как работает
            </a>
            <a href="#integrations" className="transition hover:text-slate-900">
              Интеграции ВШЭ
            </a>
            <a href="#contacts" className="transition hover:text-slate-900">
              Контакты
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:inline-flex"
            >
              Войти
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--hse-blue-mid)] hover:shadow-md"
            >
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24 lg:pt-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            {/* Левая часть */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hse-blue)]/20 bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--hse-blue)] shadow-sm backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--hse-accent)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--hse-accent)]" />
                </span>
                AI-ассистент для студентов НИУ ВШЭ
              </span>

              <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Меньше рутины —{" "}
                <span className="bg-gradient-to-r from-[var(--hse-blue)] via-[var(--hse-blue-mid)] to-[var(--hse-accent)] bg-clip-text text-transparent">
                  больше учёбы
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Один ассистент для всего: от писем в учебный офис до конспектов лекций, поиска по
                методичкам, планов подготовки и Q&A по материалам. Работает в браузере и в
                Telegram.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--hse-blue)] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[var(--hse-blue-mid)] hover:shadow-lg"
                >
                  Начать бесплатно
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    className="transition group-hover:translate-x-0.5"
                  >
                    <path d="M2 7h10m0 0L8 3m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <PlayIcon />
                  Посмотреть, как работает
                </a>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckMiniIcon /> Бесплатно для студентов ВШЭ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckMiniIcon /> Без приглашений
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckMiniIcon /> Работает в Telegram
                </span>
              </div>
            </div>

            {/* Правая часть — мини-демо чат */}
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-[var(--hse-blue)]/12 via-[var(--hse-light)]/30 to-[var(--hse-accent)]/12 blur-xl" />
              <DemoChatCard />
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 shadow-sm sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white px-5 py-5 text-center">
                <p className="text-2xl font-semibold text-[var(--hse-blue)] sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pain points ────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-accent)]">
              Узнаёте себя?
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Боли, знакомые каждому студенту ВШЭ
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: <WorryIcon />,
                title: "Письма в учебный офис",
                desc: "Каждый раз с нуля: формулировки, тон, обращение. Час на то, что AI делает за 10 секунд."
              },
              {
                icon: <WaveIcon />,
                title: "Завал материалов",
                desc: "Методичка на 80 страниц, лекция на 2 часа, статьи на английском. Не понятно, с чего начать."
              },
              {
                icon: <ClockIcon />,
                title: "Дедлайны разбросаны",
                desc: "SmartLMS, MyHSE, силлабус, чаты курса. Постоянно что-то пропускаешь и узнаёшь в последний день."
              }
            ].map((item) => (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--hse-blue)]/20 hover:shadow-[0_12px_32px_rgba(15,45,105,0.10)]"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--hse-light)]/40 transition-transform duration-300 group-hover:scale-125" />
                <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--hse-light)] text-[var(--hse-blue)] transition group-hover:scale-105">
                  {item.icon}
                </div>
                <h3 className="relative mb-2 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="relative text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo / Example block ───────────────────────────────────────────── */}
      <section
        id="demo"
        className="relative overflow-hidden border-t border-slate-100 bg-gradient-to-b from-[var(--hse-page-bg)] to-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-accent)]">
              Как это выглядит
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Один промт — три разных результата
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Оркестратор сам выбирает сценарий. Не надо думать «это шпаргалка или конспект»
              — просто опишите задачу.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <ExampleCard
              prompt="Напиши вежливое письмо куратору с просьбой перенести дедлайн по курсовой на следующую неделю — сошлись на болезнь."
              workflow="Официальное письмо"
              workflowColor="text-[var(--hse-blue)]"
              icon={<LetterIcon />}
              result="Уважаемая Ирина Сергеевна, обращаюсь к Вам с просьбой перенести срок сдачи курсовой работы…"
            />
            <ExampleCard
              prompt="Объясни мне, что такое матрица Якоби, простыми словами и с примером."
              workflow="Объяснение темы"
              workflowColor="text-[var(--hse-accent)]"
              icon={<ExplainIcon />}
              result="Представьте, что у вас есть функция, которая берёт несколько чисел и выдаёт несколько других…"
            />
            <ExampleCard
              prompt="В этом PDF — методичка по матану. Что такое теорема Лагранжа?"
              workflow="Q&A по материалам"
              workflowColor="text-[var(--hse-blue-mid)]"
              icon={<RagIcon />}
              result="Если функция непрерывна на отрезке [a,b]… — Источник: страница 47, методичка."
            />
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="border-t border-slate-100 bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-accent)]">
              Возможности
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              9 сценариев для повседневных задач
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Один интерфейс — все инструменты, которые нужны студенту ВШЭ.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOWS.map((w) => (
              <div
                key={w.title}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--hse-blue)]/30 hover:shadow-[0_10px_30px_rgba(15,45,105,0.10)]"
              >
                <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--hse-light)] to-white text-[var(--hse-blue)] ring-1 ring-[var(--hse-blue)]/10 transition group-hover:scale-105">
                  {w.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────────────────────────── */}
      <section
        id="how"
        className="relative border-t border-slate-100 bg-gradient-to-b from-white to-[var(--hse-page-bg)] py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-accent)]">
              Как работает
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Три шага — и вы получили результат
            </h2>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* Linking line for desktop */}
            <div className="absolute left-[16.6%] right-[16.6%] top-7 hidden h-px bg-gradient-to-r from-transparent via-[var(--hse-blue)]/30 to-transparent sm:block" />
            {STEPS.map((step) => (
              <div key={step.num} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hse-blue)] text-white shadow-lg shadow-[var(--hse-blue)]/20">
                  <span className="text-lg font-semibold">{step.num}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HSE Integrations ───────────────────────────────────────────────── */}
      <section
        id="integrations"
        className="border-t border-slate-100 bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-accent)]">
                Интеграции
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Сделано специально для экосистемы НИУ ВШЭ
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Импортируйте задачи из SmartLMS, расписание из MyHSE, материалы из Google
                Календаря или iCal. Бот понимает голос — записывайте идеи прямо в Telegram.
              </p>
              <div className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-[var(--hse-blue)]/15 bg-[var(--hse-light)]/30 px-4 py-2.5 text-sm text-[var(--hse-blue)]">
                <ShieldIcon />
                <span>RLS Supabase — ваши данные изолированы и зашифрованы</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {HSE_INTEGRATIONS.map((it) => (
                <div
                  key={it.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[var(--hse-blue)]/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--hse-light)] text-[var(--hse-blue)]">
                    <PlugIcon />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{it.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Кампусы ВШЭ */}
          <div className="mt-14 rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-[var(--hse-page-bg)] to-white p-6">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              Поддерживаются все кампусы ВШЭ
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-[var(--hse-blue)]">
              <span className="inline-flex items-center gap-1.5">
                <PinIcon /> Москва
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <PinIcon /> Санкт-Петербург
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <PinIcon /> Нижний Новгород
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <PinIcon /> Пермь
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-slate-100 bg-gradient-to-br from-[var(--hse-blue)] via-[var(--hse-blue-mid)] to-[var(--hse-blue)] py-20 sm:py-24">
        {/* Декоративные элементы */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[var(--hse-accent)]/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <SparkleIcon />
            Регистрация — 30 секунд
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Попробуйте сегодня — учитесь спокойнее завтра
          </h2>
          <p className="mt-4 text-base leading-relaxed text-blue-100/80 sm:text-lg">
            Создайте аккаунт за минуту и получите доступ ко всем 9 сценариям и Telegram-боту.
            Без оплат и приглашений.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-[var(--hse-blue)] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl"
            >
              Создать аккаунт
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7h10m0 0L8 3m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        id="contacts"
        className="border-t border-[var(--hse-border)] bg-[var(--hse-page-bg)] py-14"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--hse-blue)] text-white">
                  <SparkleIcon />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--hse-blue)]/60 leading-none">
                    StudyFlow
                  </p>
                  <p className="text-sm font-semibold leading-tight text-slate-900">AI для ВШЭ</p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
                AI-ассистент, который помогает студентам Высшей школы экономики справляться с
                рутиной — от писем в учебный офис до поиска по материалам и подготовки к
                экзаменам.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-[var(--hse-blue)]">Продукт</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <a href="#features" className="transition hover:text-slate-900">
                    Возможности
                  </a>
                </li>
                <li>
                  <a href="#how" className="transition hover:text-slate-900">
                    Как работает
                  </a>
                </li>
                <li>
                  <a href="#integrations" className="transition hover:text-slate-900">
                    Интеграции ВШЭ
                  </a>
                </li>
                <li>
                  <Link href="/signup" className="transition hover:text-slate-900">
                    Регистрация
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-[var(--hse-blue)]">Связь</p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-[var(--hse-accent)]"
                  >
                    <TelegramIcon />
                    Открыть бота
                  </a>
                </li>
                <li className="text-slate-500">
                  {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@studyflow.ai"}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-[var(--hse-border)] pt-6">
            <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
              <p>© {new Date().getFullYear()} StudyFlow AI — сделано для студентов НИУ ВШЭ</p>
              <p className="text-slate-400">
                Не является официальным сервисом НИУ ВШЭ
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Demo Chat Card ───────────────────────────────────────────────────────────

function DemoChatCard() {
  return (
    <div className="relative rounded-3xl border border-white/60 bg-white/90 p-5 shadow-2xl shadow-[var(--hse-blue)]/10 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between rounded-2xl bg-slate-900/95 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <span className="ml-2 text-xs font-medium text-slate-200">studyflow.ai/dashboard</span>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          ● online
        </span>
      </div>

      {/* Chat */}
      <div className="mt-4 space-y-3">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[var(--hse-blue)] px-4 py-2.5 text-sm text-white shadow-sm">
            Подготовь план подготовки к экзамену по линейной алгебре. Экзамен через 7 дней.
          </div>
        </div>

        {/* AI thinking badge */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--hse-blue)] to-[var(--hse-accent)] text-white shadow-sm">
            <SparkleIcon />
          </div>
          <span className="rounded-full bg-[var(--hse-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--hse-blue)]">
            ✨ Сценарий: <strong>План подготовки</strong> · 96%
          </span>
        </div>

        {/* AI response */}
        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <p className="font-medium text-slate-900">7-дневный план подготовки</p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--hse-light)] text-[10px] font-bold text-[var(--hse-blue)]">1</span>
              <span>Векторные пространства, базис — повторить лекции 1–3</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--hse-light)] text-[10px] font-bold text-[var(--hse-blue)]">2</span>
              <span>Линейные операторы, СЛАУ — задачи 4.1–4.7</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--hse-light)] text-[10px] font-bold text-[var(--hse-blue)]">3</span>
              <span>Собственные значения — 30 минут карточек</span>
            </li>
          </ul>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <ClockMiniIcon />
            <span>Сгенерировано за 4.2 сек</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Example Card ─────────────────────────────────────────────────────────────

function ExampleCard({
  prompt,
  workflow,
  workflowColor,
  icon,
  result
}: {
  prompt: string;
  workflow: string;
  workflowColor: string;
  icon: React.ReactNode;
  result: string;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-[var(--hse-blue)]/20 hover:shadow-[0_12px_28px_rgba(15,45,105,0.12)]">
      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Запрос студента
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">«{prompt}»</p>
      </div>
      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hse-light)] text-[var(--hse-blue)]">
          {icon}
        </div>
        <span className={`text-xs font-semibold ${workflowColor}`}>→ {workflow}</span>
      </div>
      <div className="px-5 pb-5 pt-2.5">
        <p className="line-clamp-3 text-sm italic leading-relaxed text-slate-500">
          {result}
        </p>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1l1.4 4.2L12.6 7 8.4 8.4 7 12.6 5.6 8.4 1.4 7 5.6 5.6 7 1z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 2v10l9-5-9-5z" fill="currentColor" />
    </svg>
  );
}

function CheckMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="var(--hse-blue)" opacity="0.12" />
      <path
        d="m4.5 7 1.7 1.7L9.5 5.4"
        stroke="var(--hse-blue)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockMiniIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M6.5 1.5c-2.2 0-4 1.8-4 4 0 2.7 4 6 4 6s4-3.3 4-6c0-2.2-1.8-4-4-4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.5 2.5 3v3.5c0 3 2 5.3 4.5 6 2.5-.7 4.5-3 4.5-6V3L7 1.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m5 7 1.5 1.5L9.5 5.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M6 2v3M12 2v3M5 5h8v4a4 4 0 0 1-8 0V5zM9 13v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
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

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="14" height="14" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 2v3M13 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="12" r="0.8" fill="currentColor" />
      <circle cx="10" cy="12" r="0.8" fill="currentColor" />
      <circle cx="13" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ExplainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 8a2 2 0 1 1 2.5 1.9c-.5.1-.5.5-.5 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 7l-2 4-4 2 2-4 4-2z" fill="currentColor" />
    </svg>
  );
}

function WorryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8h10M5 11h10M5 14h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6v4l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
