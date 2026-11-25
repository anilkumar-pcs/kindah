# Decision Log — Chillar / Kindly

**Last updated:** 2026-11-25
**Status:** Phase 0 proposals. **No decision in this file is owner-approved unless its Owner decision field says `APPROVED`.** Every other entry is an AI recommendation awaiting owner input or an external dependency.

## How to use this log

- `DEC-O*` — open decisions carried from specification §19.
- `DEC-I*` — implementation/architecture decisions proposed during Phase 0.
- `DEC-A*` — specification/plan ambiguities that require an interpretation or product decision.
- Status vocabulary: `PENDING`, `APPROVED`, `REJECTED`, `DEFERRED`, `EXTERNAL_BLOCKED`.
- Record the owner's exact decision and date. Do not infer approval from silence or from approval of a phase plan.

---

## Owner approval record

**2026-11-23 — Phase 1 approval.** The owner stated verbatim:

> "I approve the phase 1 scope. I want you to complete each phase, do a validation and then automatically proceed to the next phase. install any dependencies required"

This approves:

- The Phase 1 scope, tasks and exit criteria in `IMPLEMENTATION_BACKLOG.md` §4.
- The Phase 1 tooling/defaults: `DEC-I01`, `DEC-I02`, `DEC-I03`, `DEC-I04`, `DEC-I11`, `DEC-I12`, `DEC-I14`, `DEC-I17`, `DEC-A05`.
- Installation of local development dependencies and initialisation of git with a baseline commit.
- Sequential phase progression after each phase's validation.

**2026-11-24 — Phase 5 defaults approval.** The owner stated verbatim: "go ahead with your proposed defaults". This approves `DEC-O2` (10-minute reservation, one extension to 20 minutes total, 24-hour recipient response), `DEC-A02` (generate in-transaction, persist encrypted, expose after commit), `DEC-A03` (literal spec: a new wish is allowed after PAID) and `DEC-A04` (DONOR_PENDING timeout expires the wish and never reopens).

**2026-11-24 — Late-payment/admin approval.** The owner stated verbatim: "go with recommended defaults...also all of these details should be accessible and visible to admin....admin should be able to resolve the issue if pointed by users". This approves `DEC-O5` (spec payment labels) and `DEC-A06`: late payments are handled through support only (no refund, reassignment or automatic reopening), and admin/moderator users must be able to see full support-case/gift details and resolve the issue. Full admin RBAC/MFA remains Phase 6.

**2026-11-24 — DB roles, removal cooldown, badges and exposure.** The owner stated verbatim: "lets keep a role in db that makes someone admin. so the admin also logs as in normal user but the role in db makes him admin... And admin should be able to make any other user as admin. no extra cooldown for platform removal. approve these defaults. but I want these all to be in a single place and configurable... no exposure for now."

This approves:

- `users.role` in PostgreSQL as the sole admin authority; admins log in normally and MFA remains a second factor. Admins can search users and change roles; bootstrap is via `scripts/grant_role.py`.
- `DEC-O7`: no extra cooldown for platform removal.
- Badge defaults: FIRST_GIFT (1 confirmed sent), KIND_HEART (5), KIND_SOUL (10), GRATEFUL (thanks received), STREAK_3 (3 IST giving days). Badge definitions are DB-backed and admin-configurable (add/update/deactivate) in one registry.
- No wish exposure tracking/caps for now.

`DEC-I13` is now an **owner override**: MFA is not required for admins; the database role alone grants access. TOTP/recovery-code code remains available but is disabled by default via `ADMIN_MFA_REQUIRED=false`. The owner accepted the account-compromise risk; this is recorded as a production risk-acceptance item.

This does **not** approve external legal/provider gates. Other decisions — `DEC-O3`, `DEC-O4`, `DEC-O6`, `DEC-O8`–`DEC-O10`, `DEC-I05`–`DEC-I10`, `DEC-I13`, `DEC-I15`, `DEC-I16`, `DEC-I18` and `DEC-A01` — remain `PENDING` unless separately recorded. External gates remain `EXTERNAL_BLOCKED`.

