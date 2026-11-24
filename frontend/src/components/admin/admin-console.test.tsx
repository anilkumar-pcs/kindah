import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  restoreSession: vi.fn(),
}));

vi.mock("@/lib/api/admin", () => ({
  enableAdminMfa: vi.fn(),
  getAdminMfaStatus: vi.fn(),
  createAdminBadge: vi.fn(),
  deactivateAdminBadge: vi.fn(),
  listAdminAppeals: vi.fn(),
  listAdminAuditLogs: vi.fn(),
  listAdminBadges: vi.fn(),
  listAdminDeletionRequests: vi.fn(),
  listAdminOutboxDeadLetters: vi.fn(),
  listAdminReports: vi.fn(),
  listAdminSupportCases: vi.fn(),
  listAdminUsers: vi.fn(),
  moderateUser: vi.fn(),
  moderateWish: vi.fn(),
  resolveAppeal: vi.fn(),
  resolveSupportCase: vi.fn(),
  setupAdminMfa: vi.fn(),
  updateAdminBadge: vi.fn(),
  updateUserRole: vi.fn(),
  verifyAdminMfa: vi.fn(),
}));

import {
  enableAdminMfa,
  getAdminMfaStatus,
  listAdminAppeals,
  listAdminAuditLogs,
  listAdminBadges,
  listAdminDeletionRequests,
  listAdminOutboxDeadLetters,
  listAdminReports,
  listAdminSupportCases,
  listAdminUsers,
  moderateWish,
  resolveAppeal,
  resolveSupportCase,
  setupAdminMfa,
  updateUserRole,
  verifyAdminMfa,
  type AdminSupportCase,
} from "@/lib/api/admin";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

import { AdminConsole } from "./admin-console";

const mockedRestore = vi.mocked(restoreSession);
const mockedStatus = vi.mocked(getAdminMfaStatus);
const mockedSetup = vi.mocked(setupAdminMfa);
const mockedEnable = vi.mocked(enableAdminMfa);
const mockedVerify = vi.mocked(verifyAdminMfa);
const mockedReports = vi.mocked(listAdminReports);
const mockedSupport = vi.mocked(listAdminSupportCases);
const mockedAudit = vi.mocked(listAdminAuditLogs);
const mockedResolve = vi.mocked(resolveSupportCase);
const mockedModerateWish = vi.mocked(moderateWish);
const mockedAppeals = vi.mocked(listAdminAppeals);
const mockedDeletionRequests = vi.mocked(listAdminDeletionRequests);
const mockedDeadLetters = vi.mocked(listAdminOutboxDeadLetters);
const mockedUsers = vi.mocked(listAdminUsers);
const mockedBadges = vi.mocked(listAdminBadges);
const mockedUpdateRole = vi.mocked(updateUserRole);
const mockedResolveAppeal = vi.mocked(resolveAppeal);

function makeUser(role: "USER" | "ADMIN" = "ADMIN"): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "AdminUser",
    avatar: "CHAI",
    city: "Bengaluru",
    status: "ACTIVE",
    role,
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

function makeCase(overrides: Partial<AdminSupportCase> = {}): AdminSupportCase {
  return {
    id: "case-1",
    giftId: "gift-1",
    wishId: "wish-1",
    caseType: "LATE_PAYMENT",
    status: "OPEN",
    description: "I paid after the timer ended.",
    reporterDisplayName: "DonorUser",
    donorDisplayName: "DonorUser",
    recipientDisplayName: "RecipientUser",
    amountInr: 25,
    giftStatus: "UNVERIFIED",
    wishStatus: "UNVERIFIED",
    paymentRefCode: "KIND-ABC123",
    recipientMaskedVpa: "re***@okaxis",
    utrReference: "420011223344",
    resolutionNote: null,
    resolvedAt: null,
    createdAt: "2026-11-24T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedRestore.mockResolvedValue(makeUser());
  mockedStatus.mockResolvedValue({
    role: "ADMIN",
    mfaEnabled: false,
    mfaRequired: true,
    recoveryCodesRemaining: 0,
  });
  mockedReports.mockResolvedValue([]);
  mockedSupport.mockResolvedValue([]);
  mockedAppeals.mockResolvedValue([]);
  mockedDeletionRequests.mockResolvedValue([]);
  mockedDeadLetters.mockResolvedValue([]);
  mockedUsers.mockResolvedValue([]);
  mockedBadges.mockResolvedValue([]);
  mockedAudit.mockResolvedValue([]);
});

