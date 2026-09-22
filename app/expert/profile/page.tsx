import { redirect } from "next/navigation";
import { getSpacesAccess } from "@/lib/expert-access";
import ExpertProfileForm from "../ExpertProfileForm";

// FR-08: карточка эксперта (08.08). Форма — клиентский компонент,
// доступ проверяется здесь и в гейте пространства.

export default async function ExpertProfilePage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");

  // НР без подключённой роли сначала подключает её
  if (access.expert.state === "INVITE") redirect("/expert/join");

  return <ExpertProfileForm />;
}