---

## Summary

| ID | Topic | Proposal | Owner decision | Affects |
|---|---|---|---|---|
| DEC-O2 | Reservation and response timings | 10 min + one extension to 20 min total; 24h recipient response | APPROVED (2026-11-24) | P5.2, P5.7, P5.8 |
| DEC-O3 | Direct UPI legal/bank position | Keep real money off until written approvals | EXTERNAL_BLOCKED | P5.15, P8.9, P8.11 |
| DEC-O4 | VPA beneficiary validation | Syntax-only with explicit residual risk | EXTERNAL_BLOCKED | P3.1, P8.9 |
| DEC-O5 | Payment labels / copy freeze | Use spec's attestation labels | APPROVED (2026-11-24) | P5.5, P5.14 |
| DEC-O6 | Phone change/recovery | Old+new OTP with support fallback | PENDING | P2.2, production auth |
| DEC-O7 | Cooldown after moderation removal | No cooldown for platform-removed wish | APPROVED (2026-11-24) | P3.7, P6.6 |
| DEC-O8 | Retention schedule | Configurable; numeric periods only after counsel | EXTERNAL_BLOCKED | P6.8, P8.9 |
| DEC-O9 | Brand/trademark | Clear before public marketing | EXTERNAL_BLOCKED | P8.9 |
| DEC-O10 | Cloud/worker platform | Provider-neutral containers; choose before staging | PENDING | P1.8, P8.8 |
| DEC-I01 | Python runtime and package manager | uv + Python 3.12, lockfile | APPROVED (Phase 1) | P1.2, P1.7 |
| DEC-I02 | Local services and test DB | Homebrew Postgres 16/Redis 7; CI service containers | APPROVED (Phase 1) | P1.5, P1.6, P1.8 |
| DEC-I03 | Database access style | Sync SQLAlchemy 2 + psycopg 3 | APPROVED (Phase 1) | P1.5, P5 |
| DEC-I04 | Frontend stack | Next.js App Router, TypeScript, Tailwind, Radix, npm | APPROVED (Phase 1) | P1.4 |
| DEC-I05 | Session/token model | 15m JWT access in memory + rotating opaque refresh cookie | PENDING | P2.3 |
| DEC-I06 | OTP storage and rate limits | PostgreSQL durable state; Redis optional | PENDING | P2.1, P2.8 |
| DEC-I07 | Worker runtime | PostgreSQL outbox + polling worker, `SKIP LOCKED` | PENDING | P1.3, P5, P6.10 |
| DEC-I08 | Idempotency retention | 30 days configurable; never purge unresolved gifts | PENDING | P5.3, P5.13 |
| DEC-I09 | Crypto/KMS | Interface + local AES-GCM; production KMS gate | PENDING / EXTERNAL | P3.2, P5.5 |
| DEC-I10 | Payment handoff provider | Interface + test adapter; no production adapter | PENDING / EXTERNAL | P5.5, P5.15 |
| DEC-I11 | API error format | RFC 9457 `problem+json` with spec codes | APPROVED (Phase 1) | P1.3 |
| DEC-I12 | Migration policy | Forward-only in production; up/down tested in dev/CI | APPROVED (Phase 1) | P1.5 |
| DEC-I13 | Admin MFA | Role-only admin access; MFA optional | OWNER OVERRIDE — MFA NOT REQUIRED (2026-11-24) | P6.5, Phase 8 |
| DEC-I14 | PWA caching | Static shell only; no private response caching | APPROVED (Phase 1) | P1.4, P8.7 |
| DEC-I15 | Avatar approach | Generated preset avatars; no uploads in MVP | PENDING | P2.5 |
| DEC-I16 | Karma write path | Synchronous ledger write in confirmation transaction | PENDING | P5.12, P7.1 |
| DEC-I17 | CI platform | GitHub Actions | APPROVED (Phase 1) | P1.8 |
| DEC-I18 | Display-name policy | 3–24 chars, case-insensitive unique, reserved words | PENDING | P2.5 |
| DEC-A01 | Surprise Me / Random tab scope | Random in Phase 4; Surprise Me Phase 7, before beta | PENDING | P4, P7, P8 |
| DEC-A02 | UPI URI generation vs persistence | Generate in transaction, persist encrypted, expose after commit | APPROVED (2026-11-24) | P5.3, P5.4 |
| DEC-A03 | Wish eligibility after donor PAID | Follow literal spec (new wish allowed) | APPROVED (2026-11-24) | P3.7, P5 |
| DEC-A04 | `DONOR_PENDING` at reservation timeout | Expire wish; never reopen; support path | APPROVED (2026-11-24) | P5.7, P5.10 |
| DEC-A05 | Visual design direction | Neutral accessible tokens until owner supplies direction | APPROVED (Phase 1) | P1.4, P4.6, P5.14 |
| DEC-A06 | Late-payment support and admin visibility | Support-only; no refund/reassignment; admin sees details and resolves | APPROVED (2026-11-24) | P5.10, P6.7 |
| DEC-A07 | Selected visual direction | Direction A — Neighbourhood Postcard (warm paper, deep green, crafted illustration); mobile bottom tabs | APPROVED (2026-11-24) | Design system, frontend redesign |
| DEC-A08 | Home City Pulse privacy model | Aggregate recipient-confirmed stats, seven-day chart and thresholded area pulse; no individual A→B flow or donor location | IMPLEMENTED SAFE DEFAULT — owner review pending | Home, public stats API |

