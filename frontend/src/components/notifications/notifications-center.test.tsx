import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/notifications", () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
  type NotificationPage,
} from "@/lib/api/notifications";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { NotificationsCenter } from "./notifications-center";

const mockedRestore = vi.mocked(restoreSession);
const mockedList = vi.mocked(listNotifications);
const mockedMarkRead = vi.mocked(markNotificationRead);
const mockedMarkAll = vi.mocked(markAllNotificationsRead);

function makeUser(): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "InboxUser",
    avatar: "CHAI",
    city: "Bengaluru",
    status: "ACTIVE",
    onboardingRequired: false,
    karma: 0,
    streak: 0,
    cooldownUntil: null,
    ageConfirmedAt: "2026-11-24T00:00:00Z",
    termsAcceptedAt: "2026-11-24T00:00:00Z",
    privacyAcceptedAt: "2026-11-24T00:00:00Z",
    guidelinesAcceptedAt: "2026-11-24T00:00:00Z",
  };
}

function makeNotification(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: "notification-1",
    notificationType: "GIFT_CLAIMED",
    title: "Donor says paid",
    body: "A donor says they paid ₹25. Check your UPI app and confirm.",
    entityType: "GIFT",
    entityId: "gift-1",
    payload: { giftId: "gift-1" },
    readAt: null,
    createdAt: "2026-11-24T00:00:00Z",
    ...overrides,
  };
}

function makePage(notifications: InboxNotification[], unreadCount: number): NotificationPage {
  return { notifications, unreadCount };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedList.mockResolvedValue(makePage([makeNotification()], 1));
});

describe("NotificationsCenter", () => {
  it("asks guests to sign in", async () => {
    mockedRestore.mockResolvedValue(null);
    render(<NotificationsCenter />);

    expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("shows an unread notification and marks it read", async () => {
    const user = userEvent.setup();
    mockedMarkRead.mockResolvedValue(makeNotification({ readAt: "2026-11-24T01:00:00Z" }));

    render(<NotificationsCenter />);

    expect(await screen.findByText("Donor says paid")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Donor says paid" })).toHaveAttribute(
      "href",
      "/gifts/gift-1",
    );
    await user.click(screen.getByRole("button", { name: /mark read/i }));

    expect(mockedMarkRead).toHaveBeenCalledWith("notification-1");
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it("marks all notifications read", async () => {
    const user = userEvent.setup();
    mockedMarkAll.mockResolvedValue(1);
    mockedList
      .mockResolvedValueOnce(makePage([makeNotification()], 1))
      .mockResolvedValueOnce(makePage([makeNotification({ readAt: "2026-11-24T01:00:00Z" })], 0));

    render(<NotificationsCenter />);

    await user.click(await screen.findByRole("button", { name: /mark all read/i }));

    expect(mockedMarkAll).toHaveBeenCalled();
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});
