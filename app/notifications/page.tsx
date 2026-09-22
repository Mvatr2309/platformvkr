"use client";

import NotificationsList from "./NotificationsList";

// Уведомления пространства «Платформа ВКР» (08.22).
// Уведомления экспертной трубы живут на /expert/notifications.

export default function NotificationsPage() {
  return <NotificationsList space="vkr" />;
}