---

## A. Open decisions from specification §19

### DEC-O2 — Reservation and recipient-response timings

| Field | Value |
|---|---|
| Question | Confirm the reservation/response timings before implementing the gift state machine. |
| Options | **A.** 10-minute handoff reservation; one Still Processing extension to a maximum of 20 minutes total; 24-hour recipient response window (spec recommendation). **B.** Different values. **C.** Make values configurable but ship A. |
| Recommendation | **C.** Implement A as configurable settings; obtain owner sign-off before Phase 5 and record the exact values. A configuration change must not silently alter an in-flight gift. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-23 |
| Affects | P5.2, P5.7, P5.8 |

### DEC-O3 — Direct UPI legal and bank/payment-partner position

| Field | Value |
|---|---|
| Question | Is direct P2P UPI handoff, using recipient VPAs and server-generated intents/QRs, permissible for this product? |
| Options | **A.** Proceed after written legal opinion and bank/payment-partner confirmation. **B.** Require a regulated PSP/gateway model before launch. **C.** Do not launch money movement. |
| Recommendation | **A**, exactly as the specification scopes it, with real-money production handoff disabled until the written gates exist. This is not legal advice and does not assume approval. |
| Owner decision | **EXTERNAL_BLOCKED** — requires Indian counsel and bank/partner position |
| Date | 2026-11-23 |
| Affects | P5.15, P8.9, P8.11 |

### DEC-O4 — VPA beneficiary validation

| Field | Value |
|---|---|
| Question | How will the platform validate that a recipient VPA exists, belongs to the user and can receive money? |
| Options | **A.** No provider: syntax validation only, clearly labelled, with owner-accepted residual risk. **B.** Provider-supported beneficiary validation. **C.** Bank-account verification. |
| Recommendation | **A for MVP** with explicit status/labels and no ownership claim; move to B if a lawful provider is selected. Receiving live money requires the owner to accept or resolve this risk. |
| Owner decision | **EXTERNAL_BLOCKED** — provider/legal dependency |
| Date | 2026-11-23 |
| Affects | P3.1, P8.9 |

### DEC-O5 — Payment labels and copy freeze

