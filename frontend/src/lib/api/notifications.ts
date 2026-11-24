import { apiFetch } from "@/lib/api/client";

export type InboxNotification = {
  id: string;
  notificationType: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  notifications: InboxNotification[];
  unreadCount: number;
};

export async function listNotifications(): Promise<NotificationPage> {
  return apiFetch<NotificationPage>("/api/v1/me/notifications");
}

export async function markNotificationRead(id: string): Promise<InboxNotification> {
  return apiFetch<InboxNotification>(`/api/v1/me/notifications/${id}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<number> {
  const data = await apiFetch<{ marked: number }>("/api/v1/me/notifications/read-all", {
    method: "POST",
  });
  return data.marked;
}
