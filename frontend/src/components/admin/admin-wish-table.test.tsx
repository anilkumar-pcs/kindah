import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/admin", () => ({
  listAdminWishes: vi.fn(),
  moderateWish: vi.fn(),
  moderateUser: vi.fn(),
}));

import { listAdminWishes, moderateWish, type AdminWish, type AdminWishPage } from "@/lib/api/admin";

import { AdminWishTable } from "./admin-wish-table";

const mockedList = vi.mocked(listAdminWishes);
const mockedModerate = vi.mocked(moderateWish);

function makeWish(overrides: Partial<AdminWish> = {}): AdminWish {
  return {
    id: "wish-1",
    displayName: "ChaiLover",
    message: "A warm chai for a long day",
    mood: "LONG_DAY",
    suggestedAmountInr: 25,
    city: "Bengaluru",
    status: "OPEN",
    closedReason: null,
    createdAt: "2026-11-24T00:00:00Z",
    expiresAt: "2026-11-25T00:00:00Z",
    ...overrides,
  };
}

function makePage(wishes: AdminWish[] = [makeWish()]): AdminWishPage {
  return { wishes, total: wishes.length, page: 1, pageSize: 10 };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedList.mockResolvedValue(makePage());
});

describe("AdminWishTable", () => {
  it("loads a page, filters by status and applies an audited moderation action", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    mockedModerate.mockResolvedValue({
      id: "action-1",
      targetType: "WISH",
      targetId: "wish-1",
      action: "HIDE",
      reason: "Sensitive details in the wish.",
      moderatorDisplayName: "AdminUser",
      createdAt: "2026-11-25T00:00:00Z",
    });

    render(<AdminWishTable mfaToken="verified-token" onChanged={onChanged} />);

    expect(await screen.findByText("A warm chai for a long day")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(mockedList).toHaveBeenCalledWith("verified-token", {
      query: "",
      status: undefined,
      page: 1,
      pageSize: 10,
    });

    await user.selectOptions(screen.getByLabelText(/wish status/i), "REMOVED");
    await waitFor(() => {
      expect(mockedList).toHaveBeenLastCalledWith("verified-token", {
        query: "",
        status: "REMOVED",
        page: 1,
        pageSize: 10,
      });
    });

    await user.click(screen.getByRole("button", { name: /manage wish/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(/reason \(mandatory\)/i),
      "Sensitive details in the wish.",
    );
    await user.click(screen.getByRole("button", { name: /apply action/i }));

    expect(await screen.findByText(/hide recorded with an audit entry/i)).toBeInTheDocument();
    expect(mockedModerate).toHaveBeenCalledWith("verified-token", "wish-1", {
      action: "HIDE",
      reason: "Sensitive details in the wish.",
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("searches wishes and shows an empty state", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValueOnce(makePage()).mockResolvedValueOnce(makePage([]));

    render(<AdminWishTable mfaToken="verified-token" onChanged={vi.fn()} />);

    await screen.findByText("A warm chai for a long day");
    await user.type(screen.getByLabelText(/search wish or pseudonym/i), "nothing");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText("No matching wishes.")).toBeInTheDocument();
    expect(mockedList).toHaveBeenLastCalledWith("verified-token", {
      query: "nothing",
      status: undefined,
      page: 1,
      pageSize: 10,
    });
  });
});
