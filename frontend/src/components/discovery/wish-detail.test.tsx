import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/discovery", () => ({
  getPublicWish: vi.fn(),
  selectWish: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import { getPublicWish, selectWish, type PublicWish } from "@/lib/api/discovery";

import { WishDetail } from "./wish-detail";

const mockedGetWish = vi.mocked(getPublicWish);
const mockedSelectWish = vi.mocked(selectWish);

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

    expect(await screen.findByRole("link", { name: /sign in to select/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("shows an unavailable state for a missing wish", async () => {
    mockedGetWish.mockRejectedValue(new ApiError("Wish not found", 404, "NOT_FOUND"));

    render(<WishDetail wishId="missing" />);

    expect(await screen.findByRole("heading", { name: /wish unavailable/i })).toBeInTheDocument();
  });
});
