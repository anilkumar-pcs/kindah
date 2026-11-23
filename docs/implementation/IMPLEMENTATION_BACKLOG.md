# Repository-Specific Implementation Backlog — Chillar / Kindly

**Phase:** 0 — Repository discovery and planning
**Date:** 2026-11-23
**Status:** Proposal for owner review. Task IDs P0.x–P8.x map to `IMPLEMENTATION_PLAN.md`; this document adds repository-specific work, dependencies and acceptance criteria without silently expanding or dropping plan scope.

---

## 1. How to use this backlog

- Work only on the current approved phase. Do not start a later phase because a task looks easy.
- A task is `DONE` only when its acceptance criteria pass and evidence is recorded in `TEST_EVIDENCE.md`.
- Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.
- Dependencies listed here are hard dependencies unless marked otherwise.
- External dependencies (legal, OTP provider, KMS, cloud) must never be simulated as approved. Test adapters are used and production readiness is marked `BLOCKED`.
- No time estimates are given; sequence and exit criteria are the contract.

---

## 2. Dependency order

```text
Phase 0 (this assessment, owner approval)
   │
   ▼
Phase 1 Foundation ──────────────────────────────┐
   │                                              │
   ▼                                              │
Phase 2 Identity                                  │
   │                                              │
   ▼                                              │
Phase 3 Payment method + wishes                   │
   │                                              │
   ▼                                              │
Phase 4 Discovery                                 │
   │                                              │
   ▼                                              │
Phase 5 Gift / reservation / UPI handoff ─────────┤
   │                                              │
   ├──────────────► Phase 6 Trust, safety, admin ─┤
   │                                              │
   └──────────────► Phase 7 Karma & engagement    │
                                                  │
                                                  ▼
                                        Phase 8 Hardening & beta
```

Phase 6 can begin only after Phase 5 has stable gift events/outbox. Phase 7 depends on Phase 5's karma ledger and Phase 6's notification surfaces. Phase 8 requires every prior phase plus external legal/partner gates.

**Critical path:** Phase 1 → 2 → 3 → 4 → 5. The mandatory concurrency tests in Phase 5 are the release-critical gate.

---

## 3. Phase 0 — Repository discovery and planning

| Task | Status | Evidence |
|---|---|---|
| P0.1 Inspect repository structure, languages, package managers, entry points, docs | DONE | `REPOSITORY_ASSESSMENT.md` §2–§3 |
| P0.2 Inspect git branch/working tree/tests; do not overwrite work | DONE | No git repository; no tests; docs preserved and backed up |
| P0.3 Identify frontend/backend/database/ORM/migrations/cache/deploy/CI | DONE | `REPOSITORY_ASSESSMENT.md` §3, F-03, F-11 |
| P0.4 Map existing modules to specification | DONE | `REPOSITORY_ASSESSMENT.md` §6; no existing modules |
| P0.5 Identify missing capabilities, duplication, coupling, debt | DONE | `REPOSITORY_ASSESSMENT.md` §6.1, §7 |
| P0.6 Produce `REPOSITORY_ASSESSMENT.md` | DONE | This repository |
| P0.7 Produce `ARCHITECTURE.md` | DONE | This repository |
| P0.8 Produce `DECISIONS.md` with unresolved decisions and proposed defaults | DONE | This repository; all entries `PENDING`/`EXTERNAL_BLOCKED` |
| P0.9 Convert remaining phases into repository-specific tasks and dependency order | DONE | This document |
| P0.10 Present assessment and proposed Phase 1 scope for owner review | **IN_PROGRESS** | Awaiting owner review and approval |

**Phase 0 exit gate:** owner approves the assessment, architecture, decision defaults and Phase 1 scope. Until then, Phase 0 is `IN_PROGRESS`.

---

## 4. Phase 1 — Foundation and runnable skeleton (proposed scope for owner review)

**Goal:** A developer can clone the repository, configure local environment variables, start the application and run automated checks reliably.

### 4.1 Prerequisites (must be installed before P1.10 can pass)

| Prerequisite | Why | Proposed action |
|---|---|---|
| Python 3.12+ | Spec §6.1 | Install `uv`; run `uv python install 3.12`. |
| Python package manager | Reproducible dependencies | `uv` with `pyproject.toml` + `uv.lock` (`DEC-I01`). |
| PostgreSQL 16 | Source of truth and migration tests | Homebrew `postgresql@16`; create dev/test databases (`DEC-I02`). |
| Redis 7 | Planned optional ephemeral use | Homebrew `redis`; may remain unset (`DEC-I02`). |
| Git | Version-control baseline | `git init`; baseline commit (P1.1). |
| Node.js | Next.js | Node 26 present; pin and verify. Fall back to supported LTS if needed. |

