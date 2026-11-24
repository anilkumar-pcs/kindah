# Test Evidence — Chillar / Kindly

**Last updated:** 2026-11-23
**Environment:** macOS 15.8.3 (arm64); working directory `/Users/pcsanilkumar/Work/kindah`
**Application state:** No application code exists. No automated application tests can run. Records below are Phase 0 inspection and documentation evidence.

## Evidence records

### VE-001 — P0.1 repository inventory

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P0.1 |
| Command | `find . -type f -not -path './.git/*' -not -path './node_modules/*' -not -path './.venv/*' -not -path './venv/*' -not -path '*/__pycache__/*' \| sort` |
| Environment | macOS 15.8.3, arm64 |
| Result | **PASS** — inspection completed |
| Output/artefact | Seven files only: `CLAUDE.md`; `docs/implementation/{CHANGELOG,DECISIONS,IMPLEMENTATION_PLAN,IMPLEMENTATION_STATUS,TEST_EVIDENCE}.md`; `docs/product/Chillar_Kindly_Development_Ready_Specification_v1.1.docx` |
| Known limitation | At inspection time the folder was `docs/implmentation`; renamed later (VE-005). |

### VE-002 — P0.2 version-control and test inventory

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P0.2 |
| Command | `git status`; `find backend frontend -type f \| wc -l` |
| Environment | macOS 15.8.3, arm64 |
| Result | **PASS (finding confirmed)** — no git repository; zero backend/frontend files |
| Output/artefact | `fatal: not a git repository (or any of the parent directories): .git`; file count `0` |
| Known limitation | No history exists, so preservation was verified by backup and explicit file inventory rather than diff. |

### VE-003 — P0.3 toolchain probe

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P0.3 |
| Command | `for c in python3 python3.12 python3.13 uv poetry pipx node npm pnpm yarn docker psql redis-server redis-cli git brew colima podman; do …; done` |
| Environment | macOS 15.8.3, arm64 |
| Result | **PASS** — toolchain state captured |
| Output/artefact | Python 3.9.6; Python 3.12/3.13 absent; uv/poetry/pipx absent; Node v26.13.1; npm 11.20.0; pnpm/yarn absent; Docker/Colima/Podman absent; psql/redis-server/redis-cli absent; git 2.39.5; Homebrew 7.0.15 |
| Known limitation | Reflects this machine only; other developer and CI environments may differ. |

### VE-004 — Specification extraction and review

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P0.4, P0.5 |
| Command | `textutil -convert txt -output /tmp/kindah-spec/spec.txt "docs/product/Chillar_Kindly_Development_Ready_Specification_v1.1.docx"` |
| Environment | macOS `textutil` |
| Result | **PASS** — 943 lines / 52,158 bytes extracted and reviewed in full |
| Output/artefact | `/tmp/kindah-spec/spec.txt` (derived, non-authoritative) |
| Known limitation | Tables were flattened by text conversion; the `.docx` remains authoritative. The derived text is outside the repository. |

### VE-005 — Phase 0 documentation and path correction

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P0.6, P0.7, P0.8, P0.9 |
| Procedure | Created `REPOSITORY_ASSESSMENT.md`, `ARCHITECTURE.md`, populated `DECISIONS.md`, created `IMPLEMENTATION_BACKLOG.md`; backed up `docs/` to `/tmp/kindah-docs-backup-20261123-223328`; renamed `docs/implmentation` to `docs/implementation`. |
| Environment | macOS 15.8.3, arm64 |
| Result | **PASS (manual verification)** — files exist with expected content; all original docs preserved |
| Output/artefact | Four Phase 0 documents; backup directory; folder listing shows `docs/implementation/` with five markdown files |
| Known limitation | No git diff is available because the repository is not initialized. |

### VE-006 — Automated tests

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | All Phase 0 |
| Command | None applicable |
| Environment | — |
| Result | **N/A** — no application code, test framework or database exists |
| Output/artefact | None |
| Known limitation | No runtime, API, migration, concurrency, security or privacy test has been executed. Phase 1 establishes the test harness. |

### VE-007 — Phase 1 dependency installation

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.1, P1.2 |
| Command | `brew install uv postgresql@16 redis actionlint`; `uv python install 3.12` |
| Environment | macOS 15.8.3, arm64 |
| Result | **PASS** |
| Output/artefact | uv 0.13.9; Python 3.12.16; PostgreSQL 16.16; Redis 8.12.0; actionlint 1.7.12; `kindah_dev` and `kindah_test` created |
| Known limitation | Docker/Colima is not installed; container image builds are deferred to a later phase. |

### VE-008 — Backend test suite

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.3, P1.5, P1.7, P1.9 |
| Command | `cd backend && uv run pytest` |
| Environment | Python 3.12.16; PostgreSQL 16.16 `kindah_test` |
| Result | **PASS** — 27 passed |
| Output/artefact | `tests/{unit,integration}`; warnings: one Starlette TestClient deprecation notice (non-blocking) |
| Known limitation | GitHub Actions execution not yet observed; local equivalent passes. |

