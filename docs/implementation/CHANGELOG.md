# Changelog — Chillar / Kindly

Meaningful implementation milestones, migrations, API contract changes and deviations from the specification. Newest first.

## 2026-11-24 — Phase 6 complete: durable outbox and operations runbooks

### Added

- `app/workers/outbox_dispatcher.py`: `FOR UPDATE SKIP LOCKED` claiming, per-event attempt
  isolation, exponential backoff, attempt cap, dead-letter alert hook and idempotent success.
- MFA-protected `/admin/outbox/dead-letters` and admin console Outbox tab.
- `RUNBOOK_OPERATIONS.md` covering disputes, late payment, OTP outage, VPA change, moderation
  escalation, deletion, outbox, restore and privacy/security incidents.
- Critical payment/dispute path exercised against a separate `kindah_staging_exercise` database,
  including admin MFA resolution, audit and notifications.

### Verification

- 168 backend tests and 50 frontend tests pass; all lint, format, type and build checks clean.
- Outbox success/idempotency, retry/dead-letter, concurrent skip-locked claiming and admin
  visibility are covered.
- Staging exercise output recorded in `TEST_EVIDENCE.md` VE-039.

### Status

- Phase 6 is `DONE` (11/11). Deployed staging/RPO/RTO, retention, provider/legal and MFA/cooldown
  decisions remain external or pending owner confirmation.

## 2026-11-24 — Phase 6: in-app notifications

### Added

- `0012_notifications` migration with user/type/title/body/entity/payload/dedupe/read state.
- `notify()` helper using `ON CONFLICT DO NOTHING` for per-user deduplication.
- Notifications for gift claimed, confirmed, disputed and unverified; wish under-review,
  restored, removed and expired; account moderation; appeal resolution; support resolution.
- `/me/notifications`, mark-one-read and read-all APIs with own-user filtering.
- `/notifications` inbox UI with unread count, entity links and read actions; My Space and
  sign-in links.

### Verification

- 164 backend tests and 50 frontend tests pass; all lint, format, type and build checks clean.
- Deduplication, read state, worker events and payload safety are covered.

### Open

- P6.10 durable outbox and P6.11 runbooks.

## 2026-11-24 — Phase 6: non-destructive account deletion requests

### Added

- `0011_account_deletion_requests` migration with one request per user, encrypted optional
  reason, request/cancel timestamps and status index.
- `/me/deletion-request` GET/POST/DELETE; requests are blocked while the user has an active
  wish or unresolved gift, set `DELETION_PENDING`, can be cancelled, and never delete data.
- MFA-protected `/admin/deletion-requests` queue and admin console tab.
- `/account-deletion` UI and My Space link explaining retention and non-destruction.

### Verification

- 161 backend tests and 47 frontend tests pass; all lint, format, type and build checks clean.
- Active-wish/gift guards, idempotent request, cancellation, encryption, admin visibility and
  record preservation are covered.

### Limitation

- Actual anonymisation/deletion remains blocked on the external DEC-O8 retention decision.

### Open

- P6.9 notifications, P6.10 durable outbox, P6.11 runbooks.

## 2026-11-24 — Phase 6: moderation appeals and dispute visibility

### Added

- `0010_moderation_appeals` migration with one appeal per action, encrypted appeal/resolution
  text, resolver and timestamps.
- User APIs: list own moderation actions/reasons, submit one appeal for RESTRICT/SUSPEND/BAN,
  list own appeals. `/appeals` page works for restricted, suspended and banned users.
- Admin APIs and console tab: appeal queue with original action context, ACCEPTED/REJECTED
  resolution with mandatory note and admin audit entries.
- Banned accounts may authenticate for own-profile/appeal reads; interactive actions remain
  blocked by `require_active_auth`.
- Dispute/support data remains visible only through MFA-protected admin endpoints.

### Verification

