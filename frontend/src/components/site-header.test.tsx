import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
  logout: vi.fn(),
}));

import { logout, restoreSession, type UserProfile } from "@/lib/auth/session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/events";

import { SiteHeader } from "./site-header";

const mockedRestore = vi.mocked(restoreSession);
const mockedLogout = vi.mocked(logout);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "ChaiLover",
    avatar: "CHAI",
    city: "Bengaluru",
    status: "ACTIVE",
    role: "USER",
    onboardingRequired: false,
    karma: 0,
    streak: 0,
    cooldownUntil: null,
    ageConfirmedAt: "2026-11-24T00:00:00Z",
    termsAcceptedAt: "2026-11-24T00:00:00Z",
    privacyAcceptedAt: "2026-11-24T00:00:00Z",
    guidelinesAcceptedAt: "2026-11-24T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedLogout.mockResolvedValue();
});

describe("SiteHeader", () => {
  it("puts secondary account actions in the profile menu", async () => {
    const user = userEvent.setup();
    mockedRestore.mockResolvedValue(makeUser());

    render(<SiteHeader />);

    const trigger = await screen.findByRole("button", { name: /chailover/i });
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByRole("link", { name: "Appeals" })).toHaveAttribute("href", "/appeals");
    expect(screen.getByRole("link", { name: "Account deletion" })).toHaveAttribute(
      "href",
      "/account-deletion",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Notifications" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "My space" })).toHaveLength(1);
  });

  it("shows ordinary signed-in users no admin link", async () => {
    mockedRestore.mockResolvedValue(makeUser({ role: "USER" }));

    render(<SiteHeader />);

    expect(await screen.findByText("ChaiLover")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin console/i })).not.toBeInTheDocument();
  });

  it("shows administrators a direct link to the admin console", async () => {
    mockedRestore.mockResolvedValue(makeUser({ displayName: "AnilKumar", role: "ADMIN" }));

    render(<SiteHeader />);

    expect(await screen.findByRole("link", { name: /admin console/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("shows Sign in for guests", async () => {
    mockedRestore.mockResolvedValue(null);

    render(<SiteHeader />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByRole("link", { name: /admin console/i })).not.toBeInTheDocument();
  });

  it("reacts when a session is established without a page reload", async () => {
    mockedRestore.mockResolvedValue(null);

    render(<SiteHeader />);
    await screen.findByRole("link", { name: "Sign in" });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(SESSION_CHANGED_EVENT, {
          detail: makeUser({ displayName: "AnilKumar", role: "ADMIN" }),
        }),
      );
    });

    expect(await screen.findByRole("link", { name: /admin console/i })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("signs out and returns to discovery", async () => {
    const user = userEvent.setup();
    mockedRestore.mockResolvedValue(makeUser({ displayName: "AnilKumar", role: "ADMIN" }));

    render(<SiteHeader />);
    await user.click(await screen.findByRole("button", { name: /anilkumar/i }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(mockedLogout).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin console/i })).not.toBeInTheDocument();
  });
});