### 4.2 Tasks

#### P1.1 — Repository layout and version-control baseline

**Work**

- Create root `README.md` skeleton, `.gitignore` (Python, Node, `.env`, OS/editor files), `.editorconfig`, `Makefile` target skeleton.
- Create the directory skeleton from `ARCHITECTURE.md` §3: `backend/app/{core,api,modules,providers,workers,db}`, `backend/tests/…`, `frontend/src/{app,components,features,lib,styles}`, `deploy/`, `.github/workflows/`.
- Initialise git and create a baseline commit containing the existing docs and Phase 0 deliverables. **Commit requires owner authorisation**; staging the baseline is not.
- Preserve `CLAUDE.md`, the specification and all existing docs.

**Depends:** Phase 0 approval.

**Acceptance criteria**

- `git status` succeeds; baseline commit exists (or is staged with owner authorisation pending).
- Directory layout matches the architecture; no placeholder application code beyond empty `__init__.py`/`.gitkeep` where needed.
- `git status` is clean after the baseline commit.
- No `.env`, credentials or generated artefacts are tracked.
- Existing document contents are unchanged.

**Evidence:** `git log --stat`, `git status`, tree listing.

---

#### P1.2 — Environment and configuration

**Work**

- Root `.env.example` with grouped variables: app/environment, database URL, optional Redis URL, auth secrets, local crypto key, CORS origins, payment feature flag (`PAYMENTS_LIVE_ENABLED=false`), handoff mode (`test`), worker settings, log level.
- Backend typed settings (`pydantic-settings`) with fail-fast validation and secret types.
- Frontend environment validation for API base URL and public flags (no secrets in `NEXT_PUBLIC_*`).
- `.gitignore` covers `.env*` except `.env.example`.

**Depends:** P1.1.

**Acceptance criteria**

- Copying `.env.example` to `.env` yields a startable configuration once local services exist.
- Missing required variable produces a clear startup error naming the variable, never its value.
- `.env` is ignored; `git check-ignore .env` succeeds.
- Settings tests cover valid, missing and malformed values.
- No real credential is present in any example file.

**Evidence:** settings tests; `git check-ignore`; redacted startup output.

---

#### P1.3 — FastAPI application factory, health, readiness and errors

**Work**

- `create_app()` factory with settings injection.
- `/healthz` liveness (process only) and `/readyz` readiness (database required; Redis optional/degraded).
- Middleware: request/correlation ID, access logging, CORS allow-list, baseline security headers.
- Central error catalogue and RFC 9457 `problem+json` handlers for validation errors, HTTP errors and unhandled exceptions (no stack traces or internal detail in production).
- Versioned router mount at `/api/v1`; OpenAPI docs enabled outside production.

**Depends:** P1.2; P1.5 for real readiness (may stub DB check until P1.5 lands).

**Acceptance criteria**

- `/healthz` returns 200 without touching dependencies.
- `/readyz` returns 200 when PostgreSQL is reachable and 503 with a stable problem payload when not.
- 404, 401/403 (when auth exists), 422 and 500 responses use the error envelope and spec codes; no sensitive internals leak.
- Every response carries a request ID; the same ID appears in logs.
- CORS allows only configured origins.
- Tests cover health, readiness failure and error mapping.

**Evidence:** pytest output; sample problem responses; curl of health endpoints.

---

#### P1.4 — Frontend application shell

**Work**

- Next.js App Router + strict TypeScript + Tailwind; root layout, header/nav, responsive container.
- Placeholder routes: landing/discover, wish detail, sign-in, not-found, error, loading.
- Typed API client with base URL, credentials handling, problem+json parsing and timeout/error mapping.
- One real call to backend health/readiness displayed as a connectivity check.
- Web app manifest and basic PWA metadata (service worker policy deferred to `DEC-I14`).
- Neutral accessible design tokens (`DEC-A05`).

**Depends:** P1.1, P1.2; P1.3 for the connectivity call (can stub until then).

**Acceptance criteria**

- `npm run dev` and `npm run build` succeed.
- Pages render without horizontal overflow at 375 px, 768 px and 1280 px.
- Backend success and failure states are both rendered honestly.
- Landmarks, labels, focus visibility, contrast and 44×44 px touch targets pass a basic accessibility check.
- No token, phone, VPA or private data stored in `localStorage`.
- Component smoke tests pass.

**Evidence:** build output; screenshots at three widths; Vitest output; accessibility notes.

---

#### P1.5 — PostgreSQL connectivity, SQLAlchemy 2 and Alembic

