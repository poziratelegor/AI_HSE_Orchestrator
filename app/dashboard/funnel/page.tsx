import { redirect } from "next/navigation";

/**
 * /dashboard/funnel — перенаправляет на аналитику.
 * Funnel-данные будут видны в разделе Analytics после подключения backend.
 */
export default function FunnelPage() {
  redirect("/dashboard/analytics");
}
