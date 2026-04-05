import { DashboardContainer, PageHeader } from "@/components/dashboard/ui";
import LettersClient from "@/app/dashboard/letters/LettersClient";
import { getCurrentUserIdFromCookies } from "@/lib/supabase/queries/auth";
import { getUserLetters, type LetterRow } from "@/lib/supabase/queries/letters";

export default async function LettersPage() {
  const userId = await getCurrentUserIdFromCookies();

  let letters: LetterRow[] = [];
  let loadError: string | null = null;

  if (!userId) {
    loadError = "Не удалось определить пользователя. Выполните повторный вход.";
  } else {
    try {
      letters = await getUserLetters(userId);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Не удалось загрузить письма.";
    }
  }

  return (
    <DashboardContainer>
      <PageHeader
        title="Письма"
        subtitle="Генератор и история официальной переписки в едином формальном стиле."
      />
      <LettersClient initialLetters={letters} loadError={loadError} />
    </DashboardContainer>
  );
}
