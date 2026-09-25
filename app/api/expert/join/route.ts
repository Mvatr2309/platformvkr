import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UserRole } from "@/types/roles";
import { grantExpertRole } from "@/lib/expert-role";

// FR-08: подключение роли эксперта научным руководителем (08.05).
// Источник: specs/08-FR-08-expert-pipeline.md (раздел 3.4)
//
// Роль = наличие ExpertProfile (lib/expert-role.ts). Модерации нет — роль
// появляется сразу, клиент после ответа вызывает updateSession().

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Подключить роль себе может только научный руководитель.
  // Внешних экспертов создаёт админ из админки трубы, у админа своя роль.
  if (session.user.role !== UserRole.SUPERVISOR) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Идемпотентно: повторное нажатие ничего не ломает. Карточка предзаполняется
  // из профиля НР — та же логика, что при выдаче роли админом (A2)
  const { created, cardCompleted } = await grantExpertRole(session.user.id);
  return NextResponse.json({ created, cardCompleted });
}
