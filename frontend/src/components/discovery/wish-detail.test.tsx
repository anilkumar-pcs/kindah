import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/discovery", () => ({
  getPublicWish: vi.fn(),
}));

vi.mock("@/lib/api/safety", () => ({
  reportWish: vi.fn(),
  blockWishOwner: vi.fn(),
  REPORT_REASON_LABELS: {
    SPAM_BOT: "Spam or bot",
    HARASSMENT_ABUSE: "Harassment or abuse",
    COMMERCIAL_SOLICITATION: "Commercial solicitation",
    INAPPROPRIATE_CONTENT: "Inappropriate content",
    IMPERSONATION: "Impersonation",
    PAYMENT_MISDIRECTION: "Payment misdirection",
    OTHER: "Something else",
  },
}));

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { getPublicWish, type PublicWish } from "@/lib/api/discovery";
import { blockWishOwner, reportWish } from "@/lib/api/safety";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { WishDetail } from "./wish-detail";

const mockedGetWish = vi.mocked(getPublicWish);
const mockedReportWish = vi.mocked(reportWish);
const mockedBlockOwner = vi.mocked(blockWishOwner);
const mockedRestore = vi.mocked(restoreSession);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    displayName: "KindDonor",
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

function makeWish(overrides: Partial<PublicWish> = {}): PublicWish {
  return {
    id: "wish-1",
    displayName: "ChaiLover",
    avatar: "CHAI",
    city: "Bengaluru",
    createdAt: "2026-11-24T00:00:00Z",
    mood: "LONG_DAY",
    message: "A warm chai for a long day",
    suggestedAmountInr: 25,
    isOwnWish: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
});

describe("WishDetail", () => {
  it("shows a direct gift action for a signed-in donor", async () => {
    mockedGetWish.mockResolvedValue(makeWish());

    render(<WishDetail wishId="wish-1" />);

    expect(await screen.findByText("ChaiLover")).toBeInTheDocument();
    expect(screen.getByText("A warm chai for a long day")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send a gift" })).toHaveAttribute(
      "href",
      "/gifts/new/wish-1",
    );
    expect(screen.queryByRole("button", { name: /select this wish/i })).not.toBeInTheDocument();
  });

  it("waits for session restoration before loading the wish", async () => {
    let resolveSession: (value: UserProfile | null) => void = () => undefined;
    mockedRestore.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    mockedGetWish.mockResolvedValue(makeWish());

    render(<WishDetail wishId="wish-1" />);

    expect(mockedGetWish).not.toHaveBeenCalled();
    await act(async () => {
      resolveSession(makeUser());
    });
    await waitFor(() => {
      expect(mockedGetWish).toHaveBeenCalledWith("wish-1");
    });
  });

  it("prompts a guest to sign in with the gift flow as the return path", async () => {
    mockedRestore.mockResolvedValue(null);
    mockedGetWish.mockResolvedValue(makeWish());

    render(<WishDetail wishId="wish-1" />);

    expect(await screen.findByRole("link", { name: /sign in to send a gift/i })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fgifts%2Fnew%2Fwish-1",
    );
  });

  it("explains that an owner cannot gift their own wish", async () => {
    mockedGetWish.mockResolvedValue(makeWish({ isOwnWish: true }));

    render(<WishDetail wishId="wish-1" />);

    expect(await screen.findByText("This is your wish.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage in my space/i })).toHaveAttribute(
      "href",
      "/me",
    );
    expect(screen.queryByRole("link", { name: "Send a gift" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /report this wish/i })).not.toBeInTheDocument();
  });

  it("submits a private report with a reason", async () => {
    const user = userEvent.setup();
    mockedGetWish.mockResolvedValue(makeWish());
    mockedReportWish.mockResolvedValue({
      id: "report-1",
      targetType: "WISH",
      targetId: "wish-1",
      reason: "SPAM_BOT",
      status: "OPEN",
      createdAt: "2026-11-24T00:00:00Z",
    });

    render(<WishDetail wishId="wish-1" />);

    await screen.findByText("ChaiLover");
    await user.click(screen.getByRole("button", { name: /report this wish/i }));
    await user.selectOptions(screen.getByLabelText(/why are you reporting/i), "SPAM_BOT");
    await user.click(screen.getByRole("button", { name: /send report/i }));

    expect(await screen.findByText(/report received/i)).toBeInTheDocument();
    expect(mockedReportWish).toHaveBeenCalledWith("wish-1", "SPAM_BOT");
  });

  it("blocks the wish owner", async () => {
    const user = userEvent.setup();
    mockedGetWish.mockResolvedValue(makeWish());
    mockedBlockOwner.mockResolvedValue({
      blockedUserId: "owner-1",
      displayName: "ChaiLover",
      createdAt: "2026-11-24T00:00:00Z",
    });

    render(<WishDetail wishId="wish-1" />);

    await screen.findByText("ChaiLover");
    await user.click(screen.getByRole("button", { name: /block this person/i }));

    expect(await screen.findByText(/you blocked this person/i)).toBeInTheDocument();
    expect(mockedBlockOwner).toHaveBeenCalledWith("wish-1");
  });

  it("shows an unavailable state for a missing wish", async () => {
    mockedGetWish.mockRejectedValue(new ApiError("Wish not found", 404, "NOT_FOUND"));

    render(<WishDetail wishId="missing" />);

    expect(await screen.findByRole("heading", { name: /wish unavailable/i })).toBeInTheDocument();
  });
});
