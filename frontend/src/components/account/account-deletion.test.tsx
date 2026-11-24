import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/deletion", () => ({
  cancelDeletion: vi.fn(),
  getMyDeletionRequest: vi.fn(),
  requestDeletion: vi.fn(),
}));

import { ApiError } from "@/lib/api/client";
import {
  cancelDeletion,
  getMyDeletionRequest,
  requestDeletion,
  type DeletionRequest,
} from "@/lib/api/deletion";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { AccountDeletion } from "./account-deletion";

const mockedRestore = vi.mocked(restoreSession);
const mockedGet = vi.mocked(getMyDeletionRequest);
const mockedRequest = vi.mocked(requestDeletion);
const mockedCancel = vi.mocked(cancelDeletion);

function makeUser(): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "DeletionUser",
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

function makeRequest(overrides: Partial<DeletionRequest> = {}): DeletionRequest {
  return {
    id: "request-1",
    status: "REQUESTED",
    reason: "Moving on.",
    requestedAt: "2026-11-24T00:00:00Z",
    cancelledAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedGet.mockRejectedValue(
    new ApiError("No deletion request", 404, "DELETION_REQUEST_NOT_FOUND"),
  );
});

describe("AccountDeletion", () => {
  it("asks guests to sign in", async () => {
    mockedRestore.mockResolvedValue(null);
    render(<AccountDeletion />);

    expect(await screen.findByRole("heading", { name: /account deletion/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("records a deletion request without deleting data", async () => {
    const user = userEvent.setup();
    mockedRequest.mockResolvedValue(makeRequest());

    render(<AccountDeletion />);

    expect(
      await screen.findByRole("heading", { name: /request account deletion/i }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/reason \(optional\)/i), "Moving on.");
    await user.click(screen.getByRole("button", { name: /request deletion/i }));

    expect(await screen.findByText(/deletion request received/i)).toBeInTheDocument();
    expect(screen.getByText(/no account or financial data is deleted now/i)).toBeInTheDocument();
    expect(mockedRequest).toHaveBeenCalledWith("Moving on.");
  });

  it("cancels a pending deletion request", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(makeRequest());
    mockedCancel.mockResolvedValue(
      makeRequest({ status: "CANCELLED", cancelledAt: "2026-11-24T01:00:00Z" }),
    );

    render(<AccountDeletion />);

    await user.click(await screen.findByRole("button", { name: /cancel deletion request/i }));

    expect(await screen.findByText(/previous request was cancelled/i)).toBeInTheDocument();
    expect(mockedCancel).toHaveBeenCalled();
  });

  it("shows the active wish/gift guard", async () => {
    const user = userEvent.setup();
    mockedRequest.mockRejectedValue(
      new ApiError(
        "Finish or withdraw active wishes and gifts before requesting deletion.",
        409,
        "ACTIVE_TRANSACTIONS",
      ),
    );

    render(<AccountDeletion />);

    await user.click(await screen.findByRole("button", { name: /request deletion/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/active wishes and gifts/i);
  });
});
