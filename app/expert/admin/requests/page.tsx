import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import ModerationQueue from "../ModerationQueue";

// FR-08: очередь модерации запросов (08.13).

export default async function ExpertModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== UserRole.ADMIN) redirect("/spaces");

  return <ModerationQueue />;
}
