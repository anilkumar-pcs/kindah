# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 8 — Hardening, launch readiness and Bengaluru beta
**Overall status:** `BLOCKED` — external launch/legal/provider gates and owner decisions required
**Repository state:** Phases 0–7 complete. Phase 8 is in progress: threat model/scans, local restore drill, load smoke and accessibility audits are recorded; deployment, monitoring, beta assumptions and legal/provider gates are external.

## Phase dashboard

| Phase | Status | Tasks done | Tasks total | Evidence / blocker |
|---|---|---:|---:|---|
| 0. Repository discovery | `DONE` | 10 | 10 | Owner approved Phase 1 scope |
| 1. Foundation | `DONE` | 10 | 10 | 27 backend + 6 frontend tests |
| 2. Identity | `DONE` | 9 | 9 | 78 backend + 11 frontend tests |
| 3. Recipient & wishes | `DONE` | 10 | 10 | 126 backend + 15 frontend tests |
| 4. Discovery | `DONE` | 7 | 7 | 133 backend + 21 frontend tests |
| 5. Gift & UPI | `DONE` | 15 | 15 | 149 backend + 31 frontend tests; full-stack gift flow and support report verified |
| 6. Trust & safety | `DONE` | 11 | 11 | 168 backend + 50 frontend tests; local staging payment/dispute exercise |
| 7. Engagement | `DONE` | 8 | 8 | 176 backend + 54 frontend tests; badge definitions DB-configurable |
| 8. Hardening & beta | `IN_PROGRESS` | 2 | 12 | Threat model/scans done; local restore/load/a11y checks recorded; launch gates blocked |

## Phase 5 progress

Completed:
- P5.1 canonical state machines.
- P5.2 reservation table, constraints and one-ACTIVE partial unique index.
- P5.3 `POST /gifts` with auth, amount validation, row lock and idempotency.
- P5.4 atomic gift/reservation/wish/event/outbox persistence.
- P5.5 test UPI handoff provider and default-off real-money flag.
- P5.6 donor outcomes with state guards.
- P5.7 one extension and reservation-expiry worker.
- P5.8 recipient confirmation and 24h deadline.
- P5.9 terminal UNVERIFIED/DISPUTED, no reopening after PAID.
- P5.10 late-payment support cases, admin visibility/resolve endpoints, audit redaction and `RUNBOOK_LATE_PAYMENT.md`.
- P5.11 participant gift history.
- P5.12 idempotent karma ledger.
- P5.13 true simultaneous PAID-vs-expiry and confirmation-vs-timeout race tests, plus concurrent donors, idempotency and re-reservation coverage.
- P5.14 donor amount/review/handoff/outcome flow, recipient confirmation, gift history, status labels, deadline display, support entry point and participant-safe role rendering.
- P5.15 real-money handoff remains disabled.

Open:
- None. Phase 5 is `DONE`; its mandatory concurrency and UI gates passed.

Approved decisions: `DEC-O2` (10m + 20m max, 24h), `DEC-A02` (encrypt handoff, expose after commit), `DEC-A03` (literal spec post-PAID wish), `DEC-A04` (DONOR_PENDING expires, never reopens), `DEC-O5` (late payment support-only; no refund/reassignment/reopening), `DEC-A06` (admin visibility and audited resolution).

## Phase 6 progress

