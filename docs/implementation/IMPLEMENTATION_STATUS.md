# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 5 — Core gift, reservation and UPI handoff
**Overall status:** `IN_PROGRESS`
**Repository state:** Phases 0–4 complete. Phase 5 backend core is implemented and validated; late-payment support, full race instrumentation and gift UI remain.

## Phase dashboard

| Phase | Status | Tasks done | Tasks total | Evidence / blocker |
|---|---|---:|---:|---|
| 0. Repository discovery | `DONE` | 10 | 10 | Owner approved Phase 1 scope |
| 1. Foundation | `DONE` | 10 | 10 | 27 backend + 6 frontend tests |
| 2. Identity | `DONE` | 9 | 9 | 78 backend + 11 frontend tests |
| 3. Recipient & wishes | `DONE` | 10 | 10 | 126 backend + 15 frontend tests |
| 4. Discovery | `DONE` | 7 | 7 | 133 backend + 21 frontend tests |
| 5. Gift & UPI | `IN_PROGRESS` | 12 | 15 | Backend 145 tests; P5.10/P5.13/P5.14 open |
| 6. Trust & safety | `NOT_STARTED` | 0 | 11 | Depends on Phase 5 completion |
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
- P5.11 participant gift history.
- P5.12 idempotent karma ledger.
- P5.15 real-money handoff remains disabled.

Open:
- **P5.10** late-payment/old-URI support path and runbook.
- **P5.13** true simultaneous PAID-vs-expiry and confirmation-vs-timeout race tests (concurrent donors and idempotency already covered).
- **P5.14** end-to-end donor/recipient gift UI.
- Phase 5 cannot be marked DONE until these pass and all spec §18 race tests are green.

Approved decisions: `DEC-O2` (10m + 20m max, 24h), `DEC-A02` (encrypt handoff, expose after commit), `DEC-A03` (literal spec post-PAID wish), `DEC-A04` (DONOR_PENDING expires, never reopens).

## Remaining external blockers

| ID | Description | Status |
|---|---|---|
| B-005 | Legal, UPI/bank, KMS, OTP and cloud providers unresolved | `OPEN` |
| B-007 | Production SMS/OTP provider not selected | `OPEN` |
| B-008 | Production KMS not selected | `OPEN` |
| B-009 | VPA beneficiary validation unresolved | `OPEN` |

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
| 2026-11-24 | P5.1–P5.9, P5.11, P5.12, P5.15 | Gift/reservation backend, handoff, outcomes, confirmation, karma, workers | `TEST_EVIDENCE.md` VE-028 |
| 2026-11-24 | Phase 4 | Discovery feed/detail/select gate | VE-024–VE-027 |
| 2026-11-24 | Phase 3 | Payment method, wishes, expiry worker | VE-020–VE-023 |
| 2026-11-24 | Phase 2 | Identity, sessions, consent, profile | VE-016–VE-019 |

## Verification snapshot

| Check | Result |
|---|---|
| Backend tests | 145 passed (12 gift tests) |
| Frontend tests | 21 passed |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, build pass |
| Migrations | 0001–0005 apply; 0005 gift migration validated |
| Phase 5 race suite | PARTIAL |
| Phase 5 UI | NOT STARTED |

## Next session handoff

1. Finish P5.10 late-payment/old-URI support path and runbook.
2. Add true PAID-vs-expiry and confirmation-vs-timeout race tests; do not mark Phase 5 DONE until all spec §18 tests pass.
3. Build P5.14 gift UI (amount, review, handoff, donor outcome, recipient confirmation).
4. Keep real-money handoff disabled and external gates `BLOCKED`.
