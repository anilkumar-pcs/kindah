import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { HomeActions } from "./home-actions";

const mockedRestore = vi.mocked(restoreSession);

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
});

describe("HomeActions", () => {
  it("shows browse and sign-in paths for guests", async () => {
    mockedRestore.mockResolvedValue(null);

    render(<HomeActions />);

    expect(await screen.findByRole("link", { name: /find a wish/i })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByRole("link", { name: "Share a wish" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fme",
    );
  });

  it("sends signed-in users to My Space to share", async () => {
    mockedRestore.mockResolvedValue(makeUser());

    render(<HomeActions />);

    expect(await screen.findByRole("link", { name: /find a wish/i })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByRole("link", { name: "Share a wish" })).toHaveAttribute("href", "/me");
  });
});