- 159 backend tests and 43 frontend tests pass; all lint, format, type and build checks clean.
- Appeal lifecycle, duplicate rejection, non-admin denial, resolution audit and banned access
  are covered.

### Open

- P6.8 deletion workflow (retention decision remains external).

## 2026-11-24 — Phase 6: moderation actions and state guards

### Added

- `0009_moderation_actions` migration with moderator, target, action, encrypted reason and
  timestamp records.
- `POST /admin/users/{id}/actions`: WARN, RESTRICT, SUSPEND, BAN and REACTIVATE with
  self-moderation/privileged-target guards, trust-strike increment and account-status changes.
- `POST /admin/wishes/{id}/actions`: HIDE, RESTORE and REMOVE with guards for expired wishes
  and unresolved gifts; REMOVE applies no cooldown per the provisional DEC-O7 default.
- Admin report queue action form with mandatory reason, success/error feedback and audit refresh.
- Moderator/admin audit entries for every action, with encrypted reasons and request IDs.

### Verification

- 158 backend tests and 39 frontend tests pass; all lint, format, type and build checks clean.
- Browser hide→UNDER_REVIEW and restore→OPEN actions passed with audit entries.

### Decision

- `DEC-O7` no-cooldown moderation removal is implemented as the recommended default but
  remains **pending owner confirmation**.

### Open

- P6.7 appeals/support disputes and P6.8 deletion workflow.

## 2026-11-24 — Phase 6: protected admin console, RBAC, MFA and audit

### Added

- `0008_admin_rbac_mfa` migration: `user_role`, encrypted TOTP secret, MFA enabled/last-step
  fields, hashed recovery codes, and append-only `admin_audit_logs` with an update/delete trigger.
- `USER`/`MODERATOR`/`ADMIN` RBAC with `ADMIN_USER_IDS` retained only as a local/test bootstrap.
- TOTP setup/enable/verify endpoints with per-step replay rejection, ten single-use recovery
  codes and a 15-minute session-bound `X-Admin-MFA` token.
- Protected `/admin` console with MFA enrollment/verification, report queue, full support-case
  detail, audited resolution and audit-log view.
- Admin audit entries for MFA enrollment, recovery-code use and support resolution, including
  request IDs and encrypted resolution reasons.
- Admin MFA CORS header allowance and regression test.

### Verification

- 156 backend tests and 38 frontend tests pass; all lint, format, type and build checks clean.
- Full browser admin flow passed, including TOTP enrollment and audited support resolution.

### Decision

- `DEC-I13` TOTP + recovery codes is implemented as the recommended default but remains
  **pending owner confirmation**; production admin activation stays blocked.

### Open

- P6.6 moderation actions and wish restore/remove.

## 2026-11-24 — Phase 6: auto-hide and moderator report queue

### Added

- Atomic auto-hide: the third unique wish report moves an active OPEN wish to UNDER_REVIEW
  under a wish row lock. Duplicate reports do not count and the hide audit is written once.
- `GET /api/v1/admin/reports` queue with status filter, target display name, public message
  preview, target status and unique report count; reporter identity and private data are
  excluded.
- `AUTO_HIDE_REPORT_THRESHOLD=3` configuration and documentation.

### Verification

- 153 backend tests pass; Ruff, format and mypy clean.
- Tests cover duplicate-non-counting, exact threshold, once-only audit, feed/detail exclusion
  and non-admin 403 on the queue.

### Open

- Protected admin UI/RBAC/MFA (P6.4–P6.5), moderation actions and restore (P6.6).

## 2026-11-24 — Phase 6: reporting, rate limits and blocking

### Added

- `0007_moderation_reports` migration with the seven spec report reasons, target type,
  report status, unique reporter/target constraint and queue/reporter indexes.
- `POST /wishes/{id}/reports` and `POST /users/{id}/reports` with duplicate replay,
  hourly per-reporter rate limiting under a row lock, private responses and redacted audit.