describe("AdminConsole", () => {
  it("opens the console without MFA when owner policy disables it", async () => {
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: false,
      mfaRequired: false,
      recoveryCodesRemaining: 0,
    });

    render(<AdminConsole />);

    expect(await screen.findByRole("heading", { name: /moderation queue/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /set up authenticator mfa/i }),
    ).not.toBeInTheDocument();
    expect(mockedReports).toHaveBeenCalledWith("mfa-not-required");
  });

  it("denies ordinary users without loading admin data", async () => {
    mockedRestore.mockResolvedValue(makeUser("USER"));

    render(<AdminConsole />);

    expect(
      await screen.findByRole("heading", { name: /admin access required/i }),
    ).toBeInTheDocument();
    expect(mockedStatus).not.toHaveBeenCalled();
    expect(mockedReports).not.toHaveBeenCalled();
  });

  it("enrolls an authenticator and opens the report queue", async () => {
    const user = userEvent.setup();
    mockedSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/Kindly:AdminUser?secret=JBSWY3DPEHPK3PXP",
    });
    mockedEnable.mockResolvedValue({
      mfaEnabled: true,
      mfaToken: "admin-mfa-token",
      expiresIn: 900,
      recoveryCodes: ["aaaa-bbbb", "cccc-dddd"],
    });
    mockedReports.mockResolvedValue([
      {
        id: "report-1",
        targetType: "WISH",
        targetId: "wish-1",
        reason: "HARASSMENT_ABUSE",
        status: "OPEN",
        uniqueReportCount: 3,
        targetDisplayName: "ReportedUser",
        targetPreview: "A reported wish preview",
        targetStatus: "UNDER_REVIEW",
        createdAt: "2026-11-24T00:00:00Z",
      },
    ]);

    render(<AdminConsole />);

    await user.click(await screen.findByRole("button", { name: /set up authenticator/i }));
    expect(await screen.findByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /enable mfa/i }));

    expect(await screen.findByText(/save your recovery codes/i)).toBeInTheDocument();
    expect(await screen.findByText(/reporteduser/i)).toBeInTheDocument();
    expect(screen.getByText(/3 unique reports/i)).toBeInTheDocument();
    expect(mockedEnable).toHaveBeenCalledWith("123456");
    expect(mockedReports).toHaveBeenCalledWith("admin-mfa-token");
    expect(mockedSupport).toHaveBeenCalledWith("admin-mfa-token");
  });

  it("verifies an existing authenticator before loading data", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: true,
      mfaRequired: true,
      recoveryCodesRemaining: 9,
    });
    mockedVerify.mockResolvedValue({
      mfaToken: "verified-token",
      expiresIn: 900,
      method: "TOTP",
    });

    render(<AdminConsole />);

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), "123456");
    await user.click(screen.getByRole("button", { name: /open admin console/i }));

    expect(await screen.findByRole("heading", { name: /moderation queue/i })).toBeInTheDocument();
    expect(mockedVerify).toHaveBeenCalledWith("123456");
    expect(mockedReports).toHaveBeenCalledWith("verified-token");
  });

  it("applies a wish moderation action with a mandatory reason", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: true,
      mfaRequired: true,
      recoveryCodesRemaining: 9,
    });
    mockedVerify.mockResolvedValue({
      mfaToken: "verified-token",
      expiresIn: 900,
      method: "TOTP",
    });
    mockedReports.mockResolvedValue([
      {
        id: "report-1",
        targetType: "WISH",
        targetId: "wish-1",
        reason: "INAPPROPRIATE_CONTENT",
        status: "OPEN",
        uniqueReportCount: 3,
        targetDisplayName: "ReportedUser",
        targetPreview: "A reported wish preview",
        targetStatus: "UNDER_REVIEW",
        createdAt: "2026-11-24T00:00:00Z",
      },
    ]);
    mockedModerateWish.mockResolvedValue({
      id: "action-1",
      targetType: "WISH",
      targetId: "wish-1",
      action: "HIDE",
      reason: "Clear policy violation.",
      moderatorDisplayName: "AdminUser",
      createdAt: "2026-11-24T00:00:00Z",
    });

    render(<AdminConsole />);

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), "123456");
    await user.click(screen.getByRole("button", { name: /open admin console/i }));
    await user.type(
      await screen.findByLabelText(/reason \(mandatory\)/i),
      "Clear policy violation.",
    );
    await user.click(screen.getByRole("button", { name: /apply action/i }));

    expect(await screen.findByText(/hide recorded with an audit entry/i)).toBeInTheDocument();
    expect(mockedModerateWish).toHaveBeenCalledWith("verified-token", "wish-1", {
      action: "HIDE",
      reason: "Clear policy violation.",
    });
  });

  it("promotes a user to admin from the Users tab", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: true,
      mfaRequired: true,
      recoveryCodesRemaining: 9,
    });
    mockedVerify.mockResolvedValue({
      mfaToken: "verified-token",
      expiresIn: 900,
      method: "TOTP",
    });
    mockedUsers.mockResolvedValue([
      {
        id: "user-2",
        displayName: "PromoteMe",
        role: "USER",
        status: "ACTIVE",
        createdAt: "2026-11-24T00:00:00Z",
      },
    ]);
    mockedUpdateRole.mockResolvedValue({
      id: "user-2",
      displayName: "PromoteMe",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: "2026-11-24T00:00:00Z",
    });

    render(<AdminConsole />);

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), "123456");
    await user.click(screen.getByRole("button", { name: /open admin console/i }));
    await user.click(await screen.findByRole("button", { name: /users \(1\)/i }));

    expect(await screen.findByText("PromoteMe")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/database role/i), "ADMIN");
    await user.type(screen.getByLabelText(/reason \(mandatory\)/i), "Owner approved.");
    await user.click(screen.getByRole("button", { name: /update role/i }));

    expect(await screen.findByText(/admin · active/i)).toBeInTheDocument();
    expect(mockedUpdateRole).toHaveBeenCalledWith(
      "verified-token",
      "user-2",
      "ADMIN",
      "Owner approved.",
    );
  });

  it("resolves an appeal from the admin queue", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: true,
      mfaRequired: true,
      recoveryCodesRemaining: 9,
    });
    mockedVerify.mockResolvedValue({
      mfaToken: "verified-token",
      expiresIn: 900,
      method: "TOTP",
    });
    mockedAppeals.mockResolvedValue([
      {
        id: "appeal-1",
        actionId: "action-1",
        userDisplayName: "RestrictedUser",
        action: "RESTRICT",
        actionReason: "Repeated spam.",
        targetType: "USER",
        targetId: "user-2",
        status: "OPEN",
        reason: "Please review my context.",
        resolutionNote: null,
        resolvedByDisplayName: null,
        createdAt: "2026-11-24T00:00:00Z",
        resolvedAt: null,
      },
    ]);
    mockedResolveAppeal.mockResolvedValue({
      id: "appeal-1",
      actionId: "action-1",
      userDisplayName: "RestrictedUser",
      action: "RESTRICT",
      actionReason: "Repeated spam.",
      targetType: "USER",
      targetId: "user-2",
      status: "ACCEPTED",
      reason: "Please review my context.",
      resolutionNote: "Context accepted.",
      resolvedByDisplayName: "AdminUser",
      createdAt: "2026-11-24T00:00:00Z",
      resolvedAt: "2026-11-24T01:00:00Z",
    });

    render(<AdminConsole />);

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), "123456");
    await user.click(screen.getByRole("button", { name: /open admin console/i }));
    await user.click(await screen.findByRole("button", { name: /appeals \(1\)/i }));

    expect(await screen.findByText(/please review my context/i)).toBeInTheDocument();
    expect(screen.getByText(/repeated spam/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/resolution note \(mandatory\)/i), "Context accepted.");
    await user.click(screen.getByRole("button", { name: /resolve appeal/i }));

    expect(await screen.findByText(/appeal accepted with an audit entry/i)).toBeInTheDocument();
    expect(mockedResolveAppeal).toHaveBeenCalledWith("verified-token", "appeal-1", {
      outcome: "ACCEPTED",
      resolutionNote: "Context accepted.",
    });
  });

  it("shows full support details and resolves with an audited note", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: true,
      mfaRequired: true,
      recoveryCodesRemaining: 9,
    });
    mockedVerify.mockResolvedValue({
      mfaToken: "verified-token",
      expiresIn: 900,
      method: "TOTP",
    });
    mockedSupport.mockResolvedValue([makeCase()]);
    mockedResolve.mockResolvedValue(
      makeCase({
        status: "RESOLVED",
        resolutionNote: "Handled by support.",
        resolvedAt: "2026-11-24T01:00:00Z",
      }),
    );

    render(<AdminConsole />);

    await user.type(await screen.findByLabelText(/authenticator or recovery code/i), "123456");
    await user.click(screen.getByRole("button", { name: /open admin console/i }));
    await user.click(await screen.findByRole("button", { name: /support cases/i }));

    expect(await screen.findByText(/i paid after the timer ended/i)).toBeInTheDocument();
    expect(screen.getByText(/re\*\*\*@okaxis/i)).toBeInTheDocument();
    expect(screen.getByText(/420011223344/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/resolution note/i), "Handled by support.");
    await user.click(screen.getByRole("button", { name: /resolve case/i }));

    expect(await screen.findByText(/resolution: handled by support/i)).toBeInTheDocument();
    expect(mockedResolve).toHaveBeenCalledWith("verified-token", "case-1", "Handled by support.");
  });
});
