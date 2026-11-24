import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/api/safety", () => ({
  listBlocks: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock("@/lib/api/karma", () => ({
  getKarmaSummary: vi.fn(),
}));

import { listMyGifts, type Gift } from "@/lib/api/gifts";
import { getKarmaSummary, type KarmaSummary } from "@/lib/api/karma";
import { listBlocks, unblockUser } from "@/lib/api/safety";
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
const mockedListBlocks = vi.mocked(listBlocks);
const mockedUnblockUser = vi.mocked(unblockUser);
const mockedGetKarma = vi.mocked(getKarmaSummary);

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

function makeKarma(): KarmaSummary {
  return {
    balance: 30,
    streak: 1,
    events: [
      {
        id: "karma-1",
        eventType: "FIRST_CONFIRMED_GIFT",
        pointsDelta: 25,
        giftId: "gift-1",
        createdAt: "2026-11-24T00:00:00Z",
      },
    ],
    badges: [{ badgeCode: "FIRST_GIFT", label: "First gift", unlockedAt: "2026-11-24T00:00:00Z" }],
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
    reaction: null,
    thankYouMessage: null,
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
  mockedListBlocks.mockResolvedValue([]);
  mockedGetKarma.mockResolvedValue(makeKarma());
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

  it("shows ledger-derived karma, streak and badges", async () => {
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    render(<MySpace />);

    expect(await screen.findByText("Karma & badges")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("Three-day streak")).not.toBeInTheDocument();
    expect(screen.getByText("First gift")).toBeInTheDocument();
    expect(screen.getByText("First confirmed gift")).toBeInTheDocument();
  });

  it("lists gifts with the approved status and links to the gift", async () => {
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    mockedListGifts.mockResolvedValue([makeGift()]);

    render(<MySpace />);

    expect(await screen.findByText("Awaiting recipient confirmation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /₹25/i })).toHaveAttribute("href", "/gifts/gift-1");
    expect(screen.getByText(/a kind donor sent this to you/i)).toBeInTheDocument();
  });

  it("lists blocked accounts and unblocks one", async () => {
    const user = userEvent.setup();
    mockedGetPaymentMethod.mockResolvedValue(makePaymentMethod());
    mockedListBlocks.mockResolvedValue([
      {
        blockedUserId: "blocked-user-1",
        displayName: "BlockedPerson",
        createdAt: "2026-11-24T00:00:00Z",
      },
    ]);
    mockedUnblockUser.mockResolvedValue(undefined);

    render(<MySpace />);

    expect(await screen.findByText("BlockedPerson")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /unblock blockedperson/i }));

    await waitFor(() => {
      expect(screen.queryByText("BlockedPerson")).not.toBeInTheDocument();
    });
    expect(mockedUnblockUser).toHaveBeenCalledWith("blocked-user-1");
  });
});