| Field | Value |
|---|---|
| Question | Freeze the exact user-facing labels for payment states. |
| Options | **A.** Spec labels: "Donor says paid", "Awaiting recipient confirmation", "Recipient confirmed", "Disputed"; never "verified". **B.** Alternative wording. |
| Recommendation | **A.** Freeze before Phase 5 UI; include bank-registered-name disclosure and old-URI warning. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-23 |
| Affects | P5.5, P5.14 |

### DEC-O6 — Phone change and account recovery

| Field | Value |
|---|---|
| Question | How can a user change their verified phone or recover an account? |
| Options | **A.** Old-number OTP + new-number OTP, with support-assisted fallback. **B.** Support-only. **C.** No self-service in MVP. |
| Recommendation | **A**, designed before production auth; log/audit changes without exposing numbers. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P2.2, production authentication |

### DEC-O7 — Cooldown after moderation removal

| Field | Value |
|---|---|
| Question | Does a platform-removed wish start the 72-hour cooldown? |
| Options | **A.** No cooldown for a platform-removed wish (spec default proposal). **B.** Apply the 72-hour cooldown. |
| Recommendation | **A**, with moderator reason/audit and a separate restriction mechanism if abuse is suspected. |
| Owner decision | **APPROVED (2026-11-24): no extra cooldown for platform removal.** `WISH_REMOVED` sets no cooldown; restriction/ban remains a separate audited account action. |
| Date | 2026-11-24 |
| Affects | P3.7, P6.6 |

### DEC-O8 — Retention schedule

| Field | Value |
|---|---|
| Question | How long are accounts, wishes, gifts, payment metadata, audit logs and notifications retained? |
| Options | **A.** Configurable retention with periods approved by Indian counsel. **B.** Fixed periods chosen now. |
| Recommendation | **A.** No destructive cleanup before approval; preserve financial/audit records; document the data map. |
| Owner decision | **EXTERNAL_BLOCKED** — counsel approval |
| Date | 2026-11-23 |
| Affects | P6.8, P8.9 |

### DEC-O9 — Brand and trademark clearance

| Field | Value |
|---|---|
| Question | Is "Chillar / Kindly" available for use and registration? |
| Options | **A.** Clear before public marketing. **B.** Use an interim working name. |
| Recommendation | **A.** Internal development can use the working name; public branding waits for clearance. |
| Owner decision | **EXTERNAL_BLOCKED** |
| Date | 2026-11-23 |
| Affects | P8.9 |

### DEC-O10 — Cloud and worker platform

| Field | Value |
|---|---|
| Question | Which managed cloud/region and worker platform will host staging/production? |
| Options | **A.** Container platform with managed PostgreSQL and optional managed Redis in an India region. **B.** Serverless functions plus managed database. **C.** Self-managed VMs. |
| Recommendation | **A**, provider-neutral containers; choose a lean managed service after region/cost review before staging. Avoid coupling domain code to a provider SDK. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P1.8, P8.8 |

---

## B. Proposed implementation decisions

### DEC-I01 — Python runtime and package manager

| Field | Value |
|---|---|
| Question | How will the backend's Python 3.12+ runtime and dependencies be managed? |
| Options | **A.** `uv` with a committed lockfile and `requires-python >= 3.12`. **B.** Homebrew Python + `venv`/pip + requirements files. **C.** Poetry. **D.** Docker-only development. |
| Recommendation | **A.** `uv` is fast, manages the interpreter and lockfile, and avoids relying on the system's Python 3.9. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.2, P1.7, all backend work |

### DEC-I02 — Local services and test database

| Field | Value |
|---|---|
| Question | How will developers run PostgreSQL and Redis locally, and what database will tests/CI use? |
| Options | **A.** Homebrew PostgreSQL 16 + Redis 7 locally; GitHub Actions service containers in CI. **B.** Docker Compose for local services. **C.** Managed cloud development database. |
| Recommendation | **A** on this machine (Homebrew is available; Docker is not installed). Add an optional Compose file for parity when Docker is available. Tests always use real PostgreSQL 16, never SQLite. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.5, P1.6, P1.8 |

### DEC-I03 — Database access style