**Work**

- Sync SQLAlchemy 2 engine and session factory using psycopg 3 (`DEC-I03`).
- Session dependency with commit/rollback and safe close.
- Alembic environment and initial baseline migration (no domain tables; migration infrastructure only).
- Test fixtures that create/migrate the test database and isolate each test.
- Database health check used by `/readyz`.

**Depends:** P1.2; local PostgreSQL installed.

**Acceptance criteria**

- `alembic upgrade head` and `alembic downgrade base` succeed on an empty database, then upgrade again succeeds.
- A session test commits and a forced error rolls back without leaking a transaction.
- Integration tests run against real PostgreSQL 16, not SQLite.
- `/readyz` reflects database availability.
- Migration command and database bootstrap are documented.

**Evidence:** Alembic command output; pytest integration output; readiness response in both states.

---

#### P1.6 — Redis configuration with safe degradation

**Work**

- Optional Redis client wrapper with connection timeout and health probe.
- `REDIS_URL` unset → disabled mode; configured but unavailable → degraded mode.
- Readiness reports Redis state without failing the application solely because Redis is down (until a later phase explicitly makes a feature depend on it).
- Document and test the rule: Redis is never used for wish/gift/payment state or locks.

**Depends:** P1.3.

**Acceptance criteria**

- Application starts with no Redis configured.
- Application stays up when a configured Redis is unreachable; readiness exposes `degraded`, and logs do not spam secrets.
- A configured reachable Redis reports healthy.
- Outage test passes.
- Code search confirms no domain state or correctness lock uses Redis.

**Evidence:** tests with Redis absent/unreachable/present; configuration docs.

---

#### P1.7 — Linting, formatting, type checking and unit tests

**Work**

- Backend: Ruff (lint + format), mypy (or pyright) with explicit config, pytest with markers (`unit`, `integration`, `concurrency`, `security`, `privacy`) and coverage reporting.
- Frontend: ESLint, Prettier, `tsc --noEmit`, Vitest with Testing Library.
- Makefile targets: `setup`, `fmt`, `lint`, `typecheck`, `test`, `test-backend`, `test-frontend`, `migrate`, `run-api`, `run-web`.
- Phase 1 tests: settings, health/error mapping, API client, a component smoke test.

**Depends:** P1.3, P1.4, P1.5.

**Acceptance criteria**

- All quality commands exit 0 on the Phase 1 baseline.
- No ignored type errors or blanket lint suppressions.
- Backend and frontend test commands run independently.
- Coverage is reported; from Phase 2 onward, changed domain modules target ≥80% line coverage.
- Commands match the README exactly.

**Evidence:** captured command output for each target.

---

#### P1.8 — CI for install/build/lint/type-check/tests

**Work**

- GitHub Actions workflow (`DEC-I17`): backend job with Python 3.12, `uv`, PostgreSQL 16 service, migrations, lint, type check and pytest; frontend job with pinned Node, `npm ci`, lint, type check, Vitest and production build.
- Dependency caching.
- Fail fast on any quality gate.
- Document required checks for branch protection (actual protection requires the remote and owner).

**Depends:** P1.5, P1.7; remote repository access.

**Acceptance criteria**

- CI passes on a clean checkout of the baseline commit.
- Backend tests use the PostgreSQL service and run migrations before tests.
- CI logs contain no secrets or sensitive values.
- Workflow file is reviewed and commands match local commands.

**Evidence:** CI run URL/output; workflow file; branch-protection checklist.

---

#### P1.9 — Structured logging, request IDs and redaction

**Work**

- JSON log formatter with timestamp, level, logger, request ID, method, path, status, duration.
- Redaction for keys and values matching: phone numbers, VPA patterns, UTR, OTP codes, `Authorization`/cookies/tokens, and `upi://` URIs. Deny-by-default for unknown objects containing sensitive fields.
- No request/response body logging; no query-string logging of sensitive parameters.
- Startup configuration logs names only, never values of secrets.
- Tests that inject each sensitive value into log records and assert redaction.

**Depends:** P1.3.

**Acceptance criteria**

- Redaction tests pass for phone, VPA, UTR, OTP, bearer token, cookie and UPI URI.
- A sample authenticated-style request log contains only request ID, method, path, status and duration.
- No adapter/provider logs plaintext VPA or OTP.
- Log schema is documented.

**Evidence:** pytest redaction output; sample log lines.

---

#### P1.10 — Local startup, test and migration documentation

**Work**

- README quickstart: prerequisites, install, environment setup, database creation, migrations, API/web/worker commands, tests, lint/type checks, troubleshooting.
- Document supported Node version and Python version; include the `uv` commands.
- Link to architecture, backlog, decisions and status.
- Record exact versions used.

