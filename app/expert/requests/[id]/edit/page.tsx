import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCatalogAccess } from "@/lib/expert-catalog";
import { UserRole } from "@/types/roles";
import NewRequestForm from "../../NewRequestForm";

// FR-08: исправление запроса, возвращённого модератором на доработку (M1).
// Та же анкета, что при отправке, заполненная текущими ответами.

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await checkCatalogAccess();
  if (!access.ok) {
    redirect(access.status === 401 ? "/login" : "/expert");
  }

  const session = await auth();
  if (session?.user?.role !== UserRole.STUDENT) {
    redirect("/expert");
  }

  const { id } = await params;
  const req = await prisma.expertRequest.findUnique({
    where: { id },
    select: {
      status: true,
      topic: true,
      expectedResult: true,
      ownProgress: true,
      problemArea: true,
      materialsUrl: true,
      projectId: true,
      moderatorComment: true,
      expert: {
        select: { id: true, position: true, workplace: true, user: { select: { name: true } } },
      },
      student: {
        select: {
          userId: true,
          direction: true,
          course: true,
          projects: { select: { project: { select: { id: true, title: true } } } },
        },
      },
    },
  });

  // Чужой запрос или запрос не на доработке — к списку, где виден его статус
  if (!req || req.student.userId !== session.user.id || req.status !== "NEEDS_REVISION") {
    redirect("/expert/my-requests");
  }

  return (
    <NewRequestForm
      expert={{
        id: req.expert.id,
        name: req.expert.user.name || "Эксперт",
        position: req.expert.position,
        workplace: req.expert.workplace,
      }}
      projects={req.student.projects.map((m) => m.project)}
      direction={req.student.direction}
      course={req.student.course}
      requestId={id}
      initial={{
        topic: req.topic,
        expectedResult: req.expectedResult,
        ownProgress: req.ownProgress,
        problemArea: req.problemArea,
        materialsUrl: req.materialsUrl,
        projectId: req.projectId,
      }}
      moderatorComment={req.moderatorComment}
    />
  );
}
