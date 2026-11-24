# Chillar / Kindly — Implementation Status

**Last updated:** 2026-11-24
**Current phase:** Phase 5 — Core gift, reservation and UPI handoff (**BLOCKED on owner decisions**)
**Overall status:** `IN_PROGRESS`
**Repository state:** Phases 0–4 are complete and validated. No Phase 5 code has been written.

> A phase is `DONE` only when its exit criteria and evidence are recorded in `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_BACKLOG.md` and `TEST_EVIDENCE.md`.

## Phase dashboard

| Phase | Status | Tasks done | Tasks total | Evidence / blocker |
|---|---|---:|---:|---|
| 0. Repository discovery | `DONE` | 10 | 10 | Owner approved Phase 1 scope on 2026-11-23 |
| 1. Foundation | `DONE` | 10 | 10 | 27 backend + 6 frontend tests, fresh clone |
| 2. Identity | `DONE` | 9 | 9 | 78 backend + 11 frontend tests, browser/session restore |
| 3. Recipient & wishes | `DONE` | 10 | 10 | 126 backend + 15 frontend tests, VPA/wish/cooldown browser flow |
| 4. Discovery | `DONE` | 7 | 7 | 133 backend + 21 frontend tests, guest feed/auth-gate browser flow |
| 5. Gift & UPI | `BLOCKED` | 0 | 15 | Mandatory owner decisions `DEC-O2`, `DEC-A02`–`DEC-A04` not yet resolved |
| 6. Trust & safety | `NOT_STARTED` | 0 | 11 | Depends on Phase 5 events/outbox |
| 7. Engagement | `NOT_STARTED` | 0 | 8 | Depends on Phase 5 karma and Phase 6 notifications |
| 8. Hardening & beta | `NOT_STARTED` | 0 | 12 | External legal/partner gates remain blocked |

## Phase 4 completion summary

- Cursor-paginated public feed with Fresh and deterministic seeded Random ordering, city filter and eligibility exclusions.
- Public-safe wish DTO; detail endpoint; authenticated select gate (guest receives 401).
- `user_blocks` table used to exclude blocked users in both directions.
- Frontend discovery cards, filters, loading/empty/error states, load-more and wish detail with sign-in prompt.
- Evidence: `TEST_EVIDENCE.md` VE-024–VE-027.

## Phase 5 blocker — owner decisions required

Phase 5 is the payment-correctness core. The plan and specification require decisions before implementation; these are **not AI approvals**:

| Decision | Needed for | Proposed default |
|---|---|---|
| `DEC-O2` | Reservation timing | 10-minute handoff, one Still Processing extension to 20 minutes total, 24-hour recipient response |
| `DEC-A02` | UPI URI generation/persistence | Generate in-transaction from server-owned data, persist encrypted, expose only after commit |
| `DEC-A03` | Wish eligibility after donor PAID | Follow literal spec; confirm whether a new wish is allowed during PAYMENT_CLAIMED/UNVERIFIED/DISPUTED |
| `DEC-A04` | `DONOR_PENDING` at timeout | Expire the wish, never reopen, route to support |

Also unresolved/external: `DEC-O3` legal/UPI position, `DEC-O4` VPA beneficiary validation, production KMS and OTP providers. Real-money handoff remains disabled.

## Recently completed

| Date | Phase/task | Change | Evidence |
|---|---|---|---|
| 2026-11-24 | P4.1–P4.7 | Public feed, detail, select gate, blocks, frontend discovery | `TEST_EVIDENCE.md` VE-024–VE-027 |
| 2026-11-24 | Phase 4 validation | 133 backend tests, 21 frontend tests, build, guest browser flow | Commits pending |
| 2026-11-24 | Phase 3 | Payment method, wishes, expiry worker, My Space | VE-020–VE-023 |
| 2026-11-24 | Phase 2 | Identity, sessions, consent, profile | VE-016–VE-019 |
| 2026-11-23 | Phase 1 | Foundation and skeleton | VE-007–VE-015 |

## Verification snapshot

| Check | Result |
|---|---|
| Backend tests | 133 passed |
| Frontend tests | 21 passed |
| Backend quality | Ruff, format, mypy clean |
| Frontend quality | ESLint, Prettier, tsc, build pass |
| Migrations | 0001–0004 up → down → up pass |
| Browser | Guest feed, detail, 401 select gate; no console errors |
| Worker | Wish expiry runs and reports count |
| CI | Workflow valid; remote execution still pending |

## Next session handoff

1. **Resolve `DEC-O2`, `DEC-A02`, `DEC-A03`, `DEC-A04` in `DECISIONS.md`** before any Phase 5 implementation.
2. Then start P5.1 state machines and P5.2 reservation constraints; implement the mandatory concurrency tests before UI polish.
3. Keep real-money handoff disabled; production legal/KMS/VPA/OTP gates remain `BLOCKED`.
4. Do not mark Phase 5 `DONE` if any spec §18 race-condition test is skipped or failing.
