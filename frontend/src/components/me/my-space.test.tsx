import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/payment-methods", () => ({
  getPaymentMethod: vi.fn(),
  savePaymentMethod: vi.fn(),
}));

vi.mock("@/lib/api/wishes", () => ({
  listMyWishes: vi.fn(),
  createWish: vi.fn(),
  withdrawWish: vi.fn(),
}));

vi.mock("@/lib/api/gifts", () => ({
  listMyGifts: vi.fn(),
}));

import { listMyGifts, type Gift } from "@/lib/api/gifts";
import { getPaymentMethod, savePaymentMethod, type PaymentMethod } from "@/lib/api/payment-methods";
import { createWish, listMyWishes, withdrawWish, type Wish } from "@/lib/api/wishes";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { MySpace } from "./my-space";

const mockedRestore = vi.mocked(restoreSession);
const mockedGetPaymentMethod = vi.mocked(getPaymentMethod);
const mockedSavePaymentMethod = vi.mocked(savePaymentMethod);
const mockedListWishes = vi.mocked(listMyWishes);
const mockedCreateWish = vi.mocked(createWish);
const mockedWithdrawWish = vi.mocked(withdrawWish);
const mockedListGifts = vi.mocked(listMyGifts);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "ChaiLover",
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
    ...overrides,
  };
}

function makePaymentMethod(): PaymentMethod {
  return {
    maskedVpa: "al***@okhdfc",
    version: 1,
    status: "ACTIVE",
    validationStatus: "SYNTAX_ONLY",
    privacyAckAt: "2026-11-24T00:00:00Z",
    updatedAt: "2026-11-24T00:00:00Z",
  };
}

function makeWish(overrides: Partial<Wish> = {}): Wish {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    message: "A warm chai for a long day",
    mood: "LONG_DAY",
    suggestedAmountInr: 25,
    city: "Bengaluru",
    status: "OPEN",
    expiresAt: "2026-11-25T00:00:00Z",
    cooldownUntil: null,
    closedReason: null,
    createdAt: "2026-11-24T00:00:00Z",
    ...overrides,
  };
}

function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    giftId: "gift-1",
    wishId: "22222222-2222-2222-2222-222222222222",
    giftStatus: "DONOR_CLAIMED_PAID",
    wishStatus: "PAYMENT_CLAIMED",
    viewerRole: "RECIPIENT",
    amountInr: 25,
    paymentRefCode: "PAY12345",
    upiIntentUri: null,
    qrPayload: null,
    reservationExpiresAt: "2026-11-24T00:20:00Z",
    recipientResponseDeadline: "2026-11-25T00:00:00Z",
    recipientDisplayName: null,
    createdAt: "2026-11-24T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedGetPaymentMethod.mockResolvedValue(null);
  mockedListWishes.mockResolvedValue([]);
  mockedListGifts.mockResolvedValue([]);
});

describe("MySpace", () => {
  it("saves a UPI ID and shows only the masked value", async () => {
    const user = userEvent.setup();
    mockedSavePaymentMethod.mockResolvedValue(makePaymentMethod());

    render(<MySpace />);

    expect(await screen.findByText(/add your upi id above/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("UPI ID"), "alice@okhdfc");
    await user.click(screen.getByLabelText(/bank-registered name/i));
    await user.click(screen.getByRole("button", { name: /save upi id/i }));

    expect(await screen.findByText("al***@okhdfc")).toBeInTheDocument();
    expect(mockedSavePaymentMethod).toHaveBeenCalledWith("alice@okhdfc", true);
    expect(screen.queryByText("alice@okhdfc")).not.toBeInTheDocument();
  });

  it("publishes a wish with mood, amount and city", async () => {
    const user = userEvent.setup();
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    mockedCreateWish.mockResolvedValue(makeWish());

    render(<MySpace />);

    await screen.findByLabelText(/wish message/i);
    await user.type(screen.getByLabelText(/wish message/i), "A warm chai for a long day");
    await user.selectOptions(screen.getByLabelText(/mood/i), "LONG_DAY");
    await user.type(screen.getByLabelText(/suggested amount/i), "25");
    await user.type(screen.getByLabelText(/city/i), "Bengaluru");
    await user.click(screen.getByRole("button", { name: /publish wish/i }));

    expect(await screen.findByText("Your active wish")).toBeInTheDocument();
    expect((await screen.findAllByText("A warm chai for a long day")).length).toBeGreaterThan(0);
    expect(mockedCreateWish).toHaveBeenCalledWith({
      message: "A warm chai for a long day",
      mood: "LONG_DAY",
      suggestedAmountInr: 25,
      city: "Bengaluru",
    });
  });

  it("withdraws the active wish into cooldown", async () => {
    const user = userEvent.setup();
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    mockedListWishes.mockResolvedValue([makeWish()]);
    mockedWithdrawWish.mockResolvedValue(
      makeWish({
        status: "EXPIRED",
        closedReason: "WITHDRAWN",
        cooldownUntil: "2026-11-27T00:00:00Z",
      }),
    );

    render(<MySpace />);

    await screen.findByText("Your active wish");
    await user.click(screen.getByRole("button", { name: /withdraw wish/i }));

    expect(await screen.findByText("Cooldown")).toBeInTheDocument();
    expect(mockedWithdrawWish).toHaveBeenCalledWith("22222222-2222-2222-2222-222222222222");
  });

  it("lists gifts with the approved status and links to the gift", async () => {
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    mockedListGifts.mockResolvedValue([makeGift()]);

    render(<MySpace />);

    expect(await screen.findByText("Awaiting recipient confirmation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /₹25/i })).toHaveAttribute("href", "/gifts/gift-1");
    expect(screen.getByText(/a kind donor sent this to you/i)).toBeInTheDocument();
  });
});