- `POST`/`DELETE /users/{id}/block`, wish-scoped `block-owner` aliases and `GET /me/blocks`.
- Wish-detail report/block UI with the no-proof-of-wrongdoing copy; My Space blocked-accounts
  list with unblock.

### Verification

- 152 backend tests and 34 frontend tests pass; all lint, format, type and build checks clean.
- Browser journey reported and blocked a wish owner, then unblocked from My Space.
- Two-way discovery, detail, selection, gifting and reporting exclusion tests pass.

### Open

- P6.3 auto-hide/review queue and the protected admin area (P6.4–P6.5).

## 2026-11-24 — Phase 5 complete: donor/recipient gift UI

### Added

- `/gifts/new/[wishId]`: whole-rupee amount selection (₹10–₹100), cheer note, review with
  no-custody/bank-name disclosures, UPI handoff with QR/link, UTR capture and donor
  PAID/STILL_PROCESSING/FAILED attestations.
- `/gifts/[id]`: participant-safe gift detail, recipient RECEIVED/NOT_RECEIVED confirmation,
  reaction and thank-you note, 24-hour response deadline, terminal-state explanations and a
  “Report a problem” support form wired to the participant support-case API.
- My Space gift history with role-aware descriptions and approved status labels.
- Wish selection now leads into the gift flow.
- `viewerRole` and `recipientResponseDeadline` in the gift API response so clients render
  donor/recipient controls and the correct deadline without inferring from private fields.
- `qrcode.react` dependency for the UPI QR handoff.

### Verification

- 31 frontend tests pass; ESLint, Prettier, TypeScript and production build clean.
- Full-stack browser flow: donor created/paid a ₹25 handoff; recipient confirmed with a
  reaction and note; both histories linked correctly; support case opened from the UI.
- 149 backend tests remain green after the response-contract additions.

### Status

- Phase 5 is **DONE** (15/15). Real-money UPI handoff remains disabled pending external
  legal and bank/payment-partner gates.

## 2026-11-24 — Phase 5: late-payment support, admin resolution and race tests

### Added

- `0006_support_cases` migration: `support_case_type`/`support_case_status` enums and a
  `support_cases` table with encrypted description/resolution text, participant and resolver
  foreign keys, and a partial unique index preventing duplicate open cases.
- `POST /api/v1/gifts/{gift_id}/support-cases` for authenticated gift participants to report
  late payment, donor claims, recipient disputes or other issues.
- `GET /api/v1/admin/support-cases` and `POST /api/v1/admin/support-cases/{case_id}/resolve`
  with `ADMIN_USER_IDS` allow-list authorization, full case/gift visibility, encrypted
  resolution notes and redacted audit events.
- `RUNBOOK_LATE_PAYMENT.md` documenting the support-only late-payment policy, admin
  procedure, data handling and the no-refund/no-reassignment position.
- True simultaneous race tests for PAID-vs-reservation-expiry and
  recipient-confirmation-vs-timeout, asserting a single consistent terminal outcome.

### Verification

- 149 backend tests pass; Ruff, format and mypy clean.
- Migration `0006_support_cases` applied successfully.
- Support tests cover participant creation, duplicate prevention, non-participant and
  non-admin denial, admin visibility, VPA/UPI redaction, resolution, double-resolution
  rejection and audit redaction.

### Open

- P5.14 donor/recipient gift UI.
- Phase 5 remains **IN_PROGRESS** until P5.14 is complete.

## 2026-11-24 — Phase 5 in progress: gift, reservation and UPI handoff backend

### Added

