"use client";

import NotificationsList from "../../notifications/NotificationsList";

// FR-08: уведомления пространства «Экспертная труба» (08.22).
// Страница лежит внутри route-группы трубы и наследует её гейт доступа:
// студент из закрытого потока сюда не попадёт, внешнему эксперту закрыта платформа.

export default function ExpertNotificationsPage() {
  return <NotificationsList space="expert" />;
}
