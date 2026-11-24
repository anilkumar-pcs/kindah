# Changelog — Chillar / Kindly

Meaningful implementation milestones, migrations, API contract changes and deviations from the specification. Newest first.

## 2026-11-24 — Phase 4 complete: public discovery and selection

### Added

- `0004_discovery` migration: `user_blocks` table and a `wishes(status, created_at)` feed index.
- Public read-only feed with stable cursor pagination, Fresh ordering and deterministic seeded Random ordering.
- Optional city filter.
- Exclusions for own, expired, locked, removed, under-review, blocked, inactive-recipient and no-active-payment-method wishes.
- Public-safe wish DTO (`id`, pseudonym, avatar, city, timestamp, mood, message, suggested amount) with no phone/VPA/UTR/payment/moderation data.
- Public wish detail and authenticated `POST /wishes/{id}/select` gate; guests receive 401.
- Frontend discovery feed with Fresh/Random tabs, city filter, loading/empty/error states, cursor “Load more”, responsive cards and accessible labels.
- Frontend wish detail with selection success, 409/404 handling and a guest sign-in prompt.

### Fixed

- Removed Next.js URL-data prerendering conflicts from the sign-in and wish-detail routes by using `/reauth` and client-side `useParams`.
- Feed results are isolated in a keyed child component so filter changes remount cleanly without synchronous state resets in an effect.

### Verification

- 133 backend tests pass; Ruff, format and mypy clean.
- 21 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser: guest sees an open wish, opens detail, and is prompted to sign in when selecting; no console errors.
- Discovery migration and fresh-clone validation pass.

## 2026-11-24 — Phase 3 complete: payment method and wish lifecycle

### Added

- `0003_payment_wishes` migration: payment-method and wish enums/tables, one-active-wish partial unique index, and `users.last_authenticated_at` for re-authentication freshness.
- VPA syntax validation with explicit `SYNTAX_ONLY` status; no ownership claim.
- VPA encryption through `CryptoProvider`, keyed HMAC duplicate detection, masked UI/API representation and versioning with privacy acknowledgement.
- Re-authentication window for VPA changes; forced `/reauth` OTP path when the session is older than the window.
- Wish creation with 10–120-character message validation, URL/phone/VPA/HTML/UPI filters, mood enum, optional whole-INR ₹10–₹100 amount, optional city and onboarding/payment-method prerequisites.
- One active wish per user enforced by a partial unique index; 24-hour expiry; 72-hour cooldown after withdrawal/expiry.
- Withdrawal endpoint and idempotent wish-expiry worker (`python -m app.workers.wish_expiry`).
- My Space frontend: masked UPI setup, privacy disclosure, wish preview/publish, active-wish display, withdrawal, cooldown and history.

### Fixed

- Chat-style sign-in now supports forced re-authentication through `/reauth` without depending on URL search params, avoiding a Next.js cache-components warning.
- Cooldown rendering no longer calls impure time functions during render.

### Verification

- 126 backend tests pass; Ruff, format and mypy clean.
- 15 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser: masked VPA save → wish publish → withdraw → cooldown, plus forced re-auth, all succeed.
- Payment/wish migration upgrade → downgrade → upgrade passes on an isolated database.
- Wish-expiry worker runs and reports `expired_count`.

### Blocked

- Production KMS and VPA beneficiary validation are unresolved. Production receiving remains `BLOCKED`; local AES-GCM and syntax-only validation are used.

## 2026-11-24 — Phase 2 complete: identity, sessions and profile

### Added

- `0002_identity` migration: `user_status` enum, `users`, `user_sessions`, `otp_challenges` and `auth_events` with constraints and indexes.
- OTP request/verify service with Indian mobile normalization, keyed HMAC lookup, encrypted mobile storage, masked display, per-phone/IP rate limits, resend throttle, attempt limits and expiry.
- `SmsProvider` interface and deterministic test adapter; production rejects the test adapter at startup.
- Session lifecycle: 15-minute JWT access token, rotating opaque refresh token hashed in PostgreSQL, reuse detection with family revocation, logout, expiry checks and account-status enforcement.
- Double-submit CSRF protection for refresh/logout; access token held in memory only.
- Consent endpoint recording 18+, draft Terms, Privacy and Guidelines acceptance with policy version.
- Pseudonymous profile: validated unique display name, preset avatar, optional city, onboarding state, public-safe `/me` DTO.
- Audit events for OTP, account, session, consent and profile changes without phone/OTP contents.
- Frontend sign-in flow: OTP request/verify, consent, profile setup, session restore, logout, loading/error states and accessible forms.
- API client bearer-token support, refresh-and-retry, and CSRF header handling.

### Fixed

- Added `X-CSRF-Token` to the CORS allow-list. Browser validation caught that refresh preflight was blocked; a regression test now covers it.
- Session restore no longer makes a guaranteed 401 request when no CSRF cookie exists.
- Development/test signing secrets were lengthened past the 32-character minimum; configuration rejects shorter keys.

### Verification

- 78 backend tests pass; Ruff, format and mypy clean.
- 11 frontend tests pass; ESLint, Prettier, TypeScript and production build pass.
- Browser flow: OTP → consent → profile → signed-in; page reload restores session with no console errors.
- Identity migration upgrade → downgrade → upgrade passes on an isolated database.

### Blocked

- Production OTP/SMS provider is not selected. Production auth remains `BLOCKED`; development/test use the deterministic adapter.

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