### VE-009 — Backend lint, format and type checks

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.7 |
| Command | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests` |
| Environment | Python 3.12.16 |
| Result | **PASS** — Ruff all checks passed; 21 files formatted; mypy no issues in 20 source files |
| Output/artefact | Terminal output recorded in session |
| Known limitation | None. |

### VE-010 — Alembic migration cycle

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.5 |
| Command | `cd backend && uv run alembic upgrade head && uv run alembic downgrade base && uv run alembic upgrade head && uv run alembic current` |
| Environment | PostgreSQL 16.16 `kindah_dev` |
| Result | **PASS** — `0001_baseline (head)` after up/down/up |
| Output/artefact | Alembic output; migration test `test_upgrade_downgrade_upgrade` also passes |
| Known limitation | Baseline migration creates only Alembic bookkeeping; domain tables arrive with their owning phases. |

### VE-011 — API smoke test

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.3, P1.6, P1.9 |
| Command | Start `uv run uvicorn app.main:app --port 8000`; `curl /healthz`, `/readyz`, `/api/v1/meta`, an unknown route |
| Environment | Local; PostgreSQL and Redis running |
| Result | **PASS** — health 200; readiness `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`; meta returns service/version/environment; 404 is `application/problem+json` with request ID and security headers |
| Output/artefact | JSON responses; structured logs with no sensitive values |
| Known limitation | Manual smoke check, not an automated E2E suite. |

### VE-012 — Frontend quality gate

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.4, P1.7 |
| Command | `cd frontend && npm run lint && npm run format && npm run typecheck && npm test && npm run build` |
| Environment | Node 26.13.1, npm 11.20.0, Next.js 16.4.6 |
| Result | **PASS** — ESLint clean; Prettier clean; TypeScript clean; 6 Vitest tests pass; production build succeeds |
| Output/artefact | Build routes `/`, `/sign-in`, `/wishes/[id]`, `/manifest.webmanifest`, `/_not-found` |
| Known limitation | CI uses Node 22 while local validation used Node 26; both are within the project’s supported range and should be exercised when a remote CI runner exists. |

### VE-013 — Full-stack browser verification

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.4 |
| Procedure | Started API on 8000 and Next.js production server on 3000; opened `http://localhost:3000` in Chrome DevTools; inspected network/console; screenshotted desktop and 390 px mobile |
| Environment | Chrome; local services |
| Result | **PASS** — page HTTP 200 and correct title; manifest served; `GET http://localhost:8000/api/v1/meta` returned 200; no console errors/warnings; service status rendered “Service online — kindly-api v0.1.0 (local)”; mobile layout has no horizontal overflow |
| Output/artefact | `.artifacts/phase1-desktop.png`, `.artifacts/phase1-mobile.png` (gitignored) |
| Known limitation | Screenshots are local artefacts and not committed. |

### VE-014 — CI workflow syntax

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.8 |
| Command | `actionlint .github/workflows/ci.yml` |
| Environment | actionlint 1.7.12 |
| Result | **PASS** |
| Output/artefact | Workflow defines backend PostgreSQL-service lint/format/type/test and frontend lint/format/type/test/build jobs |
| Known limitation | The workflow has not executed on GitHub Actions because the repository has no remote/runner yet. All equivalent steps pass locally. |

### VE-015 — Fresh-clone setup and validation

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Phase/task | P1.1, P1.10 (Phase 1 exit criteria) |
| Procedure | `git clone` the repository to a new `/tmp/kindah-phase1-verify-*` directory; `cp .env.example .env`; `cp frontend/.env.example frontend/.env.local`; `make setup`; `make migrate`; `make check`; `cd frontend && npm run build` |
| Environment | macOS 15.8.3 arm64; Python 3.12.16; Node 26.13.1; PostgreSQL 16.16; Redis 8.12.0 |
| Result | **PASS** — dependency installation, migration, Ruff, ESLint, Prettier, mypy, TypeScript, 27 backend tests, 6 frontend tests and production build all pass from a clean clone |
| Output/artefact | Fresh clone at `/tmp/kindah-phase1-verify-20261123-230455` |
| Known limitation | This first fresh-clone run found and fixed a generated-type dependency in `layout.tsx` (commit `2991941`). GitHub Actions execution still requires a remote runner; `actionlint` passes and every CI step passes locally. |

### VE-016 — Identity migration cycle

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P2.1–P2.7 |
| Command | `cd backend && uv run alembic upgrade head`; pytest migration test on isolated `kindah_migration_test` (upgrade → downgrade → upgrade) |
| Environment | PostgreSQL 16.16 |
| Result | **PASS** — `0002_identity (head)`; enum + `users`, `user_sessions`, `otp_challenges`, `auth_events` created and dropped cleanly |
| Output/artefact | `test_migrations.py::test_upgrade_downgrade_upgrade` |
| Known limitation | Migration test creates its own PostgreSQL database; the CI role must allow `CREATE DATABASE`. |

