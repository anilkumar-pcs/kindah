# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 6 — Trust, safety, moderation and operational support
**Overall status:** `IN_PROGRESS`
**Repository state:** Phases 0–5 complete. Phase 6 is in progress: reporting, blocks, auto-hide, queue, protected admin console, RBAC, MFA and append-only audit are complete.

## Phase dashboard

| Phase | Status | Tasks done | Tasks total | Evidence / blocker |
|---|---|---:|---:|---|
| 0. Repository discovery | `DONE` | 10 | 10 | Owner approved Phase 1 scope |
| 1. Foundation | `DONE` | 10 | 10 | 27 backend + 6 frontend tests |
| 2. Identity | `DONE` | 9 | 9 | 78 backend + 11 frontend tests |
| 3. Recipient & wishes | `DONE` | 10 | 10 | 126 backend + 15 frontend tests |
| 4. Discovery | `DONE` | 7 | 7 | 133 backend + 21 frontend tests |
| 5. Gift & UPI | `DONE` | 15 | 15 | 149 backend + 31 frontend tests; full-stack gift flow and support report verified |
| 6. Trust & safety | `IN_PROGRESS` | 5 | 11 | 156 backend + 38 frontend tests; P6.1–P6.5 done |
| 7. Engagement | `NOT_STARTED` | 0 | 8 | Depends on Phase 5/6 |
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

Open:
- **P6.6–P6.11** moderation actions with state guards, appeals, deletion workflow, notifications, durable outbox and runbooks.

## Remaining external blockers

| ID | Description | Status |
|---|---|---|
| B-005 | Legal, UPI/bank, KMS, OTP and cloud providers unresolved | `OPEN` |
| B-007 | Production SMS/OTP provider not selected | `OPEN` |
| B-008 | Production KMS not selected | `OPEN` |
| B-009 | VPA beneficiary validation unresolved | `OPEN` |
| B-010 | Admin MFA mechanism (DEC-I13) implemented as recommended TOTP default; owner confirmation required before production | `OPEN` |

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
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
| Backend tests | 156 passed (14 gift, 2 support-case, 4 reporting/block/auto-hide, 3 admin security) |
| Frontend tests | 38 passed (9 test files) |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, production build pass |
| Migrations | 0001–0008 apply; 0008 admin role/MFA/audit migration validated at head |
| Phase 5 race suite | PASS — concurrent donors, idempotency, PAID-vs-expiry, confirmation-vs-timeout, re-reservation |
| Phase 5 UI | PASS — full-stack donor gift, recipient confirmation and support report |
| Phase 6 reporting/blocks | PASS — API and browser report, block, blocked list, unblock |
| Phase 6 auto-hide/queue | PASS — third unique report hides once; admin queue is 403 for non-admins |
| Phase 6 admin/MFA/audit | PASS — browser TOTP enrollment, queue, support resolution, audit view; append-only DB trigger |
| Phase 5 overall | `DONE` — 15/15 tasks |

## Completed slice — late-payment support and admin visibility

On 2026-11-24 the owner approved `DEC-O5` and `DEC-A06`:

- Use the spec attestation labels (“Donor says paid”, “Awaiting recipient confirmation”, “Recipient confirmed”, “Disputed”).
- Late payments are support-only: no refund, reassignment or automatic reopening.
- Admin/moderator users must be able to see full support-case and gift details and resolve the reported issue with an audited note. Full admin RBAC/MFA remains Phase 6.

Implemented: `0006_support_cases`, participant case creation, admin list/detail/resolve with the `ADMIN_USER_IDS` allow-list, encrypted case and resolution text, redacted audit events, duplicate-open-case protection, and `RUNBOOK_LATE_PAYMENT.md`. P5.14 surfaces the approved labels and support entry point in `/gifts/new/[wishId]`, `/gifts/[id]` and My Space.

## Next session handoff

1. Implement P6.6 warn/restrict/suspend/ban and wish restore/remove with mandatory reasons, admin audit entries and state guards; UNDER_REVIEW may return to OPEN only when unexpired and no unresolved gift.
2. Continue P6.7–P6.11 in dependency order; do not bypass PostgreSQL state guards or expose moderation notes publicly.
3. Keep admin MFA in provisional status until the owner confirms DEC-I13; production activation remains blocked.
4. Keep real-money handoff disabled and external gates `BLOCKED`.
