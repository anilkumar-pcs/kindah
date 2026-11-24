import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/discovery", () => ({
  getPublicWish: vi.fn(),
}));

vi.mock("@/lib/api/gifts", () => ({
  createGift: vi.fn(),
  newIdempotencyKey: vi.fn(() => "test-idempotency-key"),
  reportDonorOutcome: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { getPublicWish, type PublicWish } from "@/lib/api/discovery";
import { createGift, reportDonorOutcome, type Gift, type GiftStatus } from "@/lib/api/gifts";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { GiftFlow } from "./gift-flow";

const mockedRestore = vi.mocked(restoreSession);
const mockedGetWish = vi.mocked(getPublicWish);
const mockedCreateGift = vi.mocked(createGift);
const mockedOutcome = vi.mocked(reportDonorOutcome);

function makeUser(): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "KindDonor",
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

function makeWish(overrides: Partial<PublicWish> = {}): PublicWish {
  return {
    id: "wish-1",
    displayName: "RecipientOne",
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

function makeGift(status: GiftStatus = "HANDOFF_ISSUED"): Gift {
  const paid = status === "DONOR_CLAIMED_PAID";
  return {
    giftId: "gift-1",
    wishId: "wish-1",
    giftStatus: status,
    wishStatus: paid ? "PAYMENT_CLAIMED" : "LOCKED",
    viewerRole: "DONOR",
    amountInr: 25,
    paymentRefCode: "PAY12345",
    upiIntentUri: "upi://pay?pa=recipient%40okaxis&am=25",
    qrPayload: "upi://pay?pa=recipient%40okaxis&am=25",
    reservationExpiresAt: "2026-11-24T00:20:00Z",
    recipientResponseDeadline: paid ? "2026-11-25T00:00:00Z" : null,
    recipientDisplayName: "RecipientOne",
    reaction: null,
    thankYouMessage: null,
    createdAt: "2026-11-24T00:00:00Z",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedGetWish.mockResolvedValue(makeWish());
});

describe("GiftFlow", () => {
  it("reviews, creates the handoff and records a paid attestation", async () => {
    const user = userEvent.setup();
    mockedCreateGift.mockResolvedValue(makeGift());
    mockedOutcome.mockResolvedValue(makeGift("DONOR_CLAIMED_PAID"));

    render(<GiftFlow wishId="wish-1" />);

    expect(await screen.findByRole("heading", { name: "For RecipientOne" })).toBeInTheDocument();
    expect(screen.getByLabelText(/amount in rupees/i)).toHaveValue(25);
    await user.click(screen.getByRole("button", { name: /review gift/i }));

    expect(await screen.findByRole("heading", { name: /review your gift/i })).toBeInTheDocument();
    expect(screen.getByText("₹25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create upi handoff/i }));

    expect(await screen.findByRole("link", { name: /open upi app/i })).toHaveAttribute(
      "href",
      "upi://pay?pa=recipient%40okaxis&am=25",
    );
    expect(mockedCreateGift).toHaveBeenCalledWith(
      { wishId: "wish-1", amountInr: 25 },
      "test-idempotency-key",
    );

    await user.type(screen.getByLabelText(/utr or reference/i), "123456789012");
    await user.click(screen.getByRole("button", { name: /donor says paid/i }));

    expect(await screen.findAllByText(/awaiting recipient confirmation/i)).not.toHaveLength(0);
    expect(mockedOutcome).toHaveBeenCalledWith(
      "gift-1",
      "PAID",
      "test-idempotency-key",
      "123456789012",
    );
  });

  it("rejects an out-of-range amount before creating a gift", async () => {
    const user = userEvent.setup();
    render(<GiftFlow wishId="wish-1" />);

    const amount = await screen.findByLabelText(/amount in rupees/i);
    await user.clear(amount);
    await user.type(amount, "5");
    await user.click(screen.getByRole("button", { name: /review gift/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/between ₹10 and ₹100/i);
    expect(mockedCreateGift).not.toHaveBeenCalled();
  });

  it("asks guests to sign in without creating a gift", async () => {
    mockedRestore.mockResolvedValue(null);
    render(<GiftFlow wishId="wish-1" />);

    expect(
      await screen.findByRole("heading", { name: /sign in to send a gift/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to continue/i })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fgifts%2Fnew%2Fwish-1",
    );
    expect(mockedGetWish).not.toHaveBeenCalled();
    expect(mockedCreateGift).not.toHaveBeenCalled();
  });

  it("does not offer a gift form for the owner's own wish", async () => {
    mockedGetWish.mockResolvedValue(makeWish({ isOwnWish: true }));
    render(<GiftFlow wishId="wish-1" />);

    expect(await screen.findByText(/this is your own wish/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/amount in rupees/i)).not.toBeInTheDocument();
    expect(mockedCreateGift).not.toHaveBeenCalled();
  });

  it("shows an unavailable state when the wish cannot be loaded", async () => {
    mockedGetWish.mockRejectedValue(new ApiError("Wish not found", 404, "NOT_FOUND"));
    render(<GiftFlow wishId="missing" />);

    expect(
      await screen.findByRole("heading", { name: /could not start this gift/i }),
    ).toBeInTheDocument();
  });
});