**Depends:** P1.1–P1.9.

**Acceptance criteria**

- A fresh setup following the README, on this machine, succeeds end to end.
- Backend and frontend start independently and communicate.
- Migration, test and lint commands work as written.
- No secret is shown in examples or screenshots.
- Any deviation or manual step is documented.

**Evidence:** chronological command log and results in `TEST_EVIDENCE.md`; versions recorded.

### 4.3 Phase 1 exit criteria

Phase 1 is `DONE` only when all of the following are true and evidenced:

1. All P1.1–P1.10 tasks are `DONE`.
2. Fresh local setup succeeds using the documented steps on a clean checkout.
3. Frontend and backend start independently and communicate; CORS works for the configured origin.
4. PostgreSQL migration up/down (or the documented forward-only policy) is verified.
5. `/healthz` and `/readyz` behave as specified, including the failure state.
6. CI passes on a clean checkout.
7. Lint, format, type-check, unit tests and production build pass.
8. Logs contain no secrets, OTPs, phone numbers, raw VPAs, UTRs or UPI URIs; redaction tests pass.
9. `PAYMENTS_LIVE_ENABLED=false` and no payment/gift domain code exists.
10. No secrets or `.env` files are committed.
11. Owner reviews and accepts the Phase 1 evidence.

### 4.4 Explicitly out of scope for Phase 1

- Any domain table, ORM model or business endpoint beyond health/readiness.
- OTP, sessions, users, profiles, VPAs, wishes, gifts, karma, reports, admin or notifications.
- Payment URI/QR generation of any kind.
- Production infrastructure, staging deployment, monitoring platform, load testing.
- Visual brand finalisation.

---

## 5. Phase 2 — Identity, sessions and profile

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P2.1 | `SmsProvider` interface + deterministic test adapter; `otp_challenges` table; request/verify services; per-phone 3/15 min + IP limits; hashed codes; expiry/attempts/resend throttle; anti-enumeration responses. | P1 | OTP flow works end to end with test adapter; limits and replay protection tested; OTP never returned by API or written to logs. |
| P2.2 | Indian mobile normalization to E.164 (+91); encrypted mobile + keyed HMAC unique; one account per verified number; safe duplicate handling. | P2.1 | Valid/invalid formats tested; duplicate number cannot create a second account; no plaintext mobile in DB/logs/public payloads. |
| P2.3 | Access JWT (short-lived, in memory) + opaque rotating refresh cookie hashed server-side; expiry, revocation, reuse detection, logout; CSRF protection. | P2.1 | Expiry/refresh rotation/logout/reuse tests pass; cookie flags verified; protected endpoints reject missing/expired tokens. |
| P2.4 | First-login 18+ self-declaration and Terms/Privacy/Guidelines version + timestamps; gate interactive actions until accepted. | P2.2, P2.3 | Interactive endpoints blocked before acceptance; versions/timestamps recorded; re-consent path defined for policy changes. |
| P2.5 | Unique pseudonymous display name (normalised uniqueness, validation, reserved words) and avatar (`DEC-I15`); optional city. | P2.3 | Duplicate/unsafe names rejected; avatar renders; public profile contains no phone or legal identity. |
| P2.6 | `GET/PATCH /me`; account status; cooldown/karma placeholders; profile read/update. | P2.3–P2.5 | Public-safe DTO; update validation; restricted/suspended/banned status surfaced and enforced. |
| P2.7 | Authorization dependencies: current user, active account, ownership; status checks on every protected route. | P2.3 | 401/403 codes correct; restricted/suspended/banned cannot create wishes or initiate gifts; IDOR tests pass. |
| P2.8 | Audit events for auth/consent/profile changes; OTP abuse, enumeration, token replay, session fixation and IDOR tests. | P2.1–P2.7 | Security test suite passes; audit records contain actor/action/time without sensitive values. |
| P2.9 | Frontend sign-in, OTP verification, consent, profile setup, session refresh, logout; loading/empty/error states. | P2.1–P2.8 | Full flow works against the test adapter; no tokens in `localStorage`; accessibility checks pass. |

**External dependency:** production SMS/OTP provider. Production authentication remains `BLOCKED` until selected and approved.

**Phase 2 exit criteria:** spec Phase 2 criteria — OTP end-to-end with test adapter; duplicate phones prevented; sessions expire/revoke; interactive actions require auth; 18+/legal acceptance recorded; public profile never reveals phone/legal identity; authorization and abuse tests pass.

---