Completed:
- P6.1 wish and user reporting with the seven spec reasons, one-report-per-reporter/target uniqueness, DB-backed hourly rate limiting, private responses and redacted audit events.
- P6.2 block/unblock APIs plus wish-scoped block-owner aliases; two-way discovery/detail/select/gift/report exclusion; My Space blocked-account list with unblock; report/block UI on wish detail.
- P6.3 atomic auto-hide on the third unique wish report (OPEN→UNDER_REVIEW only, once), moderator-only `/admin/reports` queue with target previews and unique report counts, and feed/detail exclusion under review.
- P6.4 protected Next.js `/admin` console with role gating, MFA setup/verify, report queue, support detail/resolution and audit view; loading, empty, denied and error states.
- P6.5 `USER`/`MODERATOR`/`ADMIN` database roles as the sole admin authority; owner override (DEC-I13) disables required MFA, while TOTP/recovery-code code remains optional. Admin user search/role management (self-change guarded, audited) and append-only `admin_audit_logs` with request IDs and encrypted resolution notes. Bootstrap CLI: `backend/scripts/grant_role.py`. `AnilKumar` is the bootstrapped local DB admin.
- P6.6 warning, restrict, suspend, ban and reactivate user actions plus hide, restore and remove wish actions, with mandatory reasons, encrypted `moderation_actions`, audit entries, self-moderation and privileged-target guards, and unresolved-gift/expiry restore guards. Admin UI exposes actions inline in the report queue.
- P6.7 one appeal per restricted/suspended/banned action, encrypted appeal/resolution text, user appeals page, admin appeals queue/resolution with audit, banned users able to authenticate for appeals while interactive actions stay blocked, and MFA-protected support/gift dispute visibility for staff.
- P6.8 non-destructive account deletion requests guarded by active wishes/gifts, `DELETION_PENDING` status, cancellation, encrypted optional reason and MFA-only admin queue. No deletion or anonymisation occurs pending DEC-O8.
- P6.9 deduplicated in-app notifications for gift claimed/confirmed/disputed/unverified, wish under-review/restored/removed/expired, account moderation, appeal resolution and support resolution; inbox with unread count/read/read-all; payloads carry IDs and safe copy only.
- P6.10 durable outbox dispatcher with `FOR UPDATE SKIP LOCKED`, exponential backoff, attempt caps, isolated handler failures, dead-letter alert logs, admin dead-letter visibility and idempotent success handling.
- P6.11 `RUNBOOK_OPERATIONS.md` covering disputes, late payment, OTP outage, VPA change, moderation escalation, deletion, outbox, restore and privacy/security incidents; critical payment/dispute path exercised against a separate staging database.

Open:
- None. Phase 6 is `DONE`; deployed staging/RPO/RTO and external provider/legal gates remain `BLOCKED`.

## Phase 7 progress

Completed:
- P7.1 `/me/karma` and profile balance/history derived by `SUM(karma_events.points_delta)`; no cached balance.
- P7.2 IST (`Asia/Kolkata`) streak from distinct recipient-confirmed giving days, with UTC-midnight boundary tests.
- P7.3 idempotent badge awards on confirmation with unique `(user_id, badge_code)`. Defaults are FIRST_GIFT (1 confirmed sent), KIND_HEART (5), KIND_SOUL (10), GRATEFUL (thanks received) and STREAK_3 (3 IST days); definitions, labels, thresholds, order and active state live in `badge_definitions` and are admin-configurable.
- P7.4 recipient reaction/thanks persisted and exposed to participants in gift detail.
- P7.5 participant-only share card after confirmation with donor identity/payment data excluded.
- P7.6 Surprise Me with own/blocked/expired/session-skip exclusion and documented 3×/0.25×/1× weights.
- P7.7 No exposure records/caps added because no validated fairness policy requires them.
- P7.8 No push/SMS provider code added because providers and consent are not in place; in-app remains source of truth.

Open:
- Badge thresholds are provisional pending product confirmation (B-014).

## Phase 8 progress

Completed locally:
- P8.1 `THREAT_MODEL.md` with assets, actors, trust boundaries, threat/control table and open security gates.
- P8.2 `npm audit` 0 vulnerabilities, `pip-audit` no known vulnerabilities, Bandit medium/high clean after clarifying non-security MD5 feed ordering, no tracked env/secrets and no container image present.
- Local hardening checks: PostgreSQL dump/restore drill preserved users/wishes/gifts/badge definitions at `0014_badge_definitions`; 500 feed requests at concurrency 50 with 0 errors (p95 90.3 ms, local only); Lighthouse mobile accessibility 100 on home, sign-in, admin gate and My Space (My Space best-practices 96 due the expected empty-payment-method 404; CLS 0.98 category score).