| Field | Value |
|---|---|
| Question | Should the backend use synchronous or asynchronous SQLAlchemy? |
| Options | **A.** SQLAlchemy 2 sync + psycopg 3; sync route handlers for DB work. **B.** Async SQLAlchemy + asyncpg; async handlers/dependencies. |
| Recommendation | **A** for MVP simplicity, easier row-lock/concurrency tests and fewer session-lifecycle pitfalls. Revisit only if measured throughput requires async DB I/O. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.5, P5 |

### DEC-I04 — Frontend stack and styling

| Field | Value |
|---|---|
| Question | Which frontend foundation should be used? |
| Options | **A.** Next.js App Router + TypeScript + Tailwind + a small set of accessible headless primitives; npm. **B.** Another React framework or UI kit. **C.** Plain CSS/modules. |
| Recommendation | **A.** It matches spec §6.1 and supports the required PWA, accessibility and responsive work. Pin the Next.js version and verify Node 26 compatibility. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.4, all frontend phases |

### DEC-I05 — Session and token model

| Field | Value |
|---|---|
| Question | How are authenticated sessions issued, refreshed and revoked? |
| Options | **A.** 15-minute JWT access token held in memory + opaque 30-day rotating refresh token in a `Secure`, `HttpOnly`, `SameSite` cookie, hashed server-side; logout revokes. **B.** Cookie-only sessions. **C.** Long-lived JWT. |
| Recommendation | **A**, with refresh-token reuse detection and CSRF protection on cookie-authenticated routes. Exact durations are configurable. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P2.3 |

### DEC-I06 — OTP storage and rate limiting

| Field | Value |
|---|---|
| Question | Where should OTP challenges and rate-limit state live? |
| Options | **A.** PostgreSQL durable OTP challenge records + DB-backed rate limits; Redis optional for IP velocity. **B.** Redis-only OTP/limits. **C.** Third-party OTP service. |
| Recommendation | **A.** OTP correctness and replay protection must not depend on Redis; a test adapter stands in for SMS. Per-phone limit: 3 per 15 minutes plus IP controls. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P2.1, P2.8 |

### DEC-I07 — Worker runtime

| Field | Value |
|---|---|
| Question | How are background jobs and outbox events processed? |
| Options | **A.** One Python worker process polling PostgreSQL, claiming rows with `FOR UPDATE SKIP LOCKED`. **B.** Celery + Redis broker. **C.** Cloud queue service. |
| Recommendation | **A** for MVP: fewer moving parts, no Redis correctness dependency, simple idempotent retries. Add a broker only if measured scale requires it. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P1.3, P5, P6.10 |

### DEC-I08 — Idempotency record retention

| Field | Value |
|---|---|
| Question | How long should idempotency records be retained? |
| Options | **A.** 30 days, configurable. **B.** 7 days. **C.** Indefinite. |
| Recommendation | **A**, never purging records tied to unresolved gifts; monitor table growth. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P5.3, P5.13 |

### DEC-I09 — Crypto/KMS strategy

| Field | Value |
|---|---|
| Question | How are VPA, phone, UTR and handoff payloads encrypted? |
| Options | **A.** `CryptoProvider` interface; local AES-256-GCM adapter with an environment key for dev/test; production KMS envelope encryption adapter selected later. **B.** Choose a cloud KMS now and use it locally. **C.** Application-level symmetric encryption only. |
| Recommendation | **A.** No plaintext sensitive data in any environment; document key rotation/recovery; production readiness remains blocked until a KMS is selected. |
| Owner decision | **PENDING** — local adapter; production KMS `EXTERNAL_BLOCKED` |
| Date | 2026-11-23 |
| Affects | P3.2, P5.5 |

### DEC-I10 — Payment handoff provider

