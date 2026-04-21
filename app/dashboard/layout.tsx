import { Toaster } from "@/components/dashboard/Toaster";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getCurrentUserWithRole } from "@/lib/repository/auth";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { role, fullName, email } = await getCurrentUserWithRole();
  const displayName = fullName ?? email ?? "Студент";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <DashboardShell role={role} displayName={displayName} initial={initial}>
        {children}
      </DashboardShell>
      <Toaster />
    </>
  );
}