### VE-017 — Phase 2 backend tests and quality checks

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P2.1–P2.8 |
| Command | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest` |
| Environment | Python 3.12.16; PostgreSQL 16.16 `kindah_test` |
| Result | **PASS** — 78 tests passed; Ruff, format and mypy clean |
| Output/artefact | Unit tests: phone normalization, OTP/JWT, AES-GCM, config; integration tests: OTP flow, duplicate phone, consent, profile, sessions, rotation/reuse, CSRF, rate limits, expiry, account status, audit privacy |
| Known limitation | One non-blocking Starlette TestClient deprecation warning. |

### VE-018 — Phase 2 browser validation

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P2.9 |
| Procedure | Started API + Next.js; entered `9876543210`; test OTP `123456`; checked all consent boxes; set display name `ChaiExplorer`, avatar Chai, city Bengaluru; submitted; reloaded `/sign-in` to verify refresh-session restore |
| Environment | Chrome DevTools; local API/web |
| Result | **PASS** — OTP request 202, verify 200, consent 200, profile 200; “Welcome, ChaiExplorer” rendered; reload restored the session via `/auth/refresh` + `/me`; no console errors after fix |
| Output/artefact | `.artifacts/phase2-signed-in.png` (gitignored) |
| Known limitation | Browser validation found a real CORS defect: `X-CSRF-Token` was missing from `allow_headers`, blocking refresh preflight. Fixed in `main.py` and covered by a regression test. |

### VE-019 — Phase 2 frontend tests and build

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P2.9 |
| Command | `cd frontend && npm run lint && npm run format && npm run typecheck && npm test && npm run build` |
| Environment | Node 26.13.1; Next.js 16.4.6 |
| Result | **PASS** — ESLint/Prettier/TypeScript clean; 11 Vitest tests pass; production build succeeds |
| Output/artefact | Sign-in flow tests cover OTP → consent → profile, missing-consent rejection and session restore; API client tests cover bearer auth and refresh-and-retry |
| Known limitation | Local Node 26 vs CI Node 22; both within the documented range. |

### VE-020 — Payment-method and wish migration

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P3.1–P3.9 |
| Command | `cd backend && uv run alembic upgrade head`; pytest migration test on isolated `kindah_migration_test` (upgrade → downgrade → upgrade) |
| Environment | PostgreSQL 16.16 |
| Result | **PASS** — `0003_payment_wishes (head)`; enums/tables/indexes created and dropped cleanly; `users.last_authenticated_at` backfilled |
| Output/artefact | `test_migrations.py::test_upgrade_downgrade_upgrade` |
| Known limitation | Migration test requires `CREATE DATABASE` permission in CI. |

### VE-021 — Phase 3 backend tests and quality checks

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P3.1–P3.9 |
| Command | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest` |
| Environment | Python 3.12.16; PostgreSQL 16.16 `kindah_test` |
| Result | **PASS** — 126 tests passed; Ruff, format and mypy clean |
| Output/artefact | VPA syntax/mask, encryption, duplicate/versioning/reauth, authz, wish validation/amount/mood/city, one-active-wish partial index, withdrawal/cooldown and idempotent expiry-worker tests |
| Known limitation | One non-blocking Starlette TestClient deprecation warning. |

### VE-022 — Phase 3 browser validation

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P3.10 |
| Procedure | Opened `/me`; saved `chai.explorer@okhdfc` with privacy acknowledgement; verified masked `ch***@okhdfc`; published a LONG_DAY wish with ₹25 and Bengaluru; withdrew it; verified EXPIRED + 72h cooldown; followed the forced re-authentication path via `/reauth` |
| Environment | Chrome DevTools; local API/web |
| Result | **PASS** — payment-method 200, wish create 201, withdraw 200; UI showed masked VPA, active wish and cooldown; no console errors after final reload |
| Output/artefact | `.artifacts/phase3-my-space-final.png` (gitignored) |
| Known limitation | Browser validation found and fixed two UX/framework issues: no re-authentication path for VPA changes, and a Next.js cache-components warning from reading `searchParams` (replaced with `/reauth`). A 404 for “no payment method yet” is an expected fetch and may appear in devtools. |

### VE-023 — Phase 3 frontend tests and build

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P3.10 |
| Command | `cd frontend && npm run lint && npm run format && npm run typecheck && npm test && npm run build` |
| Environment | Node 26.13.1; Next.js 16.4.6 |
| Result | **PASS** — ESLint/Prettier/TypeScript clean; 15 Vitest tests pass; production build includes `/me` and `/reauth` |
| Output/artefact | My Space tests cover masked VPA save, wish publish and withdraw-to-cooldown; sign-in tests cover forced re-authentication |
| Known limitation | Local Node 26 vs CI Node 22. |

