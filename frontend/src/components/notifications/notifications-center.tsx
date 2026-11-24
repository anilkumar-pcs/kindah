"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { ApiError } from "@/lib/api/client";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
} from "@/lib/api/notifications";
import { restoreSession } from "@/lib/auth/session";

type PageState = "loading" | "guest" | "ready" | "error";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function notificationHref(notification: InboxNotification): string | null {
  if (!notification.entityId) {
    return null;
  }
  if (notification.entityType === "GIFT") {
    return `/gifts/${notification.entityId}`;
  }
  if (notification.entityType === "WISH") {
    return `/wishes/${notification.entityId}`;
  }
  if (notification.entityType === "APPEAL") {
    return "/appeals";
  }
  if (notification.entityType === "SUPPORT_CASE") {
    const giftId = notification.payload.giftId;
    return typeof giftId === "string" ? `/gifts/${giftId}` : null;
  }
  return null;
}

export function NotificationsCenter() {
  const [state, setState] = useState<PageState>("loading");
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const page = await listNotifications();
    setNotifications(page.notifications);
    setUnreadCount(page.unreadCount);
  }

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then(async (session) => {
        if (cancelled) {
          return;
        }
        if (!session) {
          setState("guest");
          return;
        }
        await load();
        if (!cancelled) {
          setState("ready");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError ? loadError.message : "Could not load notifications.",
          );
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMarkRead(id: string) {
    setBusy(true);
    setError(null);
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (markError) {
      setError(
        markError instanceof ApiError ? markError.message : "Could not update notification.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAll() {
    setBusy(true);
    setError(null);
    try {
      await markAllNotificationsRead();
      await load();
    } catch (markError) {
      setError(
        markError instanceof ApiError ? markError.message : "Could not update notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <section aria-busy="true" aria-live="polite" className="kindly-card mx-auto max-w-2xl p-6">
        <p className="text-sm text-kindly-muted">Loading notifications…</p>
      </section>
    );
  }

  if (state === "guest") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">Notifications</h1>
        <p className="mt-3 text-sm text-kindly-muted">
          Sign in to see gift, wish, moderation and support updates.
        </p>
        <Link href="/sign-in" className="kindly-btn-primary mt-6">
          Sign in
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="kindly-card mx-auto max-w-xl p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.055em]">
          Notifications unavailable
        </h1>
        <p role="alert" className="kindly-status-error mt-3">
          {error ?? "Could not load notifications."}
        </p>
        <Link href="/" className="kindly-btn-quiet mt-4 !px-0">
          Back to discovery
        </Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Your little inbox"
        title="Notifications"
        description={unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread`}
        aside={
          unreadCount > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleMarkAll}
              className="kindly-btn-secondary"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="kindly-status-error">
          {error}
        </p>
      )}

      {notifications.length === 0 ? (
        <p className="kindly-card p-5 text-sm text-kindly-muted">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => {
            const href = notificationHref(notification);
            const unread = notification.readAt === null;
            return (
              <li
                key={notification.id}
                className={`rounded-[1.4rem] border p-5 text-sm ${
                  unread
                    ? "border-kindly-accent/50 bg-kindly-accent-soft"
                    : "border-kindly-border bg-kindly-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {href ? (
                      <Link href={href} className="font-semibold underline">
                        {notification.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{notification.title}</span>
                    )}
                    {unread && (
                      <span className="kindly-chip ml-2 !px-2 !py-0.5 !text-[9px]">New</span>
                    )}
                  </div>
                  <span className="text-xs text-kindly-muted">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                <p className="mt-2 leading-6">{notification.body}</p>
                {unread && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMarkRead(notification.id)}
                    className="kindly-btn-secondary mt-3 !min-h-9 !px-3 !py-1 !text-xs"
                  >
                    Mark read
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