| Field | Value |
|---|---|
| Question | What implementation backs UPI handoff? |
| Options | **A.** `PaymentHandoffProvider` interface + deterministic test adapter using a configured test VPA; no production adapter. **B.** Integrate a PSP now. **C.** Manual handoff outside the app. |
| Recommendation | **A.** The interface generates URI/QR only; it does not settle or verify funds. `PAYMENTS_LIVE_ENABLED` defaults to false in every environment. |
| Owner decision | **PENDING** — production adapter `EXTERNAL_BLOCKED` |
| Date | 2026-11-23 |
| Affects | P5.5, P5.15 |

### DEC-I11 — API error format

| Field | Value |
|---|---|
| Question | What shape should errors use? |
| Options | **A.** RFC 9457 `application/problem+json` with the spec's stable machine codes (`VALIDATION_ERROR`, `WISH_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, etc.). **B.** Custom envelope. |
| Recommendation | **A.** Include `type`, `title`, `status`, `code`, `detail`, `requestId`; never include sensitive values. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.3 |

### DEC-I12 — Migration policy

| Field | Value |
|---|---|
| Question | What migration policy applies? |
| Options | **A.** Forward-only in production; every migration tested up/down in development and CI. **B.** Up/down everywhere. |
| Recommendation | **A.** Backward-compatible deploy order; never destructive without a documented plan. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.5, Phase 8 deploy |

### DEC-I13 — Admin MFA

| Field | Value |
|---|---|
| Question | Which MFA mechanism protects admin/moderator accounts? |
| Options | **A.** TOTP (RFC 6238) + single-use recovery codes. **B.** WebAuthn/passkeys. **C.** SMS OTP. |
| Recommendation | **A for MVP**, with WebAuthn considered later. MFA is mandatory before any admin route is exposed. Never SMS-only. |
| Owner decision | **OWNER OVERRIDE (2026-11-24): skip MFA for admins.** The DB role alone grants admin access. TOTP + recovery-code code remains implemented but is not enforced by default (`ADMIN_MFA_REQUIRED=false`). The owner accepted the increased account-compromise risk. Re-enable with `ADMIN_MFA_REQUIRED=true` before production if the risk posture changes. |
| Date | 2026-11-24 |
| Affects | P6.5, Phase 8 |

Implementation notes: TOTP SHA-1/6-digit/30-second steps, ±1 step window, per-step replay
rejection, ten single-use HMAC-hashed recovery codes, and a 15-minute MFA token bound to the
access-token session. Roles are `USER`, `MODERATOR`, `ADMIN`; the database role is the sole
authorization source (the old `ADMIN_USER_IDS` allow-list was removed). Admins can search users
and change roles; a one-time `scripts/grant_role.py` CLI bootstraps the first administrator.
The `admin_audit_logs` table is append-only via a database trigger.

### DEC-I14 — PWA caching policy

| Field | Value |
|---|---|
| Question | What may the service worker cache? |
| Options | **A.** Static shell/assets only; never authenticated API responses or private data. **B.** Aggressive offline caching. |
| Recommendation | **A.** Honest offline states; payment actions never claim success offline. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.4, P8.7 |

### DEC-I15 — Avatar approach

| Field | Value |
|---|---|
| Question | How is the required pseudonymous avatar provided? |
| Options | **A.** Generated/deterministic preset avatars; no uploads in MVP. **B.** User uploads with moderation/storage. **C.** External avatar service. |
| Recommendation | **A.** Avoids media storage, moderation burden and additional PII while satisfying the pseudonymous profile requirement. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P2.5 |

### DEC-I16 — Karma write path

| Field | Value |
|---|---|
| Question | Is karma written synchronously on recipient confirmation or asynchronously from the outbox? |
| Options | **A.** Synchronous append-only ledger write inside the recipient-confirmation transaction, with a unique idempotency key; outbox used for projections/notifications. **B.** Outbox-driven asynchronous ledger write. |
| Recommendation | **A.** Guarantees "awarded once, only after confirmation" in the same commit as the gift state; projections remain rebuildable. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P5.12, P7.1 |

### DEC-I17 — CI platform