- `0005_gifts` migration: `gift_status`/`reservation_status` enums, `gifts`, `wish_reservations` (one ACTIVE reservation per wish), `gift_events`, `karma_events`, `idempotency_records` and `outbox_events`.
- `PaymentHandoffProvider` interface and deterministic test adapter that builds a UPI URI/QR payload from server-owned data; production rejects the test adapter.
- Atomic `POST /api/v1/gifts` with wish row lock, eligibility checks, unresolved-claim cap, idempotency replay/conflict, encrypted handoff payload, ACTIVE reservation, wish LOCKED, gift events and outbox.
- Donor outcomes PAID / STILL_PROCESSING / FAILED with state guards; PAID consumes the reservation and moves the wish to PAYMENT_CLAIMED; FAILED releases/reopens or expires; one extension maximum.
- Recipient RECEIVED/NOT_RECEIVED confirmation, participant authorization, 24h deadline, terminal GRANTED/DISPUTED/UNVERIFIED and no reopening after a paid claim.
- Karma ledger on recipient confirmation (first/subsequent gift, first-time recipient bonus, thanks, pay-it-forward) with unique idempotency keys.
- Participant-only gift detail and `/me/gifts` history.
- Reservation-expiry and unverified-timeout workers; approved defaults recorded for `DEC-O2`, `DEC-A02`–`DEC-A04`.

### Verification

- 145 backend tests pass; Ruff, format and mypy clean.
- 12 gift tests cover concurrent donors (one success), idempotency, PAID/FAILED/STILL_PROCESSING, recipient confirmation and karma-once, disputes, expiry and timeout workers.
- Gift migration applies successfully.

### Open

- P5.10 late-payment/old-URI support path.
- P5.13 true simultaneous PAID-vs-expiry and confirmation-vs-timeout race tests.
- P5.14 donor/recipient gift UI.
- Phase 5 is **IN_PROGRESS**, not DONE.

## 2026-11-24 — Phase 4 complete: public discovery and selection

### Added

- `0004_discovery` migration: `user_blocks` table and a `wishes(status, created_at)` feed index.
- Public read-only feed with stable cursor pagination, Fresh ordering and deterministic seeded Random ordering.
- Optional city filter.
- Exclusions for own, expired, locked, removed, under-review, blocked, inactive-recipient and no-active-payment-method wishes.
- Public-safe wish DTO (`id`, pseudonym, avatar, city, timestamp, mood, message, suggested amount) with no phone/VPA/UTR/payment/moderation data.
- Public wish detail and authenticated `POST /wishes/{id}/select` gate; guests receive 401.
- Frontend discovery feed with Fresh/Random tabs, city filter, loading/empty/error states, cursor “Load more”, responsive cards and accessible labels.
- Frontend wish detail with selection success, 409/404 handling and a guest sign-in prompt.

### Fixed

- Removed Next.js URL-data prerendering conflicts from the sign-in and wish-detail routes by using `/reauth` and client-side `useParams`.
- Feed results are isolated in a keyed child component so filter changes remount cleanly without synchronous state resets in an effect.

### Verification

- 133 backend tests pass; Ruff, format and mypy clean.
- 21 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser: guest sees an open wish, opens detail, and is prompted to sign in when selecting; no console errors.
- Discovery migration and fresh-clone validation pass.

## 2026-11-24 — Phase 3 complete: payment method and wish lifecycle

### Added

- `0003_payment_wishes` migration: payment-method and wish enums/tables, one-active-wish partial unique index, and `users.last_authenticated_at` for re-authentication freshness.
- VPA syntax validation with explicit `SYNTAX_ONLY` status; no ownership claim.
- VPA encryption through `CryptoProvider`, keyed HMAC duplicate detection, masked UI/API representation and versioning with privacy acknowledgement.
- Re-authentication window for VPA changes; forced `/reauth` OTP path when the session is older than the window.
- Wish creation with 10–120-character message validation, URL/phone/VPA/HTML/UPI filters, mood enum, optional whole-INR ₹10–₹100 amount, optional city and onboarding/payment-method prerequisites.
- One active wish per user enforced by a partial unique index; 24-hour expiry; 72-hour cooldown after withdrawal/expiry.
- Withdrawal endpoint and idempotent wish-expiry worker (`python -m app.workers.wish_expiry`).
- My Space frontend: masked UPI setup, privacy disclosure, wish preview/publish, active-wish display, withdrawal, cooldown and history.

