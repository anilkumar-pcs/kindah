import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
}));

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
  logout: vi.fn(),
}));

import { logout, restoreSession, type UserProfile } from "@/lib/auth/session";

import { MobileTabBar } from "./mobile-tab-bar";

const mockedRestore = vi.mocked(restoreSession);
const mockedLogout = vi.mocked(logout);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "ChaiLover",
    avatar: "CHAI",
    city: "Bengaluru",
    status: "ACTIVE",
    role: "ADMIN",
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
  nav.pathname = "/";
  mockedRestore.mockResolvedValue(makeUser());
  mockedLogout.mockResolvedValue();
});

describe("MobileTabBar", () => {
  it("renders the mobile tabs and account sheet", async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);

    expect(
      await screen.findByRole("navigation", { name: /mobile navigation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "My Space" })).toHaveAttribute("href", "/me");

    await user.click(screen.getByRole("button", { name: "Account" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeals" })).toHaveAttribute("href", "/appeals");
    expect(screen.getByRole("link", { name: "Account deletion" })).toHaveAttribute(
      "href",
      "/account-deletion",
    );
    expect(screen.getByRole("link", { name: "Admin console" })).toHaveAttribute("href", "/admin");
  });

  it("keeps Discover active while viewing a wish", async () => {
    nav.pathname = "/wishes/wish-1";
    render(<MobileTabBar />);

    expect(await screen.findByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("offers sign-in to guests with a return path", async () => {
    nav.pathname = "/me";
    mockedRestore.mockResolvedValue(null);

    render(<MobileTabBar />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fme",
    );
    expect(screen.queryByRole("button", { name: "Account" })).not.toBeInTheDocument();
  });

  it("does not appear on focused authentication screens", () => {
    nav.pathname = "/sign-in";

    render(<MobileTabBar />);

    expect(
      screen.queryByRole("navigation", { name: /mobile navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("signs out from the account sheet", async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);

    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(mockedLogout).toHaveBeenCalledOnce();
      expect(nav.push).toHaveBeenCalledWith("/");
      expect(nav.refresh).toHaveBeenCalled();
    });
  });
});