## 6. Phase 3 — Recipient payment method and wish lifecycle

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P3.1 | VPA syntax validation and explicit validation-status field; no ownership claim. | P2 | Valid/invalid syntax tested; UI/API label says format-checked only. |
| P3.2 | `CryptoProvider` local AES-256-GCM adapter; encrypted VPA; keyed HMAC unique; key-rotation/recovery notes (`DEC-I09`). | P1, P2 | VPA encrypted at rest; HMAC detects duplicates; no plaintext in DB/logs; tests cover encrypt/decrypt and rotation hook. |
| P3.3 | Masked VPA representation for owner-only display; privacy tests across API, logs and analytics. | P3.2 | Only masked value returned; grep/tests find no raw VPA in public payloads/logs. |
| P3.4 | Payment-method create/update/versioning; privacy acknowledgement; recent re-authentication; invalidate not-yet-issued handoffs; preserve old versions for gifts. | P2.3, P3.2 | Version increments; re-auth enforced; acknowledgement timestamp stored; old versions retained; handoff invalidation tested. |
| P3.5 | Wish create/withdraw validation: 10–120 Unicode chars; reject URL/phone/VPA-like/HTML/prohibited content; mood enum; optional whole-INR amount; optional city. | P2, P3.4 | Boundary and prohibited-content tests pass; mood/amount/city validation mirrored client/server. |
| P3.6 | Central `MIN_GIFT_INR=10`, `MAX_GIFT_INR=100`; integer-only validation; API/client/amount chips consistent; reviewed config-change process. | P3.5 | 9, 10, 100, 101, 25.5 rejected/accepted correctly; no duplicated constants. |
| P3.7 | Partial unique index for one OPEN/LOCKED wish per user; 24h expiry; 72h cooldown after GRANTED/EXPIRED; resolve `DEC-A03`. | P3.5 | Concurrent creation cannot create two active wishes; cooldown enforced server-side; tests cover boundaries. |
| P3.8 | Withdrawal and expiry worker; idempotent transitions; cooldown starts once. | P1, P3.7 | Worker duplicate run does not double-apply; expiry/withdraw state tests pass. |
| P3.9 | Database constraints and tests for duplicate active wishes, expiry races, cooldown, amount bounds and message length. | P3.5–P3.8 | Concurrency and constraint tests pass against real PostgreSQL. |
| P3.10 | Frontend VPA setup/disclosure, wish create/preview/withdraw/status; masked VPA; cooldown display. | P3.1–P3.9 | Flows work; loading/empty/error states; accessibility; no raw VPA in client storage or analytics. |

**External dependency:** VPA beneficiary-validation approach (`DEC-O4`). Production receiving money remains `BLOCKED` until resolved.

**Phase 3 exit criteria:** spec Phase 3 criteria — secure VPA save with masked display; one eligible wish; invalid content/amount rejected; server-side expiry/cooldown; concurrent creation cannot break the one-active-wish invariant; VPA/privacy tests pass.

---

## 7. Phase 4 — Public discovery and selection

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P4.1 | Read-only public feed with stable cursor pagination on `(created_at, id)`; indexed queries; public DTO. | P3 | Pagination stable under inserts; no duplicates/skips in tested windows; response excludes private fields. |
| P4.2 | Exclusions: own, expired, LOCKED, removed, under review, blocked, inactive recipient, no active payment method. | P4.1 | Each exclusion tested individually and in combination. |
| P4.3 | Optional city filter; Fresh ordering; Random tab per `DEC-A01`. | P4.1 | City filter tested; deterministic Random within a session seed if implemented; no eligibility leak. |
| P4.4 | Wish detail with public-safe fields; states for self/blocked/expired/locked/removed. | P4.1 | Public detail never contains VPA, phone, UTR, payment ref or moderation data; state-specific UI correct. |
| P4.5 | Authentication gate before selection/locking; guests browse only. | P2, P4.4 | Guest can browse; guest selection returns 401; auth resumes the intended action. |
| P4.6 | Frontend feed, cards, Fresh/Random/city controls, empty/loading/error/offline states, responsive mobile. | P4.1–P4.5 | Screens meet 44 px targets and WCAG basics; all states rendered; no private data in cards. |
| P4.7 | Pagination, authorization, privacy and eligibility tests. | P4.1–P4.6 | Test suite passes; privacy snapshot asserts forbidden fields absent. |

**Deferred per `DEC-A01`:** Surprise Me fairness weights, exposure records and tuning (Phase 7). The base Random tab remains a spec requirement and must not be silently dropped.

**Phase 4 exit criteria:** spec Phase 4 criteria — guest browse works; guest cannot reserve/report/interact; public API contains no private payment/identity data; pagination stable/performant for beta volume; eligibility rules tested.