Blocked/partial:
- **P8.3** load test needs owner-agreed beta assumptions and a staging target; local smoke only.
- **P8.4** OTP/report rate limits and account guards are tested; graceful provider/Redis degradation and abuse review need operational sign-off.
- **P8.5** local backup/restore passed; owner-approved RPO/RTO and deployed backup policy are absent.
- **P8.6** no production metrics/dashboards/alerts or on-call ownership configured.
- **P8.7** Lighthouse accessibility 100 on primary pages; full WCAG 2.2 AA manual/keyboard/screen-reader and mobile-browser matrix not completed.
- **P8.8–P8.12** deployment/rollback, legal/partner review, UPI device testing, real-money flag approval and beta operation are external/blocked.

## Remaining external blockers

| ID | Description | Status |
|---|---|---|
| B-005 | Legal, UPI/bank, KMS, OTP and cloud providers unresolved | `OPEN` |
| B-007 | Production SMS/OTP provider not selected | `OPEN` |
| B-008 | Production KMS not selected | `OPEN` |
| B-009 | VPA beneficiary validation unresolved | `OPEN` |
| B-010 | Admin MFA mechanism (DEC-I13) | `RISK ACCEPTED` — owner chose role-only admin access; TOTP optional, disabled by default (2026-11-24) |
| B-011 | Moderation-removal cooldown policy (DEC-O7) | `RESOLVED` — approved no extra cooldown (2026-11-24) |
| B-012 | Retention schedule (DEC-O8) unresolved; deletion requests are recorded but no data is deleted/anonymised | `EXTERNAL_BLOCKED` |
| B-013 | Deployed staging environment and approved RPO/RTO not available; local staging exercise recorded, remote drill pending | `EXTERNAL_BLOCKED` |
| B-014 | Badge thresholds/rules | `RESOLVED` — defaults approved; now DB-configurable (2026-11-24) |
| B-015 | Exposure-cap policy | `RESOLVED` — no exposure tracking for now (2026-11-24) |
| B-016 | Independent security review/penetration test and security-owner sign-off pending | `EXTERNAL_BLOCKED` |
| B-017 | Monitoring/dashboards/alerting, on-call ownership and approved RPO/RTO pending | `EXTERNAL_BLOCKED` |
| B-018 | Beta load assumptions and deployed staging target not agreed | `EXTERNAL_BLOCKED` |
| B-019 | Legal/bank/UPI, KMS, production OTP provider and real-money activation approvals pending | `EXTERNAL_BLOCKED` |

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
| 2026-11-24 | Owner follow-up | Direction A applied across all consumer, account, gift and admin screens | `TEST_EVIDENCE.md` VE-048 |
| 2026-11-24 | Owner follow-up | Direction A design system, mobile bottom-tab shell and redesigned Home | `TEST_EVIDENCE.md` VE-047 |
| 2026-11-24 | Owner follow-up | Replaced duplicate account header with profile dropdown: Appeals, Account deletion, Sign out | `TEST_EVIDENCE.md` VE-046 |
| 2026-11-24 | Owner follow-up | Onboarding avatar context/redirects, wish owner handling and direct gift CTA, discovery cleanup, account navigation | `TEST_EVIDENCE.md` VE-045 |
| 2026-11-24 | Owner follow-up | Session-aware header, signed-in CTAs and admin console discoverability | `TEST_EVIDENCE.md` VE-044 |
| 2026-11-24 | Owner follow-up | DB-only admin roles, admin role management, DB badge registry, DEC-O7/badge/exposure approvals | `TEST_EVIDENCE.md` VE-043 |
| 2026-11-24 | P8.1, P8.2 + local checks | Threat model, scans, restore/load smoke, accessibility audits | `TEST_EVIDENCE.md` VE-041, VE-042 |
| 2026-11-24 | P7.1–P7.6 | Karma/streak/badges, reactions, share cards, Surprise Me | `TEST_EVIDENCE.md` VE-040 |
| 2026-11-24 | P6.10, P6.11 | Durable outbox, dead-letter visibility, runbooks, staging exercise | `TEST_EVIDENCE.md` VE-038, VE-039 |
| 2026-11-24 | P6.9 | Deduplicated in-app notifications and inbox UI | `TEST_EVIDENCE.md` VE-037 |
| 2026-11-24 | P6.8 | Non-destructive deletion requests, guards, cancel and admin queue | `TEST_EVIDENCE.md` VE-036 |
| 2026-11-24 | P6.7 | Appeals, banned-user appeal access, admin appeal resolution and dispute visibility | `TEST_EVIDENCE.md` VE-035 |
| 2026-11-24 | P6.6 | User and wish moderation actions with guards, audit and admin UI | `TEST_EVIDENCE.md` VE-034 |
| 2026-11-24 | P6.4, P6.5 | Protected admin console, RBAC, TOTP MFA, append-only audit | `TEST_EVIDENCE.md` VE-033 |
| 2026-11-24 | P6.3 | Auto-hide at three unique reports; moderator report queue | `TEST_EVIDENCE.md` VE-032 |
| 2026-11-24 | P6.1, P6.2 | Reporting, rate limits, blocks, two-way exclusions, report/block/unblock UI | `TEST_EVIDENCE.md` VE-031 |
| 2026-11-24 | P5.14 | Donor/recipient gift UI, handoff, outcome, confirmation, history, support entry point | `TEST_EVIDENCE.md` VE-030 |
| 2026-11-24 | P5.10, P5.13 | Support cases/admin resolution, runbook, true PAID-vs-expiry and confirmation-vs-timeout races | `TEST_EVIDENCE.md` VE-029 |
| 2026-11-24 | P5.1–P5.9, P5.11, P5.12, P5.15 | Gift/reservation backend, handoff, outcomes, confirmation, karma, workers | `TEST_EVIDENCE.md` VE-028 |
| 2026-11-24 | Phase 4 | Discovery feed/detail/select gate | VE-024–VE-027 |
| 2026-11-24 | Phase 3 | Payment method, wishes, expiry worker | VE-020–VE-023 |
| 2026-11-24 | Phase 2 | Identity, sessions, consent, profile | VE-016–VE-019 |

