import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/discovery", () => ({
  getPublicWish: vi.fn(),
  selectWish: vi.fn(),
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

import { ApiError } from "@/lib/api/client";
import { getPublicWish, selectWish, type PublicWish } from "@/lib/api/discovery";
import { blockWishOwner, reportWish } from "@/lib/api/safety";

import { WishDetail } from "./wish-detail";

const mockedGetWish = vi.mocked(getPublicWish);
const mockedSelectWish = vi.mocked(selectWish);
const mockedReportWish = vi.mocked(reportWish);
const mockedBlockOwner = vi.mocked(blockWishOwner);

function makeWish(): PublicWish {
  return {
    id: "wish-1",
    displayName: "ChaiLover",
    avatar: "CHAI",
    city: "Bengaluru",
    createdAt: "2026-11-24T00:00:00Z",
    mood: "LONG_DAY",
    message: "A warm chai for a long day",
    suggestedAmountInr: 25,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WishDetail", () => {
  it("renders a public wish and selects it", async () => {
    const user = userEvent.setup();
    mockedGetWish.mockResolvedValue(makeWish());
    mockedSelectWish.mockResolvedValue(makeWish());

    render(<WishDetail wishId="wish-1" />);

    expect(await screen.findByText("ChaiLover")).toBeInTheDocument();
    expect(screen.getByText("A warm chai for a long day")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /select this wish/i }));

    expect(await screen.findByText("Wish selected.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /choose amount/i })).toHaveAttribute(
      "href",
      "/gifts/new/wish-1",
    );
    expect(mockedSelectWish).toHaveBeenCalledWith("wish-1");
  });

  it("prompts a guest to sign in when selection is unauthenticated", async () => {
    const user = userEvent.setup();
    mockedGetWish.mockResolvedValue(makeWish());
    mockedSelectWish.mockRejectedValue(
      new ApiError("Authentication required", 401, "AUTH_REQUIRED"),
    );

    render(<WishDetail wishId="wish-1" />);

    await screen.findByText("ChaiLover");
    await user.click(screen.getByRole("button", { name: /select this wish/i }));

    expect(await screen.findByRole("link", { name: /sign in to continue/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
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