### Fixed

- Chat-style sign-in now supports forced re-authentication through `/reauth` without depending on URL search params, avoiding a Next.js cache-components warning.
- Cooldown rendering no longer calls impure time functions during render.

### Verification

- 126 backend tests pass; Ruff, format and mypy clean.
- 15 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser: masked VPA save → wish publish → withdraw → cooldown, plus forced re-auth, all succeed.
- Payment/wish migration upgrade → downgrade → upgrade passes on an isolated database.
- Wish-expiry worker runs and reports `expired_count`.

### Blocked

- Production KMS and VPA beneficiary validation are unresolved. Production receiving remains `BLOCKED`; local AES-GCM and syntax-only validation are used.

## 2026-11-24 — Phase 2 complete: identity, sessions and profile

### Added

- `0002_identity` migration: `user_status` enum, `users`, `user_sessions`, `otp_challenges` and `auth_events` with constraints and indexes.
- OTP request/verify service with Indian mobile normalization, keyed HMAC lookup, encrypted mobile storage, masked display, per-phone/IP rate limits, resend throttle, attempt limits and expiry.
- `SmsProvider` interface and deterministic test adapter; production rejects the test adapter at startup.
- Session lifecycle: 15-minute JWT access token, rotating opaque refresh token hashed in PostgreSQL, reuse detection with family revocation, logout, expiry checks and account-status enforcement.
- Double-submit CSRF protection for refresh/logout; access token held in memory only.
- Consent endpoint recording 18+, draft Terms, Privacy and Guidelines acceptance with policy version.
- Pseudonymous profile: validated unique display name, preset avatar, optional city, onboarding state, public-safe `/me` DTO.
- Audit events for OTP, account, session, consent and profile changes without phone/OTP contents.
- Frontend sign-in flow: OTP request/verify, consent, profile setup, session restore, logout, loading/error states and accessible forms.
- API client bearer-token support, refresh-and-retry, and CSRF header handling.

### Fixed

- Added `X-CSRF-Token` to the CORS allow-list. Browser validation caught that refresh preflight was blocked; a regression test now covers it.
- Session restore no longer makes a guaranteed 401 request when no CSRF cookie exists.
- Development/test signing secrets were lengthened past the 32-character minimum; configuration rejects shorter keys.

### Verification

- 78 backend tests pass; Ruff, format and mypy clean.
- 11 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser flow: OTP → consent → profile → signed-in; page reload restores session with no console errors.
- Identity migration upgrade → downgrade → upgrade passes on an isolated database.

### Blocked

- Production OTP/SMS provider is not selected. Production auth remains `BLOCKED`; development/test use the deterministic adapter.

## 2026-11-23 — Phase 1 complete: foundation and runnable skeleton

### Added

- FastAPI application factory with typed settings, request IDs, security headers, CORS allow-list, structured JSON logs and deny-by-default PII/secret redaction.
- `GET /healthz`, `GET /readyz` (PostgreSQL required; Redis optional/degraded) and `GET /api/v1/meta`; RFC 9457 `problem+json` error handling with spec-style machine codes.
- SQLAlchemy 2 engine/session lifecycle, psycopg 3, Alembic baseline migration and real-PostgreSQL integration tests.
- Optional Redis health probe that never affects API availability.
- Next.js 16 App Router shell with responsive landing, wish-detail and sign-in placeholders, error/loading/not-found states, PWA manifest, typed API client and service-status check.
- Vitest/Testing Library tests for the API client and health component.
- Root `.env.example`, local env documentation, `.gitignore`, `.editorconfig`, Makefile, README and GitHub Actions CI.
- Phase 1 evidence records VE-007–VE-015.

### Fixed

- Frontend type-checking no longer depends on Next.js generated `LayoutProps` types that do not exist before a build (commit `2991941`), so a fresh clone can run `tsc` before `next build`.