## Verification snapshot

| Check | Result |
|---|---|
| Backend tests | 177 passed (14 gift, 2 support-case, 4 reporting/block/auto-hide, 9 admin security/moderation/appeal/role, 2 deletion, 3 notifications, 4 outbox, 3 karma/badge config, 2 Surprise Me) |
| Frontend tests | 72 passed (15 test files) |
| Dependency/security scans | `npm audit` 0; `pip-audit` 0 known; Bandit medium/high clean; no tracked env/secrets |
| Local restore drill | PASS — dump/restore at `0014_badge_definitions`; users=3, badge_definitions=5, wishes=3, gifts=1 |
| Local load smoke | 500 requests, 50 concurrency, 0 errors, p95 90.3 ms (not capacity sign-off) |
| Accessibility smoke | Lighthouse mobile accessibility 100 on `/`, `/sign-in`, `/admin`, `/me` |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, production build pass |
| Migrations | 0001–0014 apply; 0014 badge-definition migration validated at head |
| DB roles/badge config | PASS — DB role sole admin authority; user search/role API/UI; badge definitions admin CRUD |
| Admin MFA policy | Owner override recorded: role-only admin access; TOTP optional/disabled by default |
| Local admin bootstrap | `AnilKumar` local account renamed from ChaiExplorer and set to DB `ADMIN` |
| Staging exercise | PASS — separate `kindah_staging_exercise` DB; OTP→VPA→wish→gift→PAID→dispute→support→admin MFA→resolve→audit |
| Phase 5 race suite | PASS — concurrent donors, idempotency, PAID-vs-expiry, confirmation-vs-timeout, re-reservation |
| Phase 5 UI | PASS — full-stack donor gift, recipient confirmation and support report |
| Phase 6 reporting/blocks | PASS — API and browser report, block, blocked list, unblock |
| Phase 6 auto-hide/queue | PASS — third unique report hides once; admin queue is 403 for non-admins |
| Phase 6 admin/MFA/audit | PASS — browser TOTP enrollment, queue, support resolution, audit view; append-only DB trigger |
| Phase 6 moderation actions | PASS — user status actions, wish hide/restore/remove, guards, audit and browser hide/restore |
| Phase 6 appeals/disputes | PASS — appeal lifecycle, admin queue/resolution, banned-user access, MFA-only dispute data |
| Phase 6 deletion requests | PASS — active-transaction guards, pending/cancel lifecycle, admin queue, no destructive deletion |
| Phase 6 notifications | PASS — safe deduplicated events, inbox/read state, gift/wish/moderation/appeal/support coverage |
| Phase 6 outbox/runbooks | PASS — skip-locked dispatch, retry/dead-letter, runbooks and staging exercise |
| Phase 6 overall | `DONE` — 11/11 tasks; external launch gates remain blocked |
| Phase 7 karma/streak/badges | PASS — ledger projection, IST boundaries, idempotent badges |
| Phase 7 reactions/share/Surprise Me | PASS — participant-only thanks/share card, weighted exclusion-based selection |
| Session-aware navigation | PASS — signed-in identity replaces Sign in; admin/moderator console link visible; live OTP/profile/logout sync |
| Onboarding/wish/account UX | PASS — avatar context/fixed-set copy; post-auth redirect; owner wish message and direct gift CTA; city/service panels removed; account actions in profile dropdown with no duplicate nav |
| Direction A shell/Home | PASS — shared tokens/fonts/icons; mobile bottom tabs and account sheet; editorial Home hero and wish feed; desktop/mobile browser review |
| Direction A full rollout | PASS — consumer, account, gift and admin screens restyled; 72 frontend tests; desktop/mobile browser review |
| Phase 7 overall | `DONE` — 8/8 tasks; badge definitions DB-configurable |
| Phase 5 overall | `DONE` — 15/15 tasks |

