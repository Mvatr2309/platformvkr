import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import CohortAccessPanel from "../CohortAccessPanel";

// FR-08: доступ студентов к экспертной трубе по потокам (08.07). Модератор — роль ADMIN.
// Доступ к «Платформе ВКР» — отдельная страница в админке платформы (/admin/cohort-access).

export default async function ExpertAccessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/spaces");

  return <CohortAccessPanel space="expert" />;
}