### VE-024 — Discovery migration and backend tests

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P4.1–P4.7 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest` |
| Environment | PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — `0004_discovery (head)`; 133 tests passed; Ruff, format and mypy clean |
| Output/artefact | `user_blocks`, feed index, cursor pagination (Fresh/Random), exclusions, public DTO, detail/select auth gate and block tests |
| Known limitation | One non-blocking Starlette TestClient deprecation warning. |

### VE-025 — Phase 4 browser validation

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P4.6, P4.5 |
| Procedure | Opened the home feed in an isolated guest browser context; saw the seeded public wish; opened wish detail; clicked “Select this wish” as a guest; verified the sign-in prompt |
| Environment | Chrome DevTools; local API/web |
| Result | **PASS** — feed 200, detail 200, select 401 → “Sign in to select”; no sensitive fields rendered; no console errors after removing dynamic metadata/params from the server-rendered route |
| Output/artefact | `.artifacts/phase4-wish-detail.png` (gitignored) |
| Known limitation | The expected 401 appears in devtools. Dynamic wish-detail metadata was replaced with client-side `useParams` to satisfy Next.js cache-components. |

### VE-026 — Phase 4 frontend tests and build

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P4.6 |
| Command | `cd frontend && npm run lint && npm run format && npm run typecheck && npm test && npm run build` |
| Environment | Node 26.13.1; Next.js 16.4.6 |
| Result | **PASS** — ESLint/Prettier/TypeScript clean; 21 Vitest tests pass; production build succeeds |
| Output/artefact | Feed/detail tests cover cards, empty state, load-more, selection success, guest sign-in gate and unavailable state |
| Known limitation | Local Node 26 vs CI Node 22. |

### VE-027 — Fresh-clone validation after Phases 3 and 4

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | Phase 3/4 exit criteria |
| Procedure | Pulled the committed repository into the fresh clone; ran `make migrate`, `make check`, `npm run build` |
| Environment | Fresh clone; PostgreSQL 16.16; Python 3.12.16; Node 26.13.1 |
| Result | **PASS** — migrations, 133 backend tests, 21 frontend tests, lint/type/format and build all pass |
| Output/artefact | `/tmp/kindah-phase1-verify-20261123-230455` |
| Known limitation | GitHub Actions remote execution remains pending. |

### VE-028 — Phase 5 gift/reservation backend and state-machine tests

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P5.1–P5.9, P5.11, P5.12, P5.15 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest` |
| Environment | PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — `0005_gifts (head)`; **145 backend tests passed**; Ruff, format and mypy clean |
| Output/artefact | 12 gift tests: handoff/views, idempotent replay/conflict, two concurrent donors (one 201/one 409), PAID consumes reservation, FAILED after PAID rejected, STILL_PROCESSING once, FAILED release/re-reservation, recipient confirmation + karma once (30 donor/3 recipient), dispute no karma, recipient-only confirmation, expiry reopen, DONOR_PENDING never reopens, PAID survives expiry and becomes UNVERIFIED with no karma |
| Known limitation | True simultaneous PAID-vs-expiry and confirmation-vs-timeout races are not yet instrumented; P5.10 late-payment support path and P5.14 UI remain open. Phase 5 is **not** DONE. |

### VE-029 — Phase 5 late-payment support, admin resolution and true race tests

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P5.10, P5.13 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q` |
| Environment | PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — `0006_support_cases (head)`; **149 backend tests passed**; Ruff, format and mypy clean |
| Output/artefact | 2 support-case integration tests; 14 gift tests including true simultaneous PAID-vs-expiry and recipient-confirmation-vs-timeout races; support API creates participant cases, rejects duplicates/non-participants, denies non-admins, exposes gift/payment detail to admins, masks VPA, rejects double resolution and redacts audit metadata |
| Known limitation | Admin authorization is an environment allow-list, not production RBAC/MFA (Phase 6). P5.14 gift UI remains open; Phase 5 is **not** DONE. |

### VE-030 — Phase 5 donor/recipient gift UI and full-stack validation

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P5.14 (completes Phase 5) |
| Command | `cd frontend && npm test && npm run lint && npm run typecheck && npm run build`; browser flows at `http://localhost:3000` against `http://localhost:8000` |
| Environment | Next.js 16.4.6; React 19.3.0; Node 26; PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — 31 frontend tests across 8 files; ESLint, Prettier, TypeScript and production build clean; full donor→recipient browser journey succeeded |
| Browser journey | Recipient PriyaRecipient signed in, saved a masked UPI ID and published a ₹25 wish. Donor ArjunDonor selected it in an isolated browser context, chose the suggested ₹25, reviewed the bank-name/no-custody disclosures, created the UPI handoff, opened the `upi://pay` link, entered a UTR and attested “Donor says paid”. Status became “Awaiting recipient confirmation”. Recipient saw the separate 24-hour response deadline, reacted Heart, added a thank-you note and confirmed receipt; status became “Recipient confirmed”. Both My Space gift histories linked to the gift. Recipient opened a support case from the gift and the UI showed `OPEN` with a reference. |
| Automated coverage | New `gift-flow.test.tsx` (5 assertions across 4 tests), `gift-detail.test.tsx` (5 tests), My Space gift-history test and wish-detail entry-link assertion; all existing 21 tests remain green. |
| Privacy checks | Recipient response omits donor identity and UPI handoff; donor sees recipient pseudonym only; recipient view omits `upiIntentUri`/`qrPayload`; support copy warns against sharing UPI ID or phone. Admin details remain API-only pending Phase 6. |
| Known limitation | Full admin RBAC/MFA UI, moderation controls and accessibility/browser-matrix sign-off remain Phase 6/8. Real-money handoff remains disabled. |

