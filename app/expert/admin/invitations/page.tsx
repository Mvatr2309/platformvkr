import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import ExpertInviteForm from "../ExpertInviteForm";

// FR-08: приглашение внешних экспертов (08.06).

export default async function ExpertInvitationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/spaces");

  return <ExpertInviteForm />;
}