---

## 8. Phase 5 — Core gift, reservation and UPI handoff

**This phase has the highest correctness risk. Implement the state machine and concurrency tests before UI polish.**

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P5.1 | Canonical enums and transition tables for wish/gift/reservation; one tested state-machine module. | P3 | Every allowed transition tested; every forbidden transition returns `422 INVALID_STATE_TRANSITION`. |
| P5.2 | `wish_reservations`: columns/indexes per spec §7; partial unique ACTIVE index; `CHECK(extension_count BETWEEN 0 AND 1)`; `CHECK(expires_at > reserved_at)`. | P5.1 | Constraint/concurrency tests pass; only ACTIVE rows participate in the unique index. |
| P5.3 | `POST /api/v1/gifts`: auth, `Idempotency-Key`, amount validation, `SELECT wish FOR UPDATE`, eligibility checks, unresolved-claim cap (max 2), `DEC-A02` resolution. | P2, P3, P4, P5.1–P5.2 | Exactly one of two concurrent donors succeeds; same key replays; different payload/key conflicts; amount/bounds/enum tests pass. |
| P5.4 | Atomic persistence of gift, reservation, wish lock, `gift_events`, `outbox_events`; stable IDs; encrypted handoff payload. | P5.3 | A forced failure rolls back all rows; success writes all rows once; no URI/VPA in logs/plaintext. |
| P5.5 | `PaymentHandoffProvider` test adapter; UPI URI/QR from server-owned amount/VPA/reference; bank-name disclosure; `PAYMENTS_LIVE_ENABLED=false`. | P5.4 | URI/QR integrity tested; frontend cannot edit payee/amount; flag off prevents live mode; disclosure displayed. |
| P5.6 | Donor outcomes PAID / STILL_PROCESSING / FAILED with actor/state guards; `STILL_PROCESSING` extension once, max 20 min; no escape from PAID. | P5.4 | Each transition tested; repeated extension rejected; FAILED after PAID rejected; retries return committed result. |
| P5.7 | Reservation expiry worker with wish→reservation→gift lock order; resolve `DEC-A04`; extension timing. | P5.6 | PAID-vs-expiry race test passes; never releases claimed/pending payment; idempotent duplicate runs. |
| P5.8 | Recipient RECEIVED/NOT_RECEIVED confirmation; recipient-only auth; 24h deadline; first outcome wins; reaction + ≤120-char message. | P5.6 | Non-recipient rejected; confirmation-vs-timeout race passes; conflicting second outcome not applied. |
| P5.9 | Terminal states GRANTED/UNVERIFIED/DISPUTED; no automatic reopen after PAID; support routing. | P5.8 | Terminal transitions tested; no code path reopens a claimed/terminal wish. |
| P5.10 | Late-payment/old-URI support path and user warnings; no automatic refund/reassignment promise. | P5.7 | Copy/UX warning tested; support event created; no silent mutation. |
| P5.11 | Participant-only gift status and `/me/gifts` history (sent/received). | P5.4 | IDOR tests pass; history excludes private counterparty identifiers. |
| P5.12 | `karma_events` append-only ledger; award only after recipient confirmation; unique idempotency key; confirmation-driven gift/thanks rules from spec §3.6 (`DEC-I16`). | P5.8 | No karma on donor claim; duplicate confirmation does not duplicate karma; ledger/bonus rules tested; streak and badge projections remain Phase 7 (P7.2–P7.3). |
| P5.13 | Mandatory concurrency suite: simultaneous donors; same-key replay; same-key different payload; PAID vs expiry; FAILED vs PAID; confirmation vs timeout; re-reservation after abandonment; old URI after release. | P5.1–P5.12 | Every spec §18 test passes; any skipped/failing test blocks Phase 5 `DONE`. |
| P5.14 | Frontend amount/review/handoff/return/donor outcome/await/recipient confirmation; timer; duplicate prevention; bank-name disclosure; no premature karma. | P5.3–P5.12 | Full journey works; all states represented honestly; accessibility and mobile checks pass. |
| P5.15 | Keep production real-money handoff disabled pending written legal/bank gates and explicit owner activation. | P5.5 | Flag default false in every environment; activation requires documented owner approval; tests assert the guard. |

**External dependencies:** `DEC-O2` timings sign-off before P5.2; `DEC-O3` legal/bank; `DEC-O4` VPA validation; `DEC-A02`/`DEC-A04` interpretations.