### VE-031 — Phase 6 reporting, rate limiting and blocking

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.1, P6.2 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0007_moderation_reports (head)`; **152 backend tests**, **34 frontend tests**; Ruff, format, mypy, ESLint, Prettier, TypeScript and production build clean |
| Automated coverage | New `test_safety.py`: duplicate wish report returns the original with one DB row; all reason enum validation; self/missing target rejection; hourly cap returns 429; block idempotency; blocked list; two-way feed/detail/select/gift/report exclusion; self-block rejection; unblock restores discovery; wish-scoped block-owner aliases. Frontend covers report submission, block feedback, blocked-account listing and unblock. |
| Browser journey | Donor ArjunDonor reported ChaiExplorer's open wish with “Spam or bot”, saw the private-report/no-proof-of-wrongdoing message, blocked the owner, then found ChaiExplorer under My Space → Blocked accounts and unblocked. |
| Privacy checks | Report responses contain target/reason/status only, no reporter identity or display name; audit metadata has no free text; blocking excludes both users in both directions; no user IDs are added to public wish cards. |
| Known limitation | The moderator queue/admin UI (P6.3–P6.5) is not built yet; reports remain OPEN and no auto-hide is applied. |

### VE-032 — Phase 6 auto-hide threshold and moderator review queue

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.3 |
| Command | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q` |
| Environment | PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — **153 backend tests**; Ruff, format and mypy clean |
| Output/artefact | Two unique reports plus a duplicate leave the wish OPEN; the third unique report atomically moves it to UNDER_REVIEW; a fourth unique report does not create a second `WISH_AUTO_HIDDEN` audit event. Hidden wish is absent from guest feed and participant detail. `/admin/reports` returns target display name, message preview, status and unique report count; non-admin receives 403; no reporter identity, phone, VPA or report free text is exposed. |
| Known limitation | Admin queue is API-only until P6.4/P6.5; moderation actions and restore are P6.6. |

### VE-033 — Phase 6 protected admin console, RBAC, MFA and append-only audit

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.4, P6.5 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0008_admin_rbac_mfa (head)`; **156 backend tests**, **38 frontend tests**; all lint, format, type and build checks clean |
| Automated coverage | Role denial for ordinary users; admin role resolution via DB and local allow-list; MFA setup/enable/verify; wrong-code rejection; TOTP step replay rejection; recovery code works once then fails; status remaining count; admin endpoints require a session-bound `X-Admin-MFA`; audit action list excludes secrets; update SQL against `admin_audit_logs` is rejected by the DB trigger; support resolution writes decrypted admin audit reason and request ID. Frontend covers denied role, setup enrollment, returning verification and support resolution. |
| Browser journey | Local ArjunDonor admin enrolled TOTP (QR/manual secret), received ten one-time recovery codes, unlocked the console, saw the report queue, opened the full support case (participants, amount, masked VPA, UTR, payment reference), resolved it with a note, and viewed `ADMIN_MFA_ENABLED` + `SUPPORT_CASE_RESOLVED` audit entries with request IDs. CORS preflight for `X-Admin-MFA` fixed and regression-tested. |
| Known limitation | DEC-I13 remains an implemented recommended default pending owner confirmation; production admin activation is blocked. DB-role assignment is operational, not yet an admin role-management UI. Moderation actions/restore are P6.6. |

### VE-034 — Phase 6 moderation actions and state guards

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.6 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0009_moderation_actions (head)`; **158 backend tests**, **39 frontend tests**; all lint, format, type and build checks clean |
| Automated coverage | WARN increments trust strikes; RESTRICT blocks wish creation with `ACCOUNT_RESTRICTED`; REACTIVATE restores; SUSPEND→RESTRICT rejected; BAN works; self-moderation rejected; moderator/admin target guards. Wish HIDE→UNDER_REVIEW, RESTORE→OPEN only when unexpired and no unresolved gift, REMOVE→REMOVED with no cooldown (DEC-O7 provisional); expired restore and unresolved-gift removal rejected; encrypted moderation/audit reasons and request IDs. Frontend action form covers hide with mandatory reason. |
| Browser journey | Local admin verified TOTP, hid ChaiExplorer's reported wish from the queue (status changed to UNDER_REVIEW and audit count rose), then restored it to OPEN with a second mandatory-reason action. No console errors. |
| Privacy checks | Reasons encrypted in both `moderation_actions` and `admin_audit_logs`; API returns them only through MFA-protected admin endpoints; no VPA/phone/UTR in action logs. |
| Known limitation | DEC-O7 remains an implemented recommended default pending owner confirmation. Appeals and user notifications are P6.7/P6.9. |