## Completed slice — late-payment support and admin visibility

On 2026-11-24 the owner approved `DEC-O5` and `DEC-A06`:

- Use the spec attestation labels (“Donor says paid”, “Awaiting recipient confirmation”, “Recipient confirmed”, “Disputed”).
- Late payments are support-only: no refund, reassignment or automatic reopening.
- Admin/moderator users must be able to see full support-case and gift details and resolve the reported issue with an audited note. Full admin RBAC/MFA remains Phase 6.

Implemented: `0006_support_cases`, participant case creation, admin list/detail/resolve, encrypted case and resolution text, redacted audit events, duplicate-open-case protection, and `RUNBOOK_LATE_PAYMENT.md`. Admin access now uses the DB role plus MFA (the original Phase 5 local allow-list was removed). P5.14 surfaces the approved labels and support entry point in `/gifts/new/[wishId]`, `/gifts/[id]` and My Space.

## Next session handoff

1. Confirm the owner account remains DB `ADMIN`; use the visible admin console link or `/admin`, then the admin Users tab for further role changes.
2. Revisit DEC-I13 before production: owner accepted role-only admin access, so account-compromise risk must be covered by deployment controls or MFA re-enabled.
3. Provision deployed staging, monitoring/alerts/on-call, KMS/OTP/UPI providers and complete legal/bank approvals before P8.3–P8.12.
4. Run independent security review and a full WCAG 2.2 AA/manual browser matrix; keep deletion non-destructive and real-money handoff disabled.
