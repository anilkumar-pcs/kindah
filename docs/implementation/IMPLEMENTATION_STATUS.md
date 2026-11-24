# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 8 — Hardening, launch readiness and Bengaluru beta
**Overall status:** `IN_PROGRESS`
**Repository state:** Phases 0–7 complete. Phase 8 has not started; production launch gates remain external.

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
| 7. Engagement | `DONE` | 8 | 8 | 173 backend + 53 frontend tests; badge thresholds provisional |
| 8. Hardening & beta | `NOT_STARTED` | 0 | 12 | External gates blocked |

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
- P6.5 `USER`/`MODERATOR`/`ADMIN` roles, enforced TOTP MFA with single-use recovery codes and session-bound 15-minute tokens, and append-only `admin_audit_logs` with request IDs and encrypted resolution notes.
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
- P7.3 idempotent badge awards on confirmation with unique `(user_id, badge_code)`; FIRST_GIFT, KIND_HEART (5), KIND_SOUL (10), GRATEFUL and STREAK_3 rules documented.
- P7.4 recipient reaction/thanks persisted and exposed to participants in gift detail.
- P7.5 participant-only share card after confirmation with donor identity/payment data excluded.
- P7.6 Surprise Me with own/blocked/expired/session-skip exclusion and documented 3×/0.25×/1× weights.
- P7.7 No exposure records/caps added because no validated fairness policy requires them.
- P7.8 No push/SMS provider code added because providers and consent are not in place; in-app remains source of truth.

Open:
- Badge thresholds are provisional pending product confirmation (B-014).

## Remaining external blockers

| ID | Description | Status |
|---|---|---|
| B-005 | Legal, UPI/bank, KMS, OTP and cloud providers unresolved | `OPEN` |
| B-007 | Production SMS/OTP provider not selected | `OPEN` |
| B-008 | Production KMS not selected | `OPEN` |
| B-009 | VPA beneficiary validation unresolved | `OPEN` |
| B-010 | Admin MFA mechanism (DEC-I13) implemented as recommended TOTP default; owner confirmation required before production | `OPEN` |
| B-011 | Moderation-removal cooldown policy (DEC-O7) implemented as recommended no-cooldown default; owner confirmation required | `OPEN` |
| B-012 | Retention schedule (DEC-O8) unresolved; deletion requests are recorded but no data is deleted/anonymised | `EXTERNAL_BLOCKED` |
| B-013 | Deployed staging environment and approved RPO/RTO not available; local staging exercise recorded, remote drill pending | `EXTERNAL_BLOCKED` |
| B-014 | Badge thresholds/rules are an implementation default; owner/product confirmation pending | `OPEN` |
| B-015 | Exposure-cap policy not validated; no exposure tracking is collected | `OPEN` |

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
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
| Backend tests | 173 passed (14 gift, 2 support-case, 4 reporting/block/auto-hide, 6 admin security/moderation/appeal, 2 deletion, 3 notifications, 4 outbox, 2 karma, 2 Surprise Me) |
| Frontend tests | 53 passed (12 test files) |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, production build pass |
| Migrations | 0001–0013 apply; 0013 badge migration validated at head |
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
| Phase 7 overall | `DONE` — 8/8 tasks; badge thresholds provisional |
| Phase 5 overall | `DONE` — 15/15 tasks |

## Completed slice — late-payment support and admin visibility

On 2026-11-24 the owner approved `DEC-O5` and `DEC-A06`:

- Use the spec attestation labels (“Donor says paid”, “Awaiting recipient confirmation”, “Recipient confirmed”, “Disputed”).
- Late payments are support-only: no refund, reassignment or automatic reopening.
- Admin/moderator users must be able to see full support-case and gift details and resolve the reported issue with an audited note. Full admin RBAC/MFA remains Phase 6.

Implemented: `0006_support_cases`, participant case creation, admin list/detail/resolve with the `ADMIN_USER_IDS` allow-list, encrypted case and resolution text, redacted audit events, duplicate-open-case protection, and `RUNBOOK_LATE_PAYMENT.md`. P5.14 surfaces the approved labels and support entry point in `/gifts/new/[wishId]`, `/gifts/[id]` and My Space.

## Next session handoff

1. Begin Phase 8 with P8.1 threat modelling/security review, P8.2 dependency/secret/static scans and P8.7 accessibility/responsive verification.
2. P8.3–P8.6 require agreed beta assumptions, load tooling, backup/RPO/RTO and monitoring ownership; P8.8–P8.12 require external deployment/legal/partner gates.
3. Keep deletion non-destructive until DEC-O8; keep DEC-I13/DEC-O7 and badge thresholds provisional.
4. Keep real-money handoff disabled; do not claim production readiness.