| Field | Value |
|---|---|
| Question | Which CI system runs checks? |
| Options | **A.** GitHub Actions. **B.** Another provider. |
| Recommendation | **A**, assuming the repository will be hosted on GitHub. Confirm before P1.8; the workflow design is otherwise provider-neutral. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.8 |

### DEC-I18 — Display-name policy

| Field | Value |
|---|---|
| Question | What validation applies to pseudonymous display names? |
| Options | **A.** 3–24 characters; letters, digits and underscore; case-insensitive uniqueness; reserved/prohibited-name list; no phone/VPA/URL patterns. **B.** More permissive. |
| Recommendation | **A.** Exact limits are product copy/UX decisions; confirm before Phase 2. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P2.5 |

---

## C. Specification/plan ambiguities

### DEC-A01 — Surprise Me and Random-tab scope

| Field | Value |
|---|---|
| Question | Spec §3.1 requires Fresh and Random tabs and defines Surprise Me; plan P4.3 names only Fresh ordering, and Phase 7 P7.6 implements Surprise Me while Phase 4 only defers "fairness weights". What is launch scope and phase placement? |
| Options | **A.** Random tab in Phase 4 as part of discovery; full Surprise Me with fairness/exposures in Phase 7, but completed before public beta. **B.** Build both in Phase 4. **C.** Defer both to Phase 7. |
| Recommendation | **A.** Random ordering is basic discovery; fairness weighting/exposure policy is a later enhancement. Both must exist before the Phase 8 exit if they remain launch requirements. |
| Owner decision | **PENDING** |
| Date | 2026-11-23 |
| Affects | P4.1–P4.7, P7.6–P7.7, P8 |

### DEC-A02 — UPI URI generation vs persistence ordering

| Field | Value |
|---|---|
| Question | Spec §4.2 says the UPI URI/QR is persisted; §4.4 says no URI may be generated or returned before the transaction commits. How should the gift transaction behave? |
| Options | **A.** Generate the URI in memory from validated/persisted server-owned data inside the transaction, persist the handoff payload encrypted, and expose it only after commit. **B.** Commit the gift first, then generate/persist the handoff in a second transaction with an idempotent recovery path. **C.** Generate after commit and never persist, regenerating on read. |
| Recommendation | **A.** It preserves atomicity, satisfies persistence, and avoids exposing a handoff for a failed commit. Interpret the §4.4 prohibition as "do not expose before commit." If the owner reads it literally as "do not generate", B is required with a committed-but-unissued recovery state. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-23 |
| Affects | P5.3, P5.4 |

### DEC-A03 — Wish eligibility after a donor claims PAID

| Field | Value |
|---|---|
| Question | Spec §3.2 limits a user to one OPEN or LOCKED wish and starts cooldown only after GRANTED or EXPIRED. May a recipient publish a new wish while the previous wish is PAYMENT_CLAIMED, UNVERIFIED or DISPUTED? |
| Options | **A.** Follow the literal spec: yes, because the old wish is no longer OPEN/LOCKED and no cooldown applies. **B.** Treat unresolved payment states as blocking a new wish until the old wish is terminal. **C.** Block until terminal and then apply a cooldown. |
| Recommendation | **A** for spec fidelity, with a privacy/abuse review note. If the product intent is "one unresolved gift at a time", choose **B** before Phase 3. Do not implement a hybrid silently. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-23 |
| Affects | P3.7, P5 |

### DEC-A04 — `DONOR_PENDING` at reservation timeout

| Field | Value |
|---|---|
| Question | Spec §4.1 permits LOCKED → OPEN on ABANDONED while within the original lifetime, but §4.3 says never release a wish while the gift is DONOR_PENDING. What happens when a still-processing handoff reaches its extended timeout? |
| Options | **A.** Mark the gift ABANDONED and the wish EXPIRED; never reopen; route to support. **B.** Keep the reservation ACTIVE and alert support for manual resolution. **C.** Abandon and reopen within the lifetime. |
| Recommendation | **A.** The donor has indicated a payment may be in flight; reopening risks a second transfer to the same wish. No karma, no automatic refund. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-23 |
| Affects | P5.7, P5.10 |

