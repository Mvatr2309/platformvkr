import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Inbox from "./Inbox";

// FR-08: входящие запросы эксперта (08.14).

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const card = await prisma.expertProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  // Входящие есть только у того, у кого есть карточка эксперта
  if (!card) redirect("/expert");

  return <Inbox />;
}
