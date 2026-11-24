import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/discovery", () => ({
  listPublicWishes: vi.fn(),
}));

import { listPublicWishes, type PublicWish } from "@/lib/api/discovery";

import { DiscoverFeed } from "./discover-feed";

const mockedList = vi.mocked(listPublicWishes);

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
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DiscoverFeed", () => {
  it("renders public wish cards", async () => {
    mockedList.mockResolvedValue({
      wishes: [makeWish()],
      nextCursor: null,
      seed: null,
    });

    render(<DiscoverFeed />);

    expect(await screen.findByText("ChaiLover")).toBeInTheDocument();
    expect(screen.getByText("A warm chai for a long day")).toBeInTheDocument();
    expect(screen.getByText(/suggested ₹25/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chailover/i })).toHaveAttribute(
      "href",
      "/wishes/wish-1",
    );
  });

  it("renders an empty state when no wishes are open", async () => {
    mockedList.mockResolvedValue({ wishes: [], nextCursor: null, seed: null });

    render(<DiscoverFeed />);

    expect(await screen.findByText(/no wishes are open right now/i)).toBeInTheDocument();
  });

  it("loads the next cursor page", async () => {
    const user = userEvent.setup();
    mockedList
      .mockResolvedValueOnce({
        wishes: [makeWish()],
        nextCursor: "cursor-1",
        seed: null,
      })
      .mockResolvedValueOnce({
        wishes: [makeWish({ id: "wish-2", displayName: "SecondGiver" })],
        nextCursor: null,
        seed: null,
      });

    render(<DiscoverFeed />);
    await screen.findByText("ChaiLover");
    await user.click(screen.getByRole("button", { name: /load more wishes/i }));

    expect(await screen.findByText("SecondGiver")).toBeInTheDocument();
    expect(mockedList).toHaveBeenLastCalledWith({
      sort: "fresh",
      city: undefined,
      cursor: "cursor-1",
      seed: undefined,
      limit: 6,
    });
  });
});
