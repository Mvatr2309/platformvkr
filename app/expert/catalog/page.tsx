import { redirect } from "next/navigation";
import { checkCatalogAccess } from "@/lib/expert-catalog";
import ExpertCatalog from "./ExpertCatalog";

// FR-08: каталог экспертов (08.10). Доступен студенту из открытого потока и админу.

export default async function ExpertCatalogPage() {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    // 401 — не авторизован, 403 — эксперт или закрытый поток: ведём в свой раздел
    redirect(access.status === 401 ? "/login" : "/expert");
  }

  return <ExpertCatalog />;
}