### Verification

- Backend: 27 pytest tests pass; Ruff, format check and mypy pass.
- Frontend: ESLint, Prettier, TypeScript, 6 Vitest tests and production build pass.
- Alembic upgrade → downgrade → upgrade verified.
- Full-stack browser check: page 200, backend meta fetch 200, no console errors, responsive desktop/mobile layouts.
- Fresh clone: `make setup`, `make migrate`, `make check` and `npm run build` pass.
- CI workflow validated with `actionlint`; remote execution is pending a GitHub remote.

## 2026-11-23 — Phase 0 approved; Phase 1 started

### Approved

- Owner approved the Phase 1 scope and authorised sequential phase execution with validation between phases.
- Phase 0 P0.10 is `DONE`; Phase 0 is `DONE`.
- Phase 1 tooling/default decisions approved: `DEC-I01`, `DEC-I02`, `DEC-I03`, `DEC-I04`, `DEC-I11`, `DEC-I12`, `DEC-I14`, `DEC-I17`, `DEC-A05`.

### Environment

- Installed `uv` 0.13.9 and Python 3.12.16.
- Installed and started PostgreSQL 16.16 and Redis 8.12.0 via Homebrew.
- Created `kindah_dev` and `kindah_test` PostgreSQL databases.

## 2026-11-23 — Phase 0: Repository assessment and planning

### Added

- `docs/implementation/REPOSITORY_ASSESSMENT.md` — current-state inventory, toolchain findings, gap analysis against the v1.1 specification, technical risks, preservation decisions and Phase 1 readiness.
- `docs/implementation/ARCHITECTURE.md` — proposed modular-monolith boundaries, target repository layout, data architecture, critical gift/UPI flows, security/privacy controls, testing strategy and deployment topology.
- `docs/implementation/IMPLEMENTATION_BACKLOG.md` — repository-specific task breakdown for Phases 1–8, dependencies, acceptance criteria and the proposed Phase 1 scope.
- `docs/implementation/DECISIONS.md` — populated decision log: open specification decisions (`DEC-O*`), proposed implementation decisions (`DEC-I*`) and specification/plan ambiguities (`DEC-A*`).

### Changed

- Renamed `docs/implmentation/` to `docs/implementation/` to match `CLAUDE.md`, the implementation plan and the status file. Content-preserving; original docs backed up to `/tmp/kindah-docs-backup-20261123-223328`.
- Updated `docs/implementation/IMPLEMENTATION_STATUS.md` with the Phase 0 dashboard, task detail, blockers and next-session handoff.
- Updated `docs/implementation/TEST_EVIDENCE.md` with Phase 0 inspection records.
- Updated Phase 0 task checkboxes P0.1–P0.9 in `docs/implementation/IMPLEMENTATION_PLAN.md`; P0.10 remains open pending owner approval.

### Not changed

- No application source code, dependencies, package manifests, database schema, migrations, API contracts, CI, containers or feature flags were created.
- No existing document content was overwritten; placeholders were populated and the plan's checkboxes updated per its own tracking rules.
- No product or legal decision was approved. All decision-log entries remain `PENDING` or `EXTERNAL_BLOCKED`.

### Findings requiring owner attention

- Repository is greenfield and is **not** a git repository.
- Local machine lacks Python 3.12+, PostgreSQL, Redis and Docker; Homebrew, Node 26 and npm are available.
- Specification/plan ambiguities recorded: Surprise Me/Random scope (`DEC-A01`), UPI URI generation vs persistence (`DEC-A02`), wish eligibility after PAID (`DEC-A03`), `DONOR_PENDING` timeout (`DEC-A04`), visual design direction (`DEC-A05`).

### Evidence

- `TEST_EVIDENCE.md` VE-001 through VE-006.
- No automated tests exist or were run; this is recorded as `N/A`, not as a pass.