### VE-035 — Phase 6 appeals and dispute visibility

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.7 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0010_moderation_appeals (head)`; **159 backend tests**, **43 frontend tests**; all lint, format, type and build checks clean |
| Automated coverage | Warnings are not appealable; one appeal per action (`409` on duplicate); restricted user submits and reads own appeal; non-admin gets `403` on `/admin/appeals`; admin queue includes user, original action/reason and appeal reason; ACCEPTED resolution is audited and cannot be resolved twice; account status is not silently changed by appeal acceptance; banned user can read own moderation actions and file an appeal while interactive actions remain blocked; appeal text encrypted at rest; admin dispute/support data remains MFA-protected. Frontend covers guest, appeal submit and resolved-appeal display plus admin resolution. |
| Privacy checks | Appeal and resolution text encrypted; `/me` appeal payloads expose only the user’s own actions; admin queues require role + MFA; no phone/VPA/UTR/payment data in appeals. |
| Known limitation | Appeals do not automatically reverse account actions; staff must apply a separate audited reactivation. Retention/deletion is P6.8. |

### VE-036 — Phase 6 non-destructive account deletion workflow

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.8 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0011_account_deletion_requests (head)`; **161 backend tests**, **47 frontend tests**; all lint, format, type and build checks clean |
| Automated coverage | Active wish and unresolved gift block requests with `409 ACTIVE_TRANSACTIONS`; request sets `DELETION_PENDING`, duplicate is idempotent, normal wish creation is blocked by account status; cancellation restores `ACTIVE`; admin queue is role+MFA protected and shows display name/status/decrypted reason; no user or financial/audit rows are deleted; database assertion confirms the request reason is encrypted. Frontend covers guest, request, pending, cancel and active-transaction error. |
| Privacy checks | Optional reason encrypted at rest; admin queue MFA-only; no destructive anonymisation or deletion; financial/audit records preserved. |
| Known limitation | Actual deletion/anonymisation is intentionally unimplemented until DEC-O8 retention approval. Notifications/outbox/runbooks remain P6.9–P6.11. |

### VE-037 — Phase 6 in-app notifications

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.9 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0012_notifications (head)`; **164 backend tests**, **50 frontend tests**; all lint, format, type and build checks clean |
| Automated coverage | Gift PAID creates one recipient notification; confirmation creates one donor notification; duplicate dedupe key inserts once; unread count/read/read-all work; expiry worker notifies owner; moderation, appeal, auto-hide and support resolution create their respective notifications. Gift notification JSON contains no UPI URI, UTR, phone or VPA. Frontend covers guest, unread/read and mark-all. |
| Privacy checks | Notification copy is server-authored; payloads contain entity IDs/action only; no private payment data. Inbox uses own-user filtering and `get_current_auth`, so restricted/banned users can read moderation notices. |
| Known limitation | Delivery is in-app only; no push/SMS (P7.8 requires providers/consent). Outbox delivery remains P6.10. |

### VE-038 — Phase 6 durable outbox dispatcher

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.10 |
| Command | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q` |
| Environment | PostgreSQL 16.16; Python 3.12.16 |
| Result | **PASS** — **168 backend tests**; Ruff, format and mypy clean |
| Automated coverage | Successful events mark `processed_at`; a second dispatch performs no duplicate handler call; failures increment attempts and set future backoff; the attempt cap dead-letters with an alert callback; dead letters are not reselected; two concurrent dispatchers claim a row exactly once under `FOR UPDATE SKIP LOCKED`; MFA admin dead-letter endpoint lists the event and rejects missing MFA. |
| Known limitation | Default handler validates known event types; external push/SMS delivery adapters are P7.8 and must be idempotent. |

### VE-039 — Phase 6 runbooks and critical-path staging exercise

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P6.11 |
| Command | `dropdb --if-exists kindah_staging_exercise; createdb kindah_staging_exercise; cd backend && DATABASE_URL='postgresql+psycopg://localhost:5432/kindah_staging_exercise' uv run alembic upgrade head`; then a TestClient exercise against the staging DB |
| Environment | Separate PostgreSQL database `kindah_staging_exercise`; staging settings; Python 3.12.16 |
| Result | **PASS** — migrations reached `0012_notifications`; exercise output: `giftStatus=DISPUTED`, `caseStatus=RESOLVED`, admin audit `SUPPORT_CASE_RESOLVED`/`ADMIN_MFA_ENABLED`, donor notification `GIFT_DISPUTED`, recipient notifications `SUPPORT_CASE_RESOLVED`/`GIFT_CLAIMED`; serialized admin payloads contained no UPI URI or raw VPA |
| Artefact | `RUNBOOK_OPERATIONS.md` (disputes, late payment, OTP outage, VPA change, moderation, deletion, outbox, restore, privacy/security) and `RUNBOOK_LATE_PAYMENT.md` |
| Known limitation | This is a separate local staging database, not a deployed staging environment; deployed staging, approved RPO/RTO and provider/legal gates remain external. |

