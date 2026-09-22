import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCatalogAccess, getCatalogCard } from "@/lib/expert-catalog";
import { UserRole } from "@/types/roles";
import NewRequestForm from "../NewRequestForm";

// FR-08: анкета запроса на консультацию (08.12).

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ expertId?: string }>;
}) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    redirect(access.status === 401 ? "/login" : "/expert");
  }

  const session = await auth();
  if (session?.user?.role !== UserRole.STUDENT) {
    // Админ каталог смотрит, но запросы не отправляет
    redirect("/expert/catalog");
  }

  const { expertId } = await searchParams;
  const card = expertId ? await getCatalogCard(expertId) : null;
  if (!card) notFound();

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      direction: true,
      course: true,
      projects: { select: { project: { select: { id: true, title: true } } } },
    },
  });
  if (!student) redirect("/profile/student");

  return (
    <NewRequestForm
      expert={{
        id: card.id,
        name: card.user.name || "Эксперт",
        position: card.position,
        workplace: card.workplace,
      }}
      projects={student.projects.map((m) => m.project)}
      direction={student.direction}
      course={student.course}
    />
  );
}
