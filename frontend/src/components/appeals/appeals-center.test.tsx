import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/appeals", () => ({
  listMyAppeals: vi.fn(),
  listMyModerationActions: vi.fn(),
  submitAppeal: vi.fn(),
}));

import {
  listMyAppeals,
  listMyModerationActions,
  submitAppeal,
  type Appeal,
  type ModerationActionSummary,
} from "@/lib/api/appeals";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { AppealsCenter } from "./appeals-center";

const mockedRestore = vi.mocked(restoreSession);
const mockedActions = vi.mocked(listMyModerationActions);
const mockedAppeals = vi.mocked(listMyAppeals);
const mockedSubmit = vi.mocked(submitAppeal);

function makeUser(): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "RestrictedUser",
    avatar: "CHAI",
    city: "Bengaluru",
    status: "RESTRICTED",
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

function makeAction(): ModerationActionSummary {
  return {
    id: "action-1",
    action: "RESTRICT",
    reason: "Repeated spam reports.",
    appealStatus: null,
    canAppeal: true,
    createdAt: "2026-11-24T00:00:00Z",
  };
}

function makeAppeal(): Appeal {
  return {
    id: "appeal-1",
    actionId: "action-1",
    status: "OPEN",
    reason: "Please review my context.",
    resolutionNote: null,
    createdAt: "2026-11-24T00:00:00Z",
    updatedAt: "2026-11-24T00:00:00Z",
    resolvedAt: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedActions.mockResolvedValue([makeAction()]);
  mockedAppeals.mockResolvedValue([]);
});

describe("AppealsCenter", () => {
  it("asks guests to sign in", async () => {
    mockedRestore.mockResolvedValue(null);
    render(<AppealsCenter />);

    expect(await screen.findByRole("heading", { name: "Appeals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("submits an appeal for a restricted account action", async () => {
    const user = userEvent.setup();
    mockedAppeals.mockResolvedValueOnce([]).mockResolvedValue([makeAppeal()]);
    mockedSubmit.mockResolvedValue(makeAppeal());

    render(<AppealsCenter />);

    expect(await screen.findByText("Repeated spam reports.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /appeal this action/i }));
    await user.type(
      screen.getByLabelText(/why should this be reviewed/i),
      "Please review my context.",
    );
    await user.click(screen.getByRole("button", { name: /submit appeal/i }));

    expect(await screen.findByText("OPEN")).toBeInTheDocument();
    expect(mockedSubmit).toHaveBeenCalledWith("action-1", "Please review my context.");
  });

  it("shows a resolved appeal with its note", async () => {
    mockedAppeals.mockResolvedValue([
      {
        ...makeAppeal(),
        status: "ACCEPTED",
        resolutionNote: "Context accepted.",
        resolvedAt: "2026-11-24T01:00:00Z",
      },
    ]);

    render(<AppealsCenter />);

    expect(await screen.findByText("ACCEPTED")).toBeInTheDocument();
    expect(screen.getByText(/resolution: context accepted/i)).toBeInTheDocument();
  });
});
