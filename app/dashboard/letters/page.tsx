import {
  ActionButton,
  DashboardContainer,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge
} from "@/components/dashboard/ui";

const categories = ["Учебный офис", "Преподаватель", "Куратор", "Административный запрос"];

const recentLetters = [
  { subject: "Запрос на консультацию", recipient: "Преподаватель", status: "Отправлен" },
  { subject: "Уточнение по дедлайну", recipient: "Учебный офис", status: "Черновик" },
  { subject: "Подтверждение участия в проекте", recipient: "Куратор", status: "Черновик" }
];

export default function LettersPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Письма"
        subtitle="Генератор и история официальной переписки в едином формальном стиле."
        action={{ label: "Создать письмо" }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Создать письмо" subtitle="Заполните черновик и выберите категорию.">
            <div className="space-y-3">
              <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Тема письма" />
              <textarea className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Коротко опишите ситуацию и цель письма" />
              <ActionButton label="Собрать черновик" />
            </div>
          </SectionCard>

          <SectionCard title="Последние письма" subtitle="История недавних черновиков и отправок.">
            <div className="space-y-3">
              {recentLetters.map(letter => (
                <article key={letter.subject} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{letter.subject}</p>
                    <StatusBadge label={letter.status} tone={letter.status === "Отправлен" ? "success" : "info"} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Получатель: {letter.recipient}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Категории шаблонов" subtitle="Быстрый выбор формата письма.">
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <ActionButton key={category} label={category} secondary />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Превью письма" subtitle="Макет предпросмотра готового текста.">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>Уважаемый(ая) [ФИО],</p>
              <p className="mt-2">Прошу рассмотреть возможность [цель обращения].</p>
              <p className="mt-2">Заранее благодарю за обратную связь.</p>
            </div>
          </SectionCard>

          <EmptyState title="Нет отправленных писем" description="После подключения отправки здесь появятся фактические статусы и журнал коммуникаций." />
        </div>
      </div>
    </DashboardContainer>
  );
}
