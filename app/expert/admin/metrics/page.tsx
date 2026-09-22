import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import MetricsPanel from "../MetricsPanel";

// FR-08: метрики раздела (08.19).

export default async function ExpertMetricsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/spaces");

  return <MetricsPanel />;
}
