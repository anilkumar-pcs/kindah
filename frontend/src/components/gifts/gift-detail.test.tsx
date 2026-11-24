import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/gifts", () => ({
  confirmRecipientOutcome: vi.fn(),
  createSupportCase: vi.fn(),
  getGift: vi.fn(),
  getShareCard: vi.fn(),
  newIdempotencyKey: vi.fn(() => "test-idempotency-key"),
  reportDonorOutcome: vi.fn(),
}));

import {
  confirmRecipientOutcome,
  createSupportCase,
  getGift,
  getShareCard,
  type Gift,
  type GiftStatus,
  type SupportCase,
} from "@/lib/api/gifts";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { GiftDetail } from "./gift-detail";

const mockedRestore = vi.mocked(restoreSession);
const mockedGetGift = vi.mocked(getGift);
const mockedConfirm = vi.mocked(confirmRecipientOutcome);
const mockedSupport = vi.mocked(createSupportCase);
const mockedShareCard = vi.mocked(getShareCard);

function makeUser(): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "RecipientOne",
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

function makeGift(
  status: GiftStatus = "DONOR_CLAIMED_PAID",
  viewerRole: Gift["viewerRole"] = "RECIPIENT",
): Gift {
  return {
    giftId: "gift-1",
    wishId: "wish-1",
    giftStatus: status,
    wishStatus: status === "RECIPIENT_CONFIRMED" ? "GRANTED" : "PAYMENT_CLAIMED",
    viewerRole,
    amountInr: 25,
    paymentRefCode: "PAY12345",
    upiIntentUri: viewerRole === "DONOR" ? "upi://pay?pa=recipient%40okaxis&am=25" : null,
    qrPayload: viewerRole === "DONOR" ? "upi://pay?pa=recipient%40okaxis&am=25" : null,
    reservationExpiresAt: "2026-11-24T00:20:00Z",
    recipientResponseDeadline: "2026-11-25T00:00:00Z",
    recipientDisplayName: viewerRole === "DONOR" ? "RecipientOne" : null,
    reaction: null,
    thankYouMessage: null,
    createdAt: "2026-11-24T00:00:00Z",
  };
}

function makeSupportCase(): SupportCase {
  return {
    id: "case-12345678-1234-1234-1234-123456789012",
    caseType: "LATE_PAYMENT",
    status: "OPEN",
    createdAt: "2026-11-24T00:00:00Z",
    updatedAt: "2026-11-24T00:00:00Z",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedGetGift.mockResolvedValue(makeGift());
});

describe("GiftDetail", () => {
  it("lets the recipient confirm receipt with a reaction and note", async () => {
    const user = userEvent.setup();
    mockedConfirm.mockResolvedValue(makeGift("RECIPIENT_CONFIRMED"));

    render(<GiftDetail giftId="gift-1" />);

    expect(
      await screen.findByRole("heading", { name: /did you receive this gift/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/donor says paid/i).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText(/reaction/i), "HEART");
    await user.type(screen.getByLabelText(/thank-you note/i), "Thank you");
    await user.click(screen.getByRole("button", { name: /yes, i received it/i }));

    expect(await screen.findAllByText(/recipient confirmed/i)).not.toHaveLength(0);
    expect(mockedConfirm).toHaveBeenCalledWith(
      "gift-1",
      { outcome: "RECEIVED", reaction: "HEART", message: "Thank you" },
      "test-idempotency-key",
    );
  });

  it("lets a recipient dispute receipt", async () => {
    const user = userEvent.setup();
    mockedConfirm.mockResolvedValue(makeGift("DISPUTED"));

    render(<GiftDetail giftId="gift-1" />);

    await user.click(await screen.findByRole("button", { name: /no, i did not receive it/i }));

    expect(await screen.findAllByText(/disputed/i)).not.toHaveLength(0);
    expect(mockedConfirm).toHaveBeenCalledWith(
      "gift-1",
      { outcome: "NOT_RECEIVED" },
      "test-idempotency-key",
    );
  });

  it("opens an auditable support case from the gift detail", async () => {
    const user = userEvent.setup();
    mockedSupport.mockResolvedValue(makeSupportCase());

    render(<GiftDetail giftId="gift-1" />);

    await user.click(await screen.findByRole("button", { name: /report a problem/i }));
    await user.selectOptions(screen.getByLabelText("What happened?"), "LATE_PAYMENT");
    await user.type(
      screen.getByLabelText(/tell us what happened/i),
      "I paid after the timer ended but the gift is unverified.",
    );
    await user.click(screen.getByRole("button", { name: /send to support/i }));

    expect(await screen.findByText(/support case open/i)).toBeInTheDocument();
    expect(mockedSupport).toHaveBeenCalledWith("gift-1", {
      caseType: "LATE_PAYMENT",
      description: "I paid after the timer ended but the gift is unverified.",
    });
  });

  it("creates a privacy-safe share card for a confirmed gift", async () => {
    const user = userEvent.setup();
    mockedGetGift.mockResolvedValue(makeGift("RECIPIENT_CONFIRMED"));
    mockedShareCard.mockResolvedValue({
      giftId: "gift-1",
      amountInr: 25,
      wishMessage: "A warm chai for a long day",
      recipientDisplayName: "RecipientOne",
      reaction: "HEART",
      thankYouMessage: "Thank you",
      createdAt: "2026-11-24T00:00:00Z",
      shareText: "A ₹25 act of kindness on Kindly for RecipientOne.",
    });

    render(<GiftDetail giftId="gift-1" />);

    await user.click(await screen.findByRole("button", { name: /create share card/i }));

    expect(await screen.findByText(/a ₹25 act of kindness on kindly/i)).toBeInTheDocument();
    expect(mockedShareCard).toHaveBeenCalledWith("gift-1");
    expect(screen.queryByText(/upi:\/\//i)).not.toBeInTheDocument();
  });

  it("shows the handoff and donor outcomes to the donor only", async () => {
    mockedGetGift.mockResolvedValue(makeGift("HANDOFF_ISSUED", "DONOR"));

    render(<GiftDetail giftId="gift-1" />);

    expect(await screen.findByRole("link", { name: /open upi app/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /donor says paid/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /did you receive this gift/i }),
    ).not.toBeInTheDocument();
  });

  it("asks guests to sign in", async () => {
    mockedRestore.mockResolvedValue(null);
    render(<GiftDetail giftId="gift-1" />);

    expect(
      await screen.findByRole("heading", { name: /sign in to view this gift/i }),
    ).toBeInTheDocument();
  });
});
