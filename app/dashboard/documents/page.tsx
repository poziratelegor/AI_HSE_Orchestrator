import { DashboardContainer, PageHeader } from "@/components/dashboard/ui";
import DocumentsClient from "@/app/dashboard/documents/DocumentsClient";
import { getCurrentUserIdFromCookies } from "@/lib/supabase/queries/auth";
import { getUserDocuments, type DocumentRow } from "@/lib/supabase/queries/documents";

export default async function DocumentsPage() {
  const userId = await getCurrentUserIdFromCookies();

  let documents: DocumentRow[] = [];
  let loadError: string | null = null;

  if (!userId) {
    loadError = "Не удалось определить пользователя. Выполните повторный вход.";
  } else {
    try {
      documents = await getUserDocuments(userId);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Не удалось загрузить документы.";
    }
  }

  return (
    <DashboardContainer>
      <PageHeader
        title="Документы"
        subtitle="Управление учебными материалами для поиска, извлечения тезисов и подготовки ответов в ассистенте."
      />
      <DocumentsClient initialDocuments={documents} loadError={loadError} />
    </DashboardContainer>
  );
}
