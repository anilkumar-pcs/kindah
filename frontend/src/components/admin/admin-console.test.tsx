import { render, screen, within } from "@testing-library/react";
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
  listAdminAppealsPage: vi.fn(),
  listAdminAuditLogs: vi.fn(),
  listAdminAuditLogsPage: vi.fn(),
  listAdminBadges: vi.fn(),
  listAdminDeletionRequests: vi.fn(),
  listAdminDeletionRequestsPage: vi.fn(),
  listAdminOutboxDeadLetters: vi.fn(),
  listAdminOutboxDeadLettersPage: vi.fn(),
  listAdminReports: vi.fn(),
  listAdminSupportCases: vi.fn(),
  listAdminSupportCasesPage: vi.fn(),
  listAdminUsersPage: vi.fn(),
  listAdminWishes: vi.fn(),
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
  listAdminAppealsPage,
  listAdminAuditLogs,
  listAdminAuditLogsPage,
  listAdminBadges,
  listAdminDeletionRequests,
  listAdminDeletionRequestsPage,
  listAdminOutboxDeadLetters,
  listAdminOutboxDeadLettersPage,
  listAdminReports,
  listAdminSupportCases,
  listAdminSupportCasesPage,
  listAdminUsersPage,
  listAdminWishes,
  moderateWish,
  resolveAppeal,
  resolveSupportCase,
  setupAdminMfa,
  updateUserRole,
  verifyAdminMfa,
  type AdminAppeal,
  type AdminAuditLog,
  type AdminDeletionRequest,
  type AdminSupportCase,
  type OutboxDeadLetter,
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
const mockedSupportPage = vi.mocked(listAdminSupportCasesPage);
const mockedAudit = vi.mocked(listAdminAuditLogs);
const mockedAuditPage = vi.mocked(listAdminAuditLogsPage);
const mockedResolve = vi.mocked(resolveSupportCase);
const mockedModerateWish = vi.mocked(moderateWish);
const mockedAppeals = vi.mocked(listAdminAppeals);
const mockedAppealsPage = vi.mocked(listAdminAppealsPage);
const mockedDeletionRequests = vi.mocked(listAdminDeletionRequests);
const mockedDeletionPage = vi.mocked(listAdminDeletionRequestsPage);
const mockedDeadLetters = vi.mocked(listAdminOutboxDeadLetters);
const mockedDeadLettersPage = vi.mocked(listAdminOutboxDeadLettersPage);
const mockedUserPage = vi.mocked(listAdminUsersPage);
const mockedWishes = vi.mocked(listAdminWishes);
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
  mockedSupportPage.mockResolvedValue({ cases: [], total: 0, page: 1, pageSize: 10 });
  mockedAppeals.mockResolvedValue([]);
  mockedAppealsPage.mockResolvedValue({ appeals: [], total: 0, page: 1, pageSize: 10 });
  mockedDeletionRequests.mockResolvedValue([]);
  mockedDeletionPage.mockResolvedValue({ requests: [], total: 0, page: 1, pageSize: 10 });
  mockedDeadLetters.mockResolvedValue([]);
  mockedDeadLettersPage.mockResolvedValue({
    deadLetters: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  mockedUserPage.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 10 });
  mockedWishes.mockResolvedValue({ wishes: [], total: 0, page: 1, pageSize: 10 });
  mockedBadges.mockResolvedValue([]);
  mockedAudit.mockResolvedValue([]);
  mockedAuditPage.mockResolvedValue({ logs: [], total: 0, page: 1, pageSize: 10 });
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
    mockedUserPage.mockResolvedValue({
      users: [
        {
          id: "user-2",
          displayName: "PromoteMe",
          role: "USER",
          status: "ACTIVE",
          createdAt: "2026-11-24T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
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
    await user.click(await screen.findByRole("button", { name: /^users$/i }));

    const usersTable = await screen.findByRole("table");
    expect(within(usersTable).getByText("PromoteMe")).toBeInTheDocument();
    await user.click(within(usersTable).getByRole("button", { name: /manage promoteme/i }));
    await user.selectOptions(screen.getByLabelText(/database role/i), "ADMIN");
    await user.type(screen.getByLabelText(/reason \(mandatory\)/i), "Owner approved.");
    await user.click(screen.getByRole("button", { name: /update role/i }));

    expect(await screen.findByText(/role updated with an audit entry/i)).toBeInTheDocument();
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
    const appeal: AdminAppeal = {
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
    };
    mockedAppeals.mockResolvedValue([appeal]);
    mockedAppealsPage.mockResolvedValue({
      appeals: [appeal],
      total: 1,
      page: 1,
      pageSize: 10,
    });
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
    const appealTable = await screen.findByRole("table");
    await user.click(within(appealTable).getByRole("button", { name: /open restricteduser/i }));
    const appealDialog = screen.getByRole("dialog");

    expect(await within(appealDialog).findByText(/please review my context/i)).toBeInTheDocument();
    expect(within(appealDialog).getByText(/repeated spam/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/resolution note \(mandatory\)/i), "Context accepted.");
    await user.click(screen.getByRole("button", { name: /resolve appeal/i }));

    expect(await screen.findByText(/appeal accepted with an audit entry/i)).toBeInTheDocument();
    expect(mockedResolveAppeal).toHaveBeenCalledWith("verified-token", "appeal-1", {
      outcome: "ACCEPTED",
      resolutionNote: "Context accepted.",
    });
  });

  it("filters the support queue by case status", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: false,
      mfaRequired: false,
      recoveryCodesRemaining: 0,
    });
    const resolvedCase = makeCase({ status: "RESOLVED" });
    mockedSupport.mockResolvedValue([resolvedCase]);
    mockedSupportPage.mockImplementation(async (_token, params) => {
      const cases = params?.status === "OPEN" ? [] : [resolvedCase];
      return { cases, total: cases.length, page: 1, pageSize: 10 };
    });

    render(<AdminConsole />);

    await user.click(await screen.findByRole("button", { name: /support cases \(1\)/i }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText(/i paid after the timer ended/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/case status/i), "OPEN");

    expect(await screen.findByText("No support cases match.")).toBeInTheDocument();
  });

  it("renders deletion, outbox and audit queues as tables", async () => {
    const user = userEvent.setup();
    mockedStatus.mockResolvedValue({
      role: "ADMIN",
      mfaEnabled: false,
      mfaRequired: false,
      recoveryCodesRemaining: 0,
    });
    const deletionRequest: AdminDeletionRequest = {
      id: "deletion-1",
      userDisplayName: "DeleteMe",
      userStatus: "DELETION_PENDING",
      status: "REQUESTED",
      reason: "Taking a break.",
      requestedAt: "2026-11-24T00:00:00Z",
      cancelledAt: null,
    };
    const deadLetter: OutboxDeadLetter = {
      id: "outbox-1",
      aggregateType: "GIFT",
      aggregateId: "11111111-1111-1111-1111-111111111111",
      eventType: "GIFT_CONFIRMED",
      payload: {},
      attempts: 3,
      deadLetterReason: "timeout",
      createdAt: "2026-11-24T00:00:00Z",
    };
    const auditLog: AdminAuditLog = {
      id: "audit-1",
      actorDisplayName: "AdminUser",
      action: "USER_ROLE_CHANGED",
      targetType: "USER",
      targetId: "22222222-2222-2222-2222-222222222222",
      reason: "Owner approved.",
      requestId: "req-1",
      metadata: {},
      createdAt: "2026-11-24T00:00:00Z",
    };
    mockedDeletionRequests.mockResolvedValue([deletionRequest]);
    mockedDeletionPage.mockResolvedValue({
      requests: [deletionRequest],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    mockedDeadLetters.mockResolvedValue([deadLetter]);
    mockedDeadLettersPage.mockResolvedValue({
      deadLetters: [deadLetter],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    mockedAudit.mockResolvedValue([auditLog]);
    mockedAuditPage.mockResolvedValue({
      logs: [auditLog],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    render(<AdminConsole />);

    await user.click(await screen.findByRole("button", { name: /deletion \(1\)/i }));
    const deletionTable = await screen.findByRole("table");
    expect(within(deletionTable).getByText("DeleteMe")).toBeInTheDocument();
    await user.click(within(deletionTable).getByRole("button", { name: /open deleteme/i }));
    expect(screen.getByText(/this queue records requests only/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close details/i }));

    await user.click(screen.getByRole("button", { name: /outbox \(1\)/i }));
    const outboxTable = await screen.findByRole("table");
    expect(within(outboxTable).getByText("GIFT_CONFIRMED")).toBeInTheDocument();
    await user.click(within(outboxTable).getByRole("button", { name: /open gift_confirmed/i }));
    expect(screen.getByText("timeout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close details/i }));

    await user.click(screen.getByRole("button", { name: /audit log \(1\)/i }));
    const auditTable = await screen.findByRole("table");
    expect(within(auditTable).getByText("USER_ROLE_CHANGED")).toBeInTheDocument();
    await user.click(within(auditTable).getByRole("button", { name: /open user_role_changed/i }));
    expect(screen.getByText("Owner approved.")).toBeInTheDocument();
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
    const supportCase = makeCase();
    mockedSupport.mockResolvedValue([supportCase]);
    mockedSupportPage.mockResolvedValue({
      cases: [supportCase],
      total: 1,
      page: 1,
      pageSize: 10,
    });
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
    const supportTable = await screen.findByRole("table");
    await user.click(within(supportTable).getByRole("button", { name: /open late payment/i }));
    const supportDialog = screen.getByRole("dialog");

    expect(
      await within(supportDialog).findByText(/i paid after the timer ended/i),
    ).toBeInTheDocument();
    expect(within(supportDialog).getByText(/re\*\*\*@okaxis/i)).toBeInTheDocument();
    expect(within(supportDialog).getByText(/420011223344/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/resolution note/i), "Handled by support.");
    await user.click(screen.getByRole("button", { name: /resolve case/i }));

    expect(await screen.findByText(/resolution: handled by support/i)).toBeInTheDocument();
    expect(mockedResolve).toHaveBeenCalledWith("verified-token", "case-1", "Handled by support.");
  });
});