### DEC-A05 — Visual design direction

| Field | Value |
|---|---|
| Question | The repository contains no mockups or brand assets beyond the screen inventory and accessibility rules. What visual direction should the frontend follow? |
| Options | **A.** Neutral, accessible Phase 1 design tokens; owner supplies/approves brand direction before Phase 4/5 polish. **B.** Owner supplies a complete design system now. **C.** Commission design. |
| Recommendation | **A.** Avoid inventing a brand while allowing Phase 1 to proceed. All screens still meet the accessibility requirements from day one. |
| Owner decision | **APPROVED — Phase 1 scope (2026-11-23)** |
| Date | 2026-11-23 |
| Affects | P1.4, P4.6, P5.14 |

---

### DEC-A06 — Late-payment support and admin visibility

| Field | Value |
|---|---|
| Question | How are late payments/old-URI issues handled, and what can admin see/do? |
| Options | **A.** Support-only case; no refund/reassignment/automatic reopening; admin sees case + gift details and resolves with an audited note. **B.** Platform-controlled reversal/refund. **C.** No admin visibility. |
| Recommendation | **A.** The platform cannot revoke a UPI URI or control recipient funds; support resolves without mutating gift state. |
| Owner decision | **APPROVED — 2026-11-24** |
| Date | 2026-11-24 |
| Affects | P5.10, P6.7 |

### DEC-A07 — Selected visual direction

| Field | Value |
|---|---|
| Question | Which visual direction should the product use after the three-concept design lab? |
| Options | **A.** Neighbourhood Postcard — warm paper, deep green, illustrated everyday Bengaluru, crafted/calm. **B.** Sticker Scrapbook — tactile collage, pastels, handwritten notes. **C.** Afterglow — bold dark-green panels, oversized type, street-poster energy. |
| Recommendation | **A** as the core product language, with C's oversized display moments and B's sticker/doodle vocabulary reserved for share cards, empty states and celebration moments. |
| Owner decision | **APPROVED — Direction A (2026-11-24)** |
| Owner wording | "I really like A. I like every screen in the A as well. very well designed and more aligned to the chill and fun vibe I ws thinking of. mobile bottom-tab navigation is very nice." |
| Notes | Preserve the current app until the A design is implemented and reviewed. Mobile web uses the app-like bottom-tab shell; installation as a PWA may remove the browser chrome. |
| Date | 2026-11-24 |
| Affects | Design system, consumer screens, mobile navigation shell, PWA theme/manifest |

### DEC-A08 — Home City Pulse privacy model

| Field | Value |
|---|---|
| Question | The owner asked for a homepage “map/chart showing flow of money A→B realtime”. How can Home show community activity without exposing individual payment flows? |
| Options | **A.** Aggregate recipient-confirmed counts, a seven-day chart and thresholded area labels; no individual donor→recipient route or donor location. **B.** Individual realtime A→B payment-flow map. **C.** No activity visualization. |
| Recommendation | **A.** Kindly does not custody or verify payments, does not collect donor location, and the pseudonymous/private-data model rules out an individual money-flow map. Area labels use recipient wish cities and suppress slices below three confirmed gifts. |
| Owner decision | **IMPLEMENTED SAFE DEFAULT — owner review pending.** Not recorded as an owner approval. |
| Owner wording | “map/chart showing flow of money A→B realtime” (2026-11-25 request) |
| Date | 2026-11-25 |
| Affects | Home City Pulse, `/api/v1/public/stats`, aggregate copy |

## D. Recording owner decisions

When the owner decides, append:

```text
Owner decision: APPROVED | REJECTED | DEFERRED
Decided by: <owner>
Date: YYYY-MM-DD
Notes: <exact wording or constraints>
```

Then update the summary table and `IMPLEMENTATION_STATUS.md`. A decision is not approved because a phase was approved in general; it must be recorded explicitly.
