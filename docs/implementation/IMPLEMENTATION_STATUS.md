# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 4 — Public discovery and selection
**Overall status:** `IN_PROGRESS`
**Repository state:** Phases 0–3 are complete and validated. Phase 4 implementation has started.

> A phase is `DONE` only when its exit criteria and evidence are recorded in `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_BACKLOG.md` and `TEST_EVIDENCE.md`.

## Phase dashboard

| Phase | Status | Tasks done | Tasks total | Evidence / blocker |
|---|---|---:|---:|---|
| 0. Repository discovery | `DONE` | 10 | 10 | Owner approved Phase 1 scope on 2026-11-23 |
| 1. Foundation | `DONE` | 10 | 10 | 27 backend + 6 frontend tests, build, fresh clone |
| 2. Identity | `DONE` | 9 | 9 | 78 backend + 11 frontend tests, browser/session restore |
| 3. Recipient & wishes | `DONE` | 10 | 10 | 126 backend + 15 frontend tests, VPA/wish/cooldown browser flow |
| 4. Discovery | `IN_PROGRESS` | 0 | 7 | Public feed, exclusions, cursor, detail, auth gate |
| 5. Gift & UPI | `NOT_STARTED` | 0 | 15 | Highest correctness risk; `DEC-O2`, `DEC-A02`–`DEC-A04` pending |
| 6. Trust & safety | `NOT_STARTED` | 0 | 11 | Depends on Phase 5 events/outbox |
| 7. Engagement | `NOT_STARTED` | 0 | 8 | Depends on Phase 5 karma and Phase 6 notifications |
| 8. Hardening & beta | `NOT_STARTED` | 0 | 12 | External legal/partner gates remain blocked |

## Phase 3 completion summary

- VPA syntax validation only, encrypted at rest, keyed-HMAC duplicate detection, masked responses, versioning and re-authentication freshness.
- Wish creation with structural content filters, mood enum, whole-INR bounds, optional city and onboarding/payment-method prerequisites.
- One active wish per user via a partial unique index; 24h expiry; 72h cooldown after withdrawal/expiry.
- Withdrawal endpoint and idempotent expiry worker.
- My Space frontend with masked UPI setup, wish preview/publish, active wish, withdrawal, cooldown and history.
- Evidence: `TEST_EVIDENCE.md` VE-020–VE-023.

## Current focus — Phase 4

- **Goal:** Guests can browse public wishes; authenticated users can view eligible details and start the gift journey later.
- **Tasks:** Cursor-paginated public feed, exclusions (own/expired/locked/removed/under review/blocked/ineligible), Fresh order, city filter, public wish detail, authentication gate before selection, frontend feed states, eligibility/privacy tests.
- **Decision pending:** `DEC-A01` Random tab / Surprise Me phase placement. Implementation will include the basic Random tab; full fairness is Phase 7.
- **Privacy:** Public DTOs must never contain phone, VPA, UTR, payment reference or moderation data.

## Blockers

| ID | Description | Owner | Status | Next action |
|---|---|---|---|---|
| B-005 | External legal, UPI/bank, VPA-validation, KMS, OTP and cloud providers unresolved. | Owner/external | `OPEN` | Blocks production readiness only. |
| B-006 | Visual design/brand assets not supplied. | Owner | `OPEN` | Neutral accessible tokens in use. |
| B-007 | Production SMS/OTP provider not selected. | Owner/external | `OPEN` | Test adapter only; production auth blocked. |
| B-008 | Production KMS not selected; local AES-GCM is dev/test only. | Owner/external | `OPEN` | Production encryption blocked. |
| B-009 | VPA beneficiary validation provider/legal approval unresolved. | Owner/external | `OPEN` | Syntax-only; never claim ownership verification. |

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
| 2026-11-24 | P3.1–P3.10 | VPA storage, wish lifecycle, expiry worker, My Space UI | `TEST_EVIDENCE.md` VE-020–VE-023 |
| 2026-11-24 | Phase 3 validation | 126 backend tests, 15 frontend tests, build, browser flow | Commits pending |
| 2026-11-24 | Phase 2 | Identity, sessions, consent, profile | VE-016–VE-019 |
| 2026-11-23 | Phase 1 | Foundation and skeleton | VE-007–VE-015 |

## Verification snapshot

| Check | Result |
|---|---|
| Backend tests | 126 passed |
| Frontend tests | 15 passed |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, build pass |
| Migrations | 0001–0003 up → down → up pass |
| Browser | VPA save, wish publish, withdraw, cooldown, forced re-auth |
| Worker | Wish expiry runs and reports count |
| CI | Workflow valid; remote execution still pending |

## Next session handoff

1. Continue Phase 4 from P4.1; do not start Phase 5 until Phase 4 exit criteria pass.
2. Public DTOs must be assembled from allow-listed fields; never serialise ORM entities.
3. Record tests, evidence and decisions before marking Phase 4 `DONE`.