### VE-040 — Phase 7 karma, streaks, reactions, share cards and Surprise Me

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P7.1–P7.6 |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0013_user_badges (head)`; **173 backend tests**, **53 frontend tests**; all lint, format, type and build checks clean |
| Karma/streak/badges | Donor balance 30 (25 first confirmed + 5 first-time recipient) and recipient 3 (thanks) projected from ledger; profile and `/me/karma` agree; FIRST_GIFT/GRATEFUL badges awarded once and re-award is a no-op; streak is 1 for same IST day across UTC midnight, 3 for three consecutive IST days, and 0 with no days. Badge thresholds are FIRST_GIFT 1, KIND_HEART 5, KIND_SOUL 10, GRATEFUL thanks, STREAK_3. |
| Reactions/share | Recipient reaction/thank-you returned to participants only; share card requires recipient confirmation, is participant-only, and contains no donor identity, VPA, phone, UTR, payment ref or UPI URI. |
| Surprise Me | Own/blocked/expired/session-skipped wishes excluded; weights are 3× never received, 0.25× received within 14 days, 1× otherwise; frontend records skipped IDs in session storage and navigates to the selected wish. |
| Known limitation | Badge thresholds (B-014) and exposure-cap policy (B-015) remain provisional/undecided; no push/SMS delivery was added because providers/consent are absent. |

### VE-041 — Phase 8 threat model and security/dependency scans

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P8.1, P8.2 |
| Command | `cd frontend && npm audit --json`; `cd backend && uvx pip-audit`; `uvx bandit -r app -q -ll`; `git ls-files | grep -E '(^|/)\.env($|\.)'`; `git grep -nE 'BEGIN ... PRIVATE KEY|AKIA...|sk_live_...'` |
| Result | **PASS for local scope** — `npm audit` 0 vulnerabilities; `pip-audit` no known vulnerabilities; Bandit medium/high clean after marking deterministic feed MD5 `usedforsecurity=False`; only `.env.example` files tracked; no obvious secret patterns |
| Artefact | `THREAT_MODEL.md` with assets, actors, trust boundaries, threats/controls and open gates |
| Known limitation | No container image exists; no independent penetration test/security-owner sign-off; production provider/KMS/legal reviews remain external. |

### VE-042 — Phase 8 local restore, load and accessibility checks

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | P8.3, P8.5, P8.7 (local smoke only) |
| Restore | `pg_dump kindah_dev` → restore into `kindah_restore_drill`; counts users=3, badge_definitions=5, wishes=3, gifts=1; Alembic `0014_badge_definitions (head)`; restore DB removed after drill |
| Load | 500 concurrent-ish GET `/api/v1/wishes?limit=20` at concurrency 50; 0 errors; 888.6 rps; p50 51.1 ms; p95 90.3 ms; p99 109.0 ms; max 149.6 ms (local dev machine, not capacity sign-off) |
| Accessibility | Lighthouse mobile navigation: `/` 100 accessibility, `/sign-in` 100, `/admin` 100, `/me` 100. `/me` best-practices 96 due expected empty-payment-method 404 and CLS score 0.98; no a11y failures |
| Known limitation | No owner-approved beta assumptions/RPO/RTO, deployed staging, monitoring/on-call, manual screen-reader/keyboard or mobile-browser matrix. P8.3–P8.7 are not fully signed off. |

### VE-043 — DB-only admin roles, role management and configurable badges

| Field | Value |
|---|---|
| Date | 2026-11-24 |
| Phase/task | Owner follow-up (RBAC/badges policy) |
| Command | `cd backend && uv run alembic upgrade head && uv run ruff check . && uv run ruff format --check . && uv run mypy app tests scripts && uv run pytest -q`; `cd frontend && npm test && npm run lint && npm run typecheck && npm run build` |
| Environment | PostgreSQL 16.16; Python 3.12.16; Next.js 16.4.6; Node 26 |
| Result | **PASS** — `0014_badge_definitions (head)`; **176 backend tests**, **54 frontend tests**; all lint, format, type and build checks clean |
| Roles | `users.role` is the sole admin authority; env allow-list removed. Admin can search users and promote/demote to USER/MODERATOR/ADMIN with mandatory reason, MFA and audit; self-role changes return `CANNOT_CHANGE_OWN_ROLE`; non-admin role changes denied. Role-change notification emitted. Bootstrap CLI supports phone (HMAC lookup, never printed), display name or user UUID. |
| Badges | `badge_definitions` holds code/label/rule type/threshold/active/sort order; seeds the approved defaults. Admin CRUD creates, updates and deactivates badges with audit; deactivation stops future awards while earned badges remain; DB rule changes are used by the next confirmation. |
| Decisions | DEC-O7 approved (no extra cooldown), badge defaults approved, no exposure tracking for now. DEC-I13 remains pending. |
| Known limitation | The owner account has not been identified; bootstrap requires the owner's phone/display name. Rule types remain code-backed, so adding an entirely new rule type still needs code. |

## Summary

| Verification | Result |
|---|---|
| Repository inventory | PASS (finding: greenfield) |
| Git/test state | PASS (finding: no git, no tests) |
| Toolchain probe | PASS (findings: missing Python 3.12+, PostgreSQL, Redis, Docker) |
| Specification reviewed | PASS (943 lines extracted) |
| Phase 0 documents created | PASS |
| Application tests (Phase 0) | N/A — no code at that time |
| Phase 1 backend tests | PASS — 27 passed |
| Phase 1 frontend tests | PASS — 6 passed |
| Phase 1 lint/format/type/build | PASS |
| Phase 1 Alembic up/down/up | PASS |
| Phase 1 browser full-stack check | PASS |
| Phase 1 fresh-clone setup | PASS |
| Phase 1 CI syntax | PASS (`actionlint`); remote run pending |
| Phase 2 identity migration | PASS — 0002 up/down/up |
| Phase 2 backend tests | PASS — 78 passed |
| Phase 2 frontend tests/build | PASS — 11 passed |
| Phase 2 browser flow + session restore | PASS (after CORS fix) |
| Phase 3 payment/wish migration | PASS — 0003 up/down/up |
| Phase 3 backend tests | PASS — 126 passed |
| Phase 3 frontend tests/build | PASS — 15 passed |
| Phase 3 browser VPA/wish/cooldown | PASS (after reauth UX fix) |
| Phase 4 discovery migration | PASS — 0004 up/down/up |
| Phase 4 backend tests | PASS — 133 passed |
| Phase 4 frontend tests/build | PASS — 21 passed |
| Phase 4 browser guest feed/auth gate | PASS |
| Phase 4 fresh-clone validation | PASS |
| Phase 5 gift/reservation backend | PASS — 149 tests, 14 gift tests |
| Phase 5 late-payment support/admin | PASS — 2 support-case tests, migration 0006 at head |
| Phase 5 mandatory race suite | PASS — concurrent donors, idempotency, re-reservation, PAID-vs-expiry, confirmation-vs-timeout |
| Phase 5 frontend gift UI | PASS — 31 tests, build clean, donor/recipient browser journey |
| Phase 5 overall | `DONE` — 15/15 tasks, pending external launch gates only |
| Phase 6 reporting/blocking | PASS — 152 total backend tests, 34 frontend tests, report/block browser flow |
| Phase 6 auto-hide/queue | PASS — 153 total backend tests, threshold hides once, queue is admin-only |
| Phase 6 admin/MFA/audit | PASS — 156 total backend tests, 38 frontend tests, full browser admin flow |
| Phase 6 moderation actions | PASS — 158 total backend tests, 39 frontend tests, browser hide/restore |
| Phase 6 appeals/disputes | PASS — 159 total backend tests, 43 frontend tests |
| Phase 6 deletion requests | PASS — 161 total backend tests, 47 frontend tests, non-destructive |
| Phase 6 notifications | PASS — 164 total backend tests, 50 frontend tests, dedupe/read/safety |
| Phase 6 outbox | PASS — 168 total backend tests, retry/dead-letter/skip-locked |
| Phase 6 runbooks/staging | PASS — local staging DB critical path exercised; deployed staging pending |
| Phase 6 overall | `DONE` — 11/11 tasks; external launch gates blocked |
| Phase 7 karma/streak/badges | PASS — 173 total backend tests, 53 frontend tests |
| Phase 7 share/Surprise Me | PASS — privacy allow-list, exclusion and weight tests |
| Phase 7 overall | `DONE` — 8/8 tasks; badge definitions DB-configurable |
| DB roles/badge registry | PASS — 176 total backend tests, 54 frontend tests, migration 0014 |
| Phase 8 threat model/scans | PASS (local scope) — npm/pip/Bandit/secret checks |
| Phase 8 restore/load/a11y smoke | PASS locally — restore at head, p95 90.3 ms, a11y 100 on 4 pages |
| Phase 8 overall | `BLOCKED` — deployed staging, monitoring/RPO/RTO, independent security review, legal/provider gates |

## Rule for future entries

Every future record must include date, phase/task ID, exact command or manual procedure, environment, PASS/FAIL/BLOCKED result, relevant output/artefact and known limitation. Do not record a task as `DONE` on generated code alone.
