import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/discovery", () => ({
  getPublicStats: vi.fn(),
}));

import { getPublicStats, type PublicStats } from "@/lib/api/discovery";

import { CityPulse } from "./city-pulse";

const mockedStats = vi.mocked(getPublicStats);

function makeStats(overrides: Partial<PublicStats> = {}): PublicStats {
  return {
    wishesSharedCount: 123,
    memberCount: 42,
    openWishCount: 7,
    confirmedGiftCountAllTime: 87,
    confirmedGiftValueInrAllTime: 1250,
    confirmedGiftCountThisWeek: 5,
    confirmedGiftValueInrThisWeek: 110,
    activeNeighbourhoodCountThisWeek: 3,
    communityStreakDays: 4,
    weeklyConfirmedGifts: [
      { date: "2026-11-23", count: 0, valueInr: 0 },
      { date: "2026-11-24", count: 1, valueInr: 10 },
      { date: "2026-11-25", count: 0, valueInr: 0 },
      { date: "2026-11-26", count: 2, valueInr: 40 },
      { date: "2026-11-27", count: 0, valueInr: 0 },
      { date: "2026-11-28", count: 2, valueInr: 60 },
      { date: "2026-11-29", count: 0, valueInr: 0 },
    ],
    activeNeighbourhoods: [{ label: "bengaluru", confirmedGiftCount: 3 }],
    generatedAt: "2026-11-25T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CityPulse", () => {
  it("renders aggregate counters and an accessible weekly chart", async () => {
    const user = userEvent.setup();
    mockedStats.mockResolvedValue(makeStats());

    render(<CityPulse />);

    expect(await screen.findByText("Kind neighbours")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("₹1,250")).toBeInTheDocument();
    expect(screen.getByText("4 days")).toBeInTheDocument();
    expect(screen.getByText(/123 wishes shared/i)).toBeInTheDocument();

    const chart = screen.getByRole("img", {
      name: /5 recipient-confirmed gifts this week/i,
    });
    expect(chart).toBeInTheDocument();

    await user.click(screen.getByText(/view daily numbers/i));
    const table = screen.getByRole("table");
    expect(within(table).getByText(/mon 23 nov/i)).toBeInTheDocument();
    expect(within(table).getByText(/sat 28 nov/i)).toBeInTheDocument();
    expect(within(table).getAllByText("₹60")).toHaveLength(1);
  });

  it("shows the thresholded area pulse without private identifiers", async () => {
    mockedStats.mockResolvedValue(makeStats());

    render(<CityPulse />);

    expect(await screen.findByText(/where little gifts landed/i)).toBeInTheDocument();
    expect(screen.getByText(/bengaluru/i)).toBeInTheDocument();
    expect(screen.getByText(/no donor location, precise address or individual/i)).toBeVisible();
    expect(screen.queryByText(/@ok|UTR|\+91/i)).not.toBeInTheDocument();
  });

  it("hides small area slices gracefully", async () => {
    mockedStats.mockResolvedValue(makeStats({ activeNeighbourhoods: [] }));

    render(<CityPulse />);

    expect(
      await screen.findByText(/not enough confirmed activity in an area/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/small slices stay hidden/i)).toBeInTheDocument();
  });

  it("offers a retry when the pulse is unavailable", async () => {
    const user = userEvent.setup();
    mockedStats
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(makeStats({ openWishCount: 99 }));

    render(<CityPulse />);

    expect(await screen.findByText(/city pulse is taking a little pause/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Kind neighbours")).toBeInTheDocument();
    expect(screen.getByText("99")).toBeInTheDocument();
  });
});
