import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
const replace = router.replace;

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  saveConsent: vi.fn(),
  updateProfile: vi.fn(),
}));

import {
  requestOtp,
  restoreSession,
  saveConsent,
  updateProfile,
  verifyOtp,
  type UserProfile,
} from "@/lib/auth/session";

import { SignInFlow } from "./sign-in-flow";

const mockedRestore = vi.mocked(restoreSession);
const mockedRequestOtp = vi.mocked(requestOtp);
const mockedVerifyOtp = vi.mocked(verifyOtp);
const mockedSaveConsent = vi.mocked(saveConsent);
const mockedUpdateProfile = vi.mocked(updateProfile);

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: null,
    avatar: null,
    city: null,
    status: "ACTIVE",
    onboardingRequired: true,
    karma: 0,
    streak: 0,
    cooldownUntil: null,
    ageConfirmedAt: null,
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    guidelinesAcceptedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/sign-in");
  mockedRestore.mockResolvedValue(null);
});

describe("SignInFlow", () => {
  it("runs OTP, consent and profile setup end to end", async () => {
    const user = userEvent.setup();
    mockedRequestOtp.mockResolvedValue({
      message: "If this number can be verified, a code has been sent.",
      expiresInSeconds: 300,
    });
    mockedVerifyOtp.mockResolvedValue({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 900,
      user: makeUser(),
    });
    mockedSaveConsent.mockResolvedValue(
      makeUser({
        ageConfirmedAt: "2026-11-24T00:00:00Z",
        termsAcceptedAt: "2026-11-24T00:00:00Z",
        privacyAcceptedAt: "2026-11-24T00:00:00Z",
        guidelinesAcceptedAt: "2026-11-24T00:00:00Z",
      }),
    );
    mockedUpdateProfile.mockResolvedValue(
      makeUser({
        displayName: "ChaiLover",
        avatar: "CHAI",
        onboardingRequired: false,
      }),
    );

    render(<SignInFlow />);

    expect(
      await screen.findByRole("heading", {
        name: /sign in with your mobile number/i,
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/mobile number/i), "9876543210");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(
      await screen.findByRole("heading", { name: /enter your one-time code/i }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/one-time code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    expect(
      await screen.findByRole("heading", { name: /finish your profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one of six preset symbols/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/display name/i), "ChaiLover");
    await user.click(screen.getByLabelText(/18 years or older/i));
    await user.click(screen.getByLabelText(/draft terms of use/i));
    await user.click(screen.getByLabelText(/draft privacy notice/i));
    await user.click(screen.getByLabelText(/draft community guidelines/i));
    await user.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/me");
    });
    expect(mockedRequestOtp).toHaveBeenCalledWith("9876543210");
    expect(mockedVerifyOtp).toHaveBeenCalledWith("9876543210", "123456");
    expect(mockedSaveConsent).toHaveBeenCalledWith({
      ageConfirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
      guidelinesAccepted: true,
    });
    expect(mockedUpdateProfile).toHaveBeenCalledWith({
      displayName: "ChaiLover",
      avatar: "CHAI",
    });
  });

  it("requires all consent confirmations before saving", async () => {
    const user = userEvent.setup();
    mockedRestore.mockResolvedValue(makeUser());

    render(<SignInFlow />);

    expect(
      await screen.findByRole("heading", { name: /finish your profile/i }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/display name/i), "ChaiLover");
    await user.click(screen.getByRole("button", { name: /finish setup/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /all age and policy confirmations are required/i,
    );
    expect(mockedSaveConsent).not.toHaveBeenCalled();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });

  it("redirects a restored onboarded session to My Space", async () => {
    mockedRestore.mockResolvedValue(
      makeUser({
        displayName: "ChaiLover",
        avatar: "CHAI",
        onboardingRequired: false,
      }),
    );

    render(<SignInFlow />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/me");
    });
  });

  it("returns to a safe requested path after signing in", async () => {
    window.history.replaceState({}, "", "/sign-in?next=%2Fgifts%2Fnew%2Fwish-1");
    mockedRestore.mockResolvedValue(
      makeUser({
        displayName: "ChaiLover",
        avatar: "CHAI",
        onboardingRequired: false,
      }),
    );

    render(<SignInFlow />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/gifts/new/wish-1");
    });
  });

  it("skips session restore when re-authentication is forced", async () => {
    render(<SignInFlow forceReauth />);

    expect(
      await screen.findByRole("heading", {
        name: /sign in with your mobile number/i,
      }),
    ).toBeInTheDocument();
    expect(mockedRestore).not.toHaveBeenCalled();
  });
});
