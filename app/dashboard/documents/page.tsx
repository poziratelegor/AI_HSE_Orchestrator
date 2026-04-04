import {
  DashboardContainer,
  DataTableShell,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge
} from "@/components/dashboard/ui";

const documents = [
  { name: "Методические рекомендации.pdf", type: "PDF", updated: "04.04.2026", status: "Готов" },
  { name: "Силлабус курса.docx", type: "DOCX", updated: "03.04.2026", status: "Индексируется" },
  { name: "Регламент практики.pdf", type: "PDF", updated: "01.04.2026", status: "Требует проверки" }
];

export default function DocumentsPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Документы"
        subtitle="Управление учебными материалами для поиска, извлечения тезисов и подготовки ответов в ассистенте."
        action={{ label: "Загрузить документ" }}
      />

      <div className="space-y-6">
        <SectionCard title="Библиотека документов" subtitle="Статический список с ключевыми статусами обработки.">
          <DataTableShell
            headers={["Документ", "Формат", "Обновлен", "Статус"]}
            rows={documents.map(doc => (
              <tr key={doc.name}>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{doc.name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{doc.type}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{doc.updated}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge
                    label={doc.status}
                    tone={doc.status === "Готов" ? "success" : doc.status === "Индексируется" ? "info" : "warning"}
                  />
                </td>
              </tr>
            ))}
          />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Пустое состояние" subtitle="Как экран будет выглядеть без документов.">
            <EmptyState
              title="Документы пока не загружены"
              description="Добавьте первые файлы, чтобы использовать суммаризацию, поиск по содержимому и контекстные ответы."
            />
          </SectionCard>

          <SectionCard title="Подсказки по форматам" subtitle="Рекомендации для стабильной обработки.">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              <li>Используйте PDF и DOCX с читаемым текстовым слоем.</li>
              <li>Для длинных материалов разделяйте документ на тематические части.</li>
              <li>Добавляйте документы по курсам и сценариям, чтобы упростить навигацию.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </DashboardContainer>
  );
}
