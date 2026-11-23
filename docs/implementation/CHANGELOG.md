# Changelog — Chillar / Kindly

Meaningful implementation milestones, migrations, API contract changes and deviations from the specification. Newest first.

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