**Phase 5 exit criteria:** all mandatory spec Phase 5 and §18 criteria pass — exactly one active reservation; idempotent replay/conflict; safe release/re-reservation; no reopening after PAID; recipient-only confirmation; idempotent timeout workers under locks; karma once after confirmation; late-payment UX/runbook visible; all critical concurrency tests green; real-money flag OFF.

---

## 9. Phase 6 — Trust, safety, moderation and operational support

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P6.1 | Wish/user reports; reason enum; one report per reporter/target; rate limits; duplicate/abuse tests. | P2, P5 | Duplicate report does not increment; all reasons validated; reporter identity private. |
| P6.2 | Block/unblock; discovery and interaction exclusion both directions. | P6.1 | Blocked users cannot discover or interact; tests cover feed, detail, gift, report. |
| P6.3 | Auto-hide threshold (3 unique reports) and moderation queue; no proof-of-wrongdoing claim. | P6.1 | Threshold hides once; duplicate does not count; queue is moderator-only. |
| P6.4 | Minimum protected admin/moderator area in the same Next.js app. | P2 | Admin routes require admin role; no public exposure; loading/empty/error states. |
| P6.5 | RBAC, admin MFA (`DEC-I13`), mandatory reason, append-only `admin_audit_logs` with request ID. | P6.4 | MFA enforced; unauthorised role rejected; every action audited; audit log immutable via API. |
| P6.6 | Warn/restrict/suspend/ban and wish restore/remove with state guards; `DEC-O7` cooldown rule. | P6.3–P6.5 | Actions cannot bypass wish/gift invariants; state guards tested; users notified appropriately. |
| P6.7 | Basic appeal/support workflow and dispute visibility; admin investigation view. | P6.6 | Appeal linked to action; dispute data visible only to authorised staff; no sensitive payment data in UI logs. |
| P6.8 | Account deletion request workflow; retention-safe anonymisation subject to counsel approval (`DEC-O8`). | P2, P6.5 | Request recorded; no destructive deletion before policy approval; financial/audit records preserved. |
| P6.9 | In-app notifications for gift claim, confirmation/dispute, wish status, moderation and restriction; inbox + read state. | P5, P6.1 | Critical events produce deduplicated notifications; no VPA/phone/UTR/URI in payloads. |
| P6.10 | Durable outbox dispatcher, retry/backoff, dead-letter visibility and alerting hooks; duplicate delivery safe. | P5.4 | Outbox survives worker crash; duplicate jobs do not duplicate effects; dead letters observable. |
| P6.11 | Runbooks: disputes, late payment, OTP outage, VPA change, moderation escalation, restore, privacy/security incident. | P6.1–P6.10 | Runbooks reviewed; a staging exercise recorded for at least the critical payment/dispute path. |

**Phase 6 exit criteria:** spec Phase 6 criteria — users can report/block; moderators act with authorization/audit; admin actions cannot bypass gift/wish state invariants; critical notifications durable/deduplicated; deletion respects approved retention; support resolves cases without exposing secrets; runbooks reviewed/exercised in staging.

---

## 10. Phase 7 — Karma, retention loops and discovery enhancements

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P7.1 | Karma balance/history projection from the immutable ledger; no cached balance as source of truth. | P5.12 | Rebuild reproduces balance; no cash value/redemption; duplicate events do not duplicate balance. |
| P7.2 | Streak calculation with explicit `Asia/Kolkata` day boundaries; no UTC-day shortcuts. | P7.1 | Tests across UTC midnight/DST-free IST boundary; duplicate confirmed gifts on one day count once. |
| P7.3 | Badge rules and idempotent award processing; `UNIQUE(user_id, badge_code)`. | P7.1 | Duplicate jobs cannot duplicate badges; rules documented. |
| P7.4 | Thank-you reaction (🙏/❤️/😊) and optional ≤120-char message; participants-only; no open chat. | P5.8 | Non-participant rejected; message validated; donor identity never exposed. |
| P7.5 | Privacy-safe share cards with no donor identity or private payment data. | P5, P7.4 | Share payload allow-list tested; no phone/VPA/UTR/URI; accessibility of card. |
| P7.6 | Surprise Me eligibility, session skips, weighted fairness (3x/0.25x/1x) and exclusion rules; resolve `DEC-A01`. | P4 | Ineligible wishes excluded; weights documented/tested statistically or deterministically; no own/blocked candidates. |
| P7.7 | Exposure records/caps only if the validated fairness policy requires them. | P7.6 | Exposure writes idempotent; caps enforced if enabled; no premature data collection beyond policy. |
| P7.8 | Optional push/SMS delivery enhancements only with providers and consent; in-app remains source of truth. | P6.9 | Consent respected; provider failure never changes domain state; no sensitive data in previews. |

