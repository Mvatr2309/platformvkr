import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSpacesAccess } from "@/lib/expert-access";
import { UserRole } from "@/types/roles";
import MyRequests from "./MyRequests";

// FR-08: исходящие запросы студента.

export default async function MyRequestsPage() {
  const access = await getSpacesAccess();
  if (!access) redirect("/login");
  if (access.expert.state !== "OPEN") redirect("/expert");

  const session = await auth();
  if (session?.user?.role !== UserRole.STUDENT) redirect("/expert");

  return <MyRequests />;
}
