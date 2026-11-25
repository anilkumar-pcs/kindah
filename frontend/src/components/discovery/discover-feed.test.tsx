import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/lib/api/discovery", () => ({
  listPublicWishes: vi.fn(),
  surpriseMe: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

import { listPublicWishes, surpriseMe, type PublicWish } from "@/lib/api/discovery";
import { restoreSession } from "@/lib/auth/session";

import { DiscoverFeed } from "./discover-feed";

const mockedList = vi.mocked(listPublicWishes);
const mockedSurprise = vi.mocked(surpriseMe);
const mockedRestore = vi.mocked(restoreSession);

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

function page(wishes: PublicWish[] = [], totalCount = wishes.length) {
  return { wishes, nextCursor: null, seed: null, totalCount };
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  mockedRestore.mockResolvedValue(null);
});

describe("DiscoverFeed", () => {
  it("renders public wish cards and the result total", async () => {
    mockedList.mockResolvedValue(page([makeWish()], 7));

    render(<DiscoverFeed />);

    const card = await screen.findByRole("link", { name: /chailover/i });
    expect(within(card).getByText("A warm chai for a long day")).toBeInTheDocument();
    expect(within(card).getByText(/₹25/i)).toBeInTheDocument();
    expect(within(card).getByText("suggested")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 7 wishes")).toBeInTheDocument();
    expect(card).toHaveAttribute("href", "/wishes/wish-1");
    expect(screen.queryByLabelText(/city filter/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Long day" })).not.toBeInTheDocument();
  });

  it("waits for session restoration before loading the feed", async () => {
    let resolveSession: (value: null) => void = () => undefined;
    mockedRestore.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    mockedList.mockResolvedValue(page());

    render(<DiscoverFeed />);

    expect(mockedList).not.toHaveBeenCalled();
    await act(async () => {
      resolveSession(null);
    });
    await waitFor(() => {
      expect(mockedList).toHaveBeenCalled();
    });
  });

  it("applies a text search and writes it to the URL", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(page([makeWish()]));

    render(<DiscoverFeed />);
    await screen.findByText("ChaiLover");
    await user.type(screen.getByRole("searchbox", { name: /search wishes/i }), "chai");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(mockedList).toHaveBeenLastCalledWith({
        sort: "fresh",
        limit: 6,
        q: "chai",
      });
    });
    await waitFor(() => {
      expect(window.location.search).toContain("q=chai");
    });
  });

  it("applies mood and amount filters, then clears them", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(page([makeWish()]));

    render(<DiscoverFeed />);
    await screen.findByText("ChaiLover");

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(screen.getByRole("button", { name: "Long day" }));
    await waitFor(() => {
      expect(mockedList).toHaveBeenLastCalledWith({
        sort: "fresh",
        limit: 6,
        mood: "LONG_DAY",
      });
    });

    await user.selectOptions(screen.getByLabelText(/amount/i), "10-25");
    await waitFor(() => {
      expect(mockedList).toHaveBeenLastCalledWith({
        sort: "fresh",
        limit: 6,
        mood: "LONG_DAY",
        amountMin: 10,
        amountMax: 25,
      });
    });

    await user.click(screen.getByRole("button", { name: /clear filter/i }));
    await waitFor(() => {
      expect(mockedList).toHaveBeenLastCalledWith({
        sort: "fresh",
        limit: 6,
      });
    });
  });

  it("hydrates filters from a deep link", async () => {
    window.history.replaceState(
      null,
      "",
      "/discover?q=chai&mood=LONG_DAY&amount=10-25&sort=random",
    );
    mockedList.mockResolvedValue(page([makeWish()]));

    render(<DiscoverFeed />);

    await waitFor(() => {
      expect(mockedList).toHaveBeenCalledWith({
        sort: "random",
        limit: 6,
        q: "chai",
        mood: "LONG_DAY",
        amountMin: 10,
        amountMax: 25,
      });
    });
    expect(screen.getByRole("searchbox", { name: /search wishes/i })).toHaveValue("chai");
  });

  it("shows a filter-specific empty state", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(page());

    render(<DiscoverFeed />);
    await screen.findByText(/no wishes are open right now/i);

    await user.click(screen.getByRole("button", { name: /filters/i }));
    await user.click(await screen.findByRole("button", { name: "Tiny treat" }));

    expect(await screen.findByText(/no wishes matched\. try a wider search/i)).toBeInTheDocument();
  });

  it("picks a Surprise Me wish and remembers session skips", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue(page());
    mockedSurprise.mockResolvedValue(makeWish({ id: "wish-2" }));

    render(<DiscoverFeed />);

    await user.click(screen.getByRole("button", { name: /surprise me/i }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/wishes/wish-2");
    });
    expect(mockedSurprise).toHaveBeenCalledWith([]);
    expect(sessionStorage.getItem("kindly:surprise-skips")).toContain("wish-2");
  });

  it("renders an empty state when no wishes are open", async () => {
    mockedList.mockResolvedValue(page());

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
        totalCount: 2,
      })
      .mockResolvedValueOnce({
        wishes: [makeWish({ id: "wish-2", displayName: "SecondGiver" })],
        nextCursor: null,
        seed: null,
        totalCount: 2,
      });

    render(<DiscoverFeed />);
    await screen.findByText("ChaiLover");
    await user.click(screen.getByRole("button", { name: /load more wishes/i }));

    expect(await screen.findByText("SecondGiver")).toBeInTheDocument();
    expect(mockedList).toHaveBeenLastCalledWith({
      sort: "fresh",
      limit: 6,
      cursor: "cursor-1",
      seed: undefined,
    });
  });
});
