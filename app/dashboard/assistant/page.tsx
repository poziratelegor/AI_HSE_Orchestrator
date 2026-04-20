import { DashboardContainer, PageHeader } from "@/components/dashboard/ui";
import AssistantClient from "./AssistantClient";

export default function AssistantPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Ассистент"
        subtitle="Центральный интерфейс для запуска AI-сценариев."
      />
      <AssistantClient />
    </DashboardContainer>
  );
}
