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
| Phase 5 gift/reservation backend | PASS — 145 tests, 12 gift tests |
| Phase 5 mandatory race suite | PARTIAL — concurrent donors/idempotency covered; true PAID-vs-expiry and confirmation-vs-timeout races pending |
| Phase 5 frontend gift UI | NOT STARTED |

## Rule for future entries

Every future record must include date, phase/task ID, exact command or manual procedure, environment, PASS/FAIL/BLOCKED result, relevant output/artefact and known limitation. Do not record a task as `DONE` on generated code alone.
