import CohortAccessPanel from "@/app/expert/admin/CohortAccessPanel";

// A1: доступ студентов к «Платформе ВКР» по потокам. Страница админки платформы;
// права — middleware (/admin только для ADMIN) и API (/api/expert/admin/access — requireAdmin).
// Доступ к экспертной трубе настраивается отдельно, в её админке.

export default function CohortAccessPage() {
  return <CohortAccessPanel space="vkr" />;
}