**Phase 7 exit criteria:** spec Phase 7 criteria — karma has no cash value; duplicate jobs cannot duplicate karma/streaks/badges; IST boundaries tested; donor identity never exposed in thank-you/share surfaces; Surprise Me excludes ineligible wishes and applies documented weights; optional channels respect consent/configuration.

---

## 11. Phase 8 — Hardening, launch readiness and Bengaluru beta

| Task | Repository-specific work | Depends | Acceptance criteria |
|---|---|---|---|
| P8.1 | Threat model and security review of auth, gift, admin, payments, privacy surfaces. | All | Findings triaged; no unresolved critical/high without explicit owner risk acceptance. |
| P8.2 | Dependency, secret, container and static-analysis scans. | All | Scans run in CI; findings triaged; no secrets in images/repo. |
| P8.3 | Load tests for feed, auth, gift creation and critical workflows using agreed beta assumptions. | P5, P8.8 | p95 targets measured; no invariant violations under load; results recorded. |
| P8.4 | Verify rate limits, abuse protections and graceful degradation (DB/Redis/provider outages). | P2, P5, P6 | Limits work; Redis outage safe; dependency failure returns honest 503; no false success. |
| P8.5 | Backup and restore drill; owner-approved RPO/RTO. | P8.8 | Restore succeeds within target; evidence recorded; encryption verified. |
| P8.6 | Metrics, dashboards, alerts and on-call ownership. | P1.9, P6.10 | Key signals covered: errors, latency, worker lag, outbox/dead letters, DB health; ownership named. |
| P8.7 | Accessibility, responsive UX and supported mobile browser verification. | P4.6, P5.14 | WCAG 2.2 AA primary journeys checked; keyboard/screen reader/touch/reduced motion; browser matrix recorded. |
| P8.8 | Production deployment and rollback/forward-fix rehearsal. | All | Immutable artefacts; backward-compatible migration; rollback/forward-fix exercised in staging. |
| P8.9 | Legal review, written bank/payment-partner position, Terms/Privacy/Guidelines, grievance channel, retention approval. | External | Documents exist and are linked; no gate assumed; owner sign-off recorded. |
| P8.10 | UPI URI/QR testing across target apps/devices; document limitations. | P5.5 | Matrix recorded; known limitations in UX/support runbook; no success claimed where unknown. |
| P8.11 | Explicit owner approval to enable the real-money feature flag. | P8.9, P8.10 | Written approval recorded; flag change audited; can be disabled immediately. |
| P8.12 | Internal alpha, then closed Bengaluru beta with daily safety/support review. | P8.1–P8.11 | Alpha exits; beta thresholds and daily review recorded; rollback plan live. |

**Phase 8 exit criteria:** spec §11/§18 gates — no open critical/high security findings without explicit risk acceptance; backup restore and incident runbooks exercised; monitoring/support ownership live; legal and partner approvals documented (not assumed); real-money activation explicitly approved; rollout can be paused/rolled back; beta exit metrics and safety thresholds defined.

---

## 12. Cross-phase engineering standards

Every behaviour-changing task must include:

- [ ] Acceptance criteria.
- [ ] Unit tests for business rules.
- [ ] Integration tests for persistence and API behaviour.
- [ ] Authorization and privacy tests where relevant.
- [ ] Failure/timeout/retry behaviour.
- [ ] Migration and rollback/forward-fix consideration.
- [ ] API documentation updates.
- [ ] Logs/metrics that exclude sensitive data.
- [ ] User-facing loading, empty, success and error states.
- [ ] Relevant documentation and runbook updates.

Additional repository rules:

- Every database mutation is validated server-side; frontend validation is never authoritative.
- Every async job is idempotent, observable, retry-safe and safe under duplicate delivery.
- Every public DTO is explicitly constructed; no ORM entity serialisation.
- No sensitive value is ever logged, even during debugging.
- Redis is never a correctness boundary.
- Real-money handoff remains disabled unless the Phase 8 gates are met.

---

## 13. Backlog change control

1. The plan's task counts (10, 9, 10, 7, 15, 11, 8, 12) remain the baseline. This backlog adds detail, not unapproved scope.
2. If a new task is genuinely required, add it with an ID (e.g., P5.16) and explain the scope change in `IMPLEMENTATION_STATUS.md` and `CHANGELOG.md`. Do not silently drop a plan task.
3. If a task is deferred, record the owner approval and the reason.
4. Any decision in `DECISIONS.md` that remains `PENDING` and blocks a task makes that task `BLOCKED`, not `DONE` by assumption.
5. No schedule or effort estimates are asserted until the owner requests them.
