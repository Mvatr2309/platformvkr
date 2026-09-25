import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/roles";
import { getSpacesAccess } from "@/lib/expert-access";
import { CATALOG_WHERE } from "@/lib/expert-catalog";
import {
  UNHANDLED_STATUSES,
  EXPERT_VISIBLE_STATUSES,
  parseRequestForm,
  ownProjectOrNull,
  notifyModerators,
} from "@/lib/expert-requests";

// FR-08: запросы на консультацию (08.12, 08.18).
// Список отдаётся по роли: студенту — исходящие, эксперту — входящие.

/** Что видит студент в своих запросах: статусы, причины отказа и контакт эксперта после принятия */
const STUDENT_SELECT = {
  id: true,
  status: true,
  topic: true,
  expectedResult: true,
  ownProgress: true,
  problemArea: true,
  materialsUrl: true,
  moderatorComment: true,
  expertComment: true,
  createdAt: true,
  contactsSentAt: true,
  closedAt: true,
  closedWithoutFeedback: true,
  feedbacks: {
    where: { authorSide: "STUDENT" as const },
    select: { metHappened: true, rating: true, comment: true },
  },
  project: { select: { id: true, title: true } },
  expert: {
    select: {
      id: true,
      position: true,
      workplace: true,
      photoUrl: true,
      user: { select: { name: true } },
    },
  },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const role = session.user.role;

  // Студент — исходящие запросы
  if (role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json([]);

    const requests = await prisma.expertRequest.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: STUDENT_SELECT,
    });

    // Контакт эксперта показываем только по принятым запросам (08.11, 08.15)
    const withContacts = await Promise.all(
      requests.map(async (r) => {
        const revealed = ["CONTACTS_SENT", "AWAITING_FEEDBACK", "CLOSED"].includes(r.status);
        if (!revealed) return { ...r, expertContact: null };
        const card = await prisma.expertProfile.findUnique({
          where: { id: r.expert.id },
          select: { contact: true },
        });
        return { ...r, expertContact: card?.contact ?? null };
      })
    );

    return NextResponse.json(withContacts);
  }

  // Эксперт — входящие. До решения модератора и на доработке запросы эксперту не видны (08.14, M1)
  const card = await prisma.expertProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!card) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const requests = await prisma.expertRequest.findMany({
    where: {
      expertId: card.id,
      status: { in: [...EXPERT_VISIBLE_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      topic: true,
      expectedResult: true,
      ownProgress: true,
      problemArea: true,
      materialsUrl: true,
      expertComment: true,
      directionSnapshot: true,
      courseSnapshot: true,
      createdAt: true,
      contactsSentAt: true,
      feedbacks: {
        where: { authorSide: "EXPERT" as const },
        select: { metHappened: true, comment: true },
      },
      project: { select: { id: true, title: true } },
      student: {
        select: {
          id: true,
          contact: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  // Контакт студента раскрываем только после принятия (08.14)
  const safe = requests.map((r) => {
    const revealed = ["CONTACTS_SENT", "AWAITING_FEEDBACK", "CLOSED"].includes(r.status);
    return {
      ...r,
      student: {
        name: r.student.user.name,
        contact: revealed ? r.student.contact : null,
      },
    };
  });

  return NextResponse.json(safe);
}

// POST /api/expert/requests — студент отправляет анкету (08.12)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (session.user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Доступ по когорте проверяем на сервере, а не только замком на плитке (08.07)
  const access = await getSpacesAccess();
  if (!access || access.expert.state !== "OPEN") {
    return NextResponse.json({ error: "Раздел недоступен" }, { status: 403 });
  }

  try {
    const data = await request.json();
    const expertId = String(data.expertId || "");

    if (!expertId) {
      return NextResponse.json({ error: "Эксперт не выбран" }, { status: 400 });
    }
    const form = parseRequestForm(data);
    if ("error" in form) {
      return NextResponse.json({ error: form.error }, { status: 400 });
    }
    const { fields } = form;

    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, direction: true, course: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Профиль студента не заполнен" }, { status: 400 });
    }

    // Запрос можно отправить только эксперту, который реально в каталоге
    const expert = await prisma.expertProfile.findFirst({
      where: { id: expertId, ...CATALOG_WHERE },
      select: { id: true, user: { select: { name: true } } },
    });
    if (!expert) {
      return NextResponse.json({ error: "Эксперт недоступен" }, { status: 404 });
    }

    // Лимитов на количество запросов нет (08.21). Единственная защита — дубль
    // к тому же эксперту, пока предыдущий запрос не рассмотрен.
    const pending = await prisma.expertRequest.findFirst({
      where: {
        studentId: student.id,
        expertId: expert.id,
        status: { in: [...UNHANDLED_STATUSES] },
      },
      select: { id: true, status: true },
    });
    if (pending) {
      return NextResponse.json(
        {
          error:
            pending.status === "NEEDS_REVISION"
              ? "Запрос этому эксперту вернули на доработку — исправьте его в «Мои запросы»"
              : "Вы уже отправили этому эксперту запрос — дождитесь решения по нему",
        },
        { status: 409 }
      );
    }

    const created = await prisma.expertRequest.create({
      data: {
        studentId: student.id,
        expertId: expert.id,
        ...fields,
        projectId: await ownProjectOrNull(fields.projectId, student.id),
        // Снимок профиля: курс и программа со временем меняются
        directionSnapshot: student.direction,
        courseSnapshot: student.course,
      },
      select: { id: true },
    });

    await notifyModerators(created.id, session.user.name || "Студент", expert.user.name || "эксперт");

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка отправки запроса" }, { status: 500 });
  }
}
