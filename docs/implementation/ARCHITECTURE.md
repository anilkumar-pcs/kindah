# Proposed Target Architecture — Chillar / Kindly

**Phase:** 0 — Repository discovery and planning
**Date:** 2026-11-23
**Status:** Proposal for owner review. No application code exists yet. Choices marked *proposed* are recorded in `DECISIONS.md` and require owner approval.

---

## 1. Architectural drivers

The architecture is constrained by the following non-negotiable decisions from the v1.1 specification and `CLAUDE.md`:

1. **FastAPI modular monolith.** One deployable backend with explicit module boundaries; no microservices in the MVP.
2. **Next.js App Router PWA.** Mobile-first responsive web app; public, authenticated and admin surfaces in one frontend application (spec D11).
3. **PostgreSQL is the correctness boundary.** Transactions, constraints, row locks, partial unique indexes and durable idempotency decide outcomes. Redis is cache/rate-limit/ephemeral only.
4. **No custody.** No wallet, escrow, pooled funds, platform-held money, commissions or platform-controlled refunds.
5. **Direct UPI handoff is not payment verification.** Donor and recipient actions are attestations. Labels must never imply bank verification.
6. **Pseudonymity and privacy.** Public payloads, logs, analytics and share cards never expose phone numbers, raw VPAs, UTRs, credentials or moderation notes.
7. **One active wish, one donor per wish, no pooling.** Gift amounts are whole INR ₹10–₹100 inclusive.
8. **18+ only.** Age and legal acceptance are recorded before interactive use.
9. **Guests may browse; authentication is required for interactive actions.**
10. **Real-money production handoff stays disabled** behind a default-off feature flag until written legal/payment-partner approvals and explicit owner activation.

---

## 2. System context

```text
Visitor / Authenticated user / Moderator / Administrator
                         │ HTTPS
                         ▼
        Next.js App Router PWA (TypeScript)
        ├── public routes (discovery, wish detail, FAQ)
        ├── authenticated routes (wish, gift, profile, history)
        └── admin routes (moderation, audit)
                         │ /api/v1 (JSON, problem+json errors)
                         ▼
        FastAPI modular monolith (API process)
        ├── identity | profiles | payment methods
        ├── wishes | discovery | gifts / UPI handoff
        ├── karma | safety | notifications | admin
        └── core: config, DB, errors, logging, idempotency,
                   security, feature flags, outbox
             │                    │                    │
             ▼                    ▼                    ▼
     PostgreSQL            Redis (optional)      Provider interfaces
     source of truth       cache / rate limit    ├── SMS (test adapter)
     row locks, indexes    never correctness     ├── PaymentHandoff (test)
     outbox                                        └── Crypto/KMS (local)
             │
             ▼
     Worker process(es) — same backend image, different entrypoint
     wish expiry | reservation expiry | unverified timeout |
     outbox dispatcher | notification dispatcher
```

**Runtime processes**

| Process | Responsibility |
|---|---|
| `web` | Next.js server/render and static assets. |
| `api` | FastAPI HTTP application. Stateless; horizontally scalable. |
| `worker` | Background jobs and outbox processing. Idempotent; safe to run more than one instance with `FOR UPDATE SKIP LOCKED` claiming. |
| PostgreSQL | Authoritative state. Managed service in deployed environments. |
| Redis | Optional shared cache and rate-limit acceleration. Application must remain safe if absent. |

---

## 3. Target repository layout

```text
kindah/
├── CLAUDE.md
├── README.md                     # Phase 1: setup, run, test, migrate
├── .env.example                  # Phase 1: names only, no secrets
├── .gitignore                    # Phase 1
├── .editorconfig                 # Phase 1
├── Makefile                      # Phase 1: documented developer commands
├── docs/
│   ├── product/                  # authoritative specification (.docx)
│   └── implementation/           # plan, status, decisions, evidence, backlog
├── backend/
│   ├── pyproject.toml            # uv-managed; requires-python >= 3.12
│   ├── uv.lock
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py               # create_app()
│   │   ├── core/
│   │   │   ├── config.py         # pydantic-settings
│   │   │   ├── db.py             # engine, session, transaction helper
│   │   │   ├── errors.py         # problem+json catalogue
│   │   │   ├── logging.py        # JSON logs, request ID, redaction
│   │   │   ├── security.py       # tokens, hashes, HMAC
│   │   │   ├── idempotency.py    # durable request replay
│   │   │   ├── outbox.py         # transactional outbox writer
│   │   │   ├── time.py           # UTC + Asia/Kolkata helpers
│   │   │   └── feature_flags.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── router.py     # mounts module routers
│   │   ├── modules/
│   │   │   ├── identity/         # OTP, sessions, consent, account status
│   │   │   ├── profiles/         # display name, avatar, city
│   │   │   ├── payment_methods/  # VPA encryption, HMAC, versions, mask
│   │   │   ├── wishes/           # create/withdraw, expiry, cooldown
│   │   │   ├── discovery/        # feed, cursor, filters, Surprise Me
│   │   │   ├── gifts/            # reservations, handoff, outcomes, events
│   │   │   ├── karma/            # ledger, projections, streaks, badges
│   │   │   ├── safety/           # reports, blocks, moderation queue
│   │   │   ├── notifications/    # inbox, outbox consumption, delivery
│   │   │   └── admin/            # RBAC, moderation actions, audit
│   │   ├── providers/
│   │   │   ├── sms/              # SmsProvider + local/test adapter
│   │   │   ├── payment_handoff/  # PaymentHandoffProvider + test adapter
│   │   │   └── crypto/           # CryptoProvider + local AES-GCM adapter
│   │   ├── workers/
│   │   │   ├── runner.py         # poll/claim loop, graceful shutdown
│   │   │   ├── wish_expiry.py
│   │   │   ├── reservation_expiry.py
│   │   │   ├── unverified_timeout.py
│   │   │   ├── outbox_dispatcher.py
│   │   │   └── notification_dispatcher.py
│   │   └── db/
│   │       └── migrations/       # Alembic versions
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── concurrency/
│       ├── security/
│       └── privacy/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── eslint.config.mjs
│   ├── vitest.config.ts
│   ├── playwright.config.ts      # Phase 5/8
│   ├── public/                   # manifest, icons, static assets
│   └── src/
│       ├── app/
│       │   ├── (public)/         # landing, discover, wish detail, FAQ
│       │   ├── (auth)/           # OTP sign-in, onboarding
│       │   ├── (app)/            # wish create, gift flow, me, history
│       │   └── admin/            # moderation and audit
│       ├── components/           # shared accessible UI primitives
│       ├── features/             # discover, wish, gift, profile, admin
│       ├── lib/
│       │   ├── api/              # typed fetch client, error mapping
│       │   └── auth/             # in-memory access token + refresh
│       └── styles/               # design tokens
├── deploy/
│   ├── docker-compose.yml        # optional local Postgres/Redis
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── Dockerfile.web
└── .github/
    └── workflows/
        └── ci.yml
```

The layout is a target, not a Phase 1 mandate to create every file. Files are added when their owning phase is implemented.

---

## 4. Backend modular monolith

### 4.1 Request path

```text
HTTP request
  → ASGI middleware (request ID, correlation, access log, CORS, security headers)
  → /api/v1 router
  → module router (auth/authorization dependency, DTO validation)
  → module service (business rules, transaction)
  → module repository/SQLAlchemy session
  → PostgreSQL
  → explicit response DTO (never ORM serialisation)
  → problem+json on error
```

### 4.2 Module anatomy

Each module may contain:

```text
modules/<name>/
├── router.py        # endpoints, dependencies, status codes
├── schemas.py       # Pydantic request/response DTOs
├── service.py       # business rules and transaction orchestration
├── models.py        # SQLAlchemy tables owned by this module
└── queries.py       # read models / list queries (optional)
```

### 4.3 Module responsibilities

| Module | Owns | Key responsibilities |
|---|---|---|
| `identity` | `users` (auth/account fields), `user_sessions`, OTP challenges, consent timestamps | OTP request/verify, phone normalization and protection, sessions, age/terms acceptance, account status transitions. |
| `profiles` | Public profile fields and profile updates | Unique pseudonym, avatar, optional city, public-safe profile DTO. |
| `payment_methods` | `recipient_payment_methods` | VPA encryption, keyed HMAC, masking, versioning, privacy acknowledgement, re-authentication on change. |
| `wishes` | `wishes` | Create/withdraw, validation, one-active-wish invariant, expiry, cooldown, wish-state transitions. |
| `discovery` | Read models over `wishes`/profiles | Cursor feed, Fresh/Random ordering, city filter, exclusions, Surprise Me (phase per decision). |
| `gifts` | `wish_reservations`, `gifts`, `gift_events` | Atomic reservation, handoff issuance, donor outcomes, recipient confirmation, extension, terminal states, idempotency orchestration. |
| `karma` | `karma_events` (+ projections later) | Idempotent ledger writes after recipient confirmation; balance/history; streaks/badges in Phase 7. |
| `safety` | `moderation_reports`, `user_blocks` (+ moderation actions) | Reports and dedupe, blocks, auto-hide threshold, moderation queue inputs. |
| `notifications` | `notifications`, `notification_deliveries` | In-app inbox, outbox consumption, delivery adapters, retry/dead-letter. |
| `admin` | `admin_audit_logs` (+ admin action coordination) | RBAC, MFA enforcement, warn/restrict/suspend/ban, wish restore/remove, immutable audit. |

### 4.4 Dependency and transaction rules

1. **No cross-module table writes.** A module writes only tables it owns. Other modules call its service functions.
2. **No cross-module ORM imports.** Modules interact through service interfaces and shared DTOs/types. The gift orchestrator may call `wishes.lock_and_validate(...)`, `payment_methods.get_snapshot(...)`, `profiles.assert_recipient_eligible(...)`, and `karma.award_for_confirmation(...)`, passing the shared SQLAlchemy session.
3. **One transaction per command.** The gift-creation, donor-outcome, recipient-confirmation and worker paths each run in a single database transaction with a consistent lock order.
4. **Wish-state ownership stays in `wishes`.** The gifts module calls a wish-transition function; it does not set `wishes.status` directly.
5. **Side effects after commit only.** Notifications, SMS/push, analytics and UPI app handoff happen after commit, usually via the outbox. No external call is made while holding row locks.
6. **Outbox rows are written in the same transaction as the domain change** through `core.outbox.enqueue(...)`.
7. **Public DTOs are explicit.** ORM entities are never serialised to responses. Sensitive columns are excluded by construction, not by response filtering.
8. **No business logic in routers.** Routers validate transport concerns and delegate to services.

### 4.5 Core components

| Component | Responsibility |
|---|---|
| `config` | Typed settings from environment; fail fast on missing required values; explicit environment (`local`, `development`, `staging`, `production`). |
| `db` | SQLAlchemy 2 engine/session lifecycle, transaction context manager, deadlock retry helper, health check. *Proposed sync engine + psycopg 3.* |
| `errors` | Central error catalogue matching spec §8.3; RFC 9457 `application/problem+json`; stable machine codes. |
| `logging` | Structured JSON logs, request/correlation ID, deny-by-default sensitive-field redaction, no body logging. |
| `security` | JWT access tokens, opaque refresh tokens (hashed), CSRF, HMAC helpers, constant-time comparisons, rate-limit keys. |
| `idempotency` | Durable request replay keyed by `(actor_id, endpoint, idempotency_key)` with request hash, response status/body (sensitive fields excluded) and retention policy. |
| `outbox` | Transactional event append with unique idempotency key; claim/retry/complete helpers for workers. |
| `time` | UTC storage and explicit `Asia/Kolkata` conversion for day-based rules. |
| `feature_flags` | Environment-backed flags, including `PAYMENTS_LIVE_ENABLED` default `false`. |

### 4.6 Provider interfaces

```text
SmsProvider
  send_otp(phone_e164, otp_code, expires_at) -> SendResult
  # Local/test adapter returns a deterministic code to the test harness only.
  # Production adapter not selected; production readiness = BLOCKED.

PaymentHandoffProvider
  create_handoff(gift, recipient_payment_method) -> Handoff
  # Builds UPI URI/QR payload from server-owned amount, payee and reference.
  # Test adapter uses a configured test VPA; no settlement or verification API.

CryptoProvider
  encrypt(plaintext, context) -> ciphertext
  decrypt(ciphertext, context) -> plaintext
  # Local AES-256-GCM adapter for development/test.
  # Production KMS envelope encryption adapter not selected; production readiness = BLOCKED.
```

Providers are injected through application settings, not imported ad hoc by modules. Test adapters are selected by environment, never by a client-controlled request field.

### 4.7 Worker model

*Proposed:* a single Python worker entrypoint that polls due work from PostgreSQL using `FOR UPDATE SKIP LOCKED`, with per-job idempotent handlers and graceful shutdown. Jobs are triggered by time (expiry sweeps) or by outbox rows. No Celery/Redis broker in the MVP.

Worker rules:

- Claim a bounded batch; process each item in its own transaction.
- Re-read and re-check state under row locks before acting.
- Use stable idempotency keys; duplicate delivery must be safe.
- Record attempts, next retry and terminal failure; dead-letter rows are visible to operators.
- Never hold a transaction open across an external provider call where avoidable.
- Workers and API share the same domain services.

---

## 5. Frontend architecture

### 5.1 Route groups

| Route group | Purpose |
|---|---|
| `(public)` | Landing/discover, wish detail, FAQ. Server-renderable, public-safe data only. Guests allowed. |
| `(auth)` | OTP sign-in, verification, 18+/terms acceptance, profile setup. |
| `(app)` | Create/withdraw wish, gift amount/review/handoff/return, await recipient, recipient confirmation, My Kindness, notifications. |
| `admin` | Moderation queue, user/wish/gift detail, actions, audit. Stronger authentication and MFA. |

### 5.2 Data and auth handling

- Server Components fetch public discovery data server-side for fast first paint.
- Interactive/authenticated flows use client components and the typed API client.
- Access token is held **in memory only**; refresh token is an opaque `Secure`, `HttpOnly`, `SameSite` cookie. The client refreshes once on 401 and retries the request.
- No phone, VPA, UTR, token or full gift payload in `localStorage` or client analytics.
- API errors map to user-facing states from the spec's error catalogue; no raw backend messages shown.
- Every screen implements loading, empty, success, error and (where relevant) offline states.

### 5.3 UI system and accessibility

- Tailwind-based design tokens; accessible headless primitives for dialogs, menus and focus management.
- 44×44 px minimum touch targets; visible focus; semantic landmarks and labels.
- Status is never conveyed by colour alone.
- Reduced-motion support; celebration effects optional.
- WCAG 2.2 AA is the target for primary journeys.

### 5.4 PWA

- Web app manifest, icons, theme colour, installability.
- Service worker caches only static shell assets. **Never cache authenticated API responses, gift data or private history.**
- Offline state is honest: browsing may show cached shell; interactive/payment actions fail safely rather than pretending success.

---

## 6. Data architecture

### 6.1 Conventions

- UUID primary keys (application-generated or database-generated; pick one and keep it consistent).
- All timestamps `timestamptz`, stored UTC.
- Canonical uppercase enum values in PostgreSQL, mirrored in Python enums and TypeScript unions.
- Financial/audit rows are never cascade-deleted. FK delete policies are deliberate (`RESTRICT`/soft delete).
- Messages, amounts and state values are constrained at both database and API layers.
- Sensitive values (phone, VPA, UTR, OTP, tokens, UPI URI) are encrypted or hashed; plaintext is never logged.

### 6.2 Tables by phase

The spec's logical schema is the full target, not a first-migration mandate. Tables are created when their owning phase needs them.

| Phase | Tables |
|---|---|
| 1 | `alembic_version` only; no domain tables. |
| 2 | `users`, `user_sessions`, `otp_challenges` (implementation addition), `consent_acceptances` or consent columns on `users`. |
| 3 | `recipient_payment_methods`, `wishes`. |
| 5 | `wish_reservations`, `gifts`, `gift_events`, `karma_events`, `idempotency_records` (implementation addition), `outbox_events`. |
| 6 | `moderation_reports`, `user_blocks`, `moderation_actions`, `admin_audit_logs`, `notifications`, `notification_deliveries`, `account_deletion_requests`. |
| 7 | `user_badges`, `discovery_exposures`; karma projections. |
| 8 | No new core tables expected; operational/retention additions only after approval. |

### 6.3 Canonical state machines

Three distinct enums and tables (never one shared enum):

```text
wish_status:        OPEN, LOCKED, PAYMENT_CLAIMED, GRANTED,
                    UNVERIFIED, DISPUTED, EXPIRED, UNDER_REVIEW, REMOVED
gift_status:        CREATED, HANDOFF_ISSUED, DONOR_PENDING,
                    DONOR_CLAIMED_PAID, RECIPIENT_CONFIRMED, UNVERIFIED,
                    DISPUTED, FAILED, ABANDONED, CANCELLED
reservation_status: ACTIVE, RELEASED, EXPIRED, CONSUMED
```

Transition authority is defined in spec §4 and must be encoded in a single state-machine module with tests, not scattered conditionals.

### 6.4 Critical constraints

| Constraint | Purpose |
|---|---|
| Partial unique index on `wishes(user_id)` where `status IN ('OPEN','LOCKED')` | At most one active wish per user. |
| Partial unique index on `wish_reservations(wish_id)` where `status='ACTIVE'` | Exactly one active reservation per wish. |
| `UNIQUE(gift_id)` on `wish_reservations` | One reservation per gift. |
| `UNIQUE(payment_ref)` on `gifts` | Stable handoff reference. |
| `CHECK(amount_inr BETWEEN 10 AND 100 AND amount_inr = floor(amount_inr))` | Whole-INR bounds. |
| `CHECK(extension_count BETWEEN 0 AND 1)` | One Still Processing extension. |
| `CHECK(expires_at > reserved_at)` | Reservation sanity. |
| Unique idempotency keys on `gift_events`, `karma_events`, `outbox_events` | Duplicate-safe processing. |
| Unique `mobile_hmac` and `vpa_hmac` | One account per number; duplicate-VPA detection. |
| Unique `(user_id, display_name)` with normalised comparison | Pseudonym uniqueness. |
| Unique `(reporter_id, target_type, target_id)` on reports | One report per reporter/target. |

### 6.5 Idempotency

- Required on all retryable mutations, at minimum `POST /gifts`, donor outcome, recipient confirmation and payment-method updates.
- Record: actor, endpoint, key, request hash, response status, response body (sensitive fields excluded), created time, retention time.
- Same key + same request hash → replay the original response.
- Same key + different request hash → `409 IDEMPOTENCY_CONFLICT`.
- The record and the domain mutation commit atomically. A crash before commit leaves no record and no mutation; a crash after commit leaves a replayable record.
- Sensitive handoff material (UPI URI/QR) is stored encrypted on the gift and is re-hydrated only for the authorised donor; it is never stored in plaintext in the idempotency record.

### 6.6 Locking and transaction order

**Consistent lock order: wish → reservation → gift.** All code paths use it to reduce deadlocks; deadlock victims are retried safely with the same idempotency key.

| Operation | Locks and guards |
|---|---|
| Gift creation | Lock wish `FOR UPDATE`; validate eligibility; insert gift, reservation, events, outbox; update wish LOCKED; commit. |
| Donor outcome | Lock wish, then reservation, then gift; verify actor and expected state; apply one transition; update wish/reservation; append events/outbox; commit. |
| Recipient confirmation | Same lock order; verify actor is recipient and gift is DONOR_CLAIMED_PAID; first valid outcome wins; write karma once; commit. |
| Reservation expiry | Same lock order; re-check state and timestamps; abandon only eligible gifts; never reopen a claimed/pending payment. |
| Unverified timeout | Lock gift/wish; only `DONOR_CLAIMED_PAID` past deadline → `UNVERIFIED`; no karma. |
| Wish expiry | Lock candidate OPEN wishes; expire once; set cooldown once. |

### 6.7 Sensitive-data storage

| Data | Storage |
|---|---|
| Mobile number | Encrypted at rest + keyed HMAC for lookup/uniqueness. Never returned publicly. |
| VPA | Encrypted at rest (KMS envelope in production) + keyed HMAC for duplicate detection + masked representation for UI. |
| UPI URI/QR | Encrypted handoff payload on the gift; never logged or included in analytics; donor-only access. |
| UTR | Optional user-supplied, unverified; encrypted or excluded from storage unless needed for support; never public. |
| OTP | Hashed with expiry and attempt counters; never logged; test adapter exposes it only to the test harness. |
| Refresh token | Hashed server-side; raw value only in the HttpOnly cookie. |
| Admin notes | Moderator-only; never in public DTOs, logs or notifications. |

### 6.8 Outbox

- Domain mutation and outbox row commit in one transaction.
- Outbox row: aggregate type/id, event type, payload (sensitive-field-free or encrypted), idempotency key, attempts, next attempt, processed time, dead-letter reason.
- Payloads for notifications contain IDs and display-safe fields only; the consumer fetches what it needs.
- Delivery is at-least-once; consumers are idempotent.

---

## 7. Critical data flows

### 7.1 Guest discovery

1. Browser requests `/` or `/wishes`; Next.js server or client calls `GET /api/v1/wishes`.
2. Discovery service selects OPEN, unexpired wishes whose recipient is ACTIVE, has an active payment method, is not blocked, and is not under review/removed.
3. Public DTO contains pseudonym, avatar, optional city, relative timestamp, mood, message and optional suggested amount. No phone, VPA, UTR, payment reference or moderation data.
4. Cursor pagination uses a stable `(created_at, id)` tuple; Random uses a session seed and deterministic ordering.
5. Selecting a wish or using Surprise Me requires authentication; the detail page prompts OTP.

### 7.2 OTP sign-in

1. `POST /auth/otp/request` normalises the Indian mobile number, enforces per-phone/IP limits, stores a hashed OTP challenge with expiry and attempt count, and calls `SmsProvider`.
2. In local/test environments, the test adapter makes the code available only to the test harness; the API never returns it.
3. `POST /auth/otp/verify` checks hash, expiry, attempts and replay; marks the number verified; creates or loads the single account; records 18+/terms acceptance on first login; issues an access token and a rotating refresh cookie.
4. Interactive endpoints require a valid access token; account status checks run on every protected dependency.

### 7.3 VPA save/update

1. Authenticated user submits VPA plus privacy acknowledgement, with recent re-authentication.
2. Syntax regex validates format only; no ownership claim is made.
3. `CryptoProvider.encrypt` stores the VPA; a keyed HMAC supports duplicate detection; a masked value is stored for display.
4. A change increments the payment-method version and invalidates any not-yet-issued handoffs. Existing gifts keep their snapshotted version.
5. Public APIs, logs and analytics never expose the VPA.

### 7.4 Wish publish

1. Authenticated user with an active payment method submits message, mood, optional amount/city.
2. Validate 10–120 Unicode characters; reject URLs, phone/VPA-like strings, HTML and prohibited content; validate mood enum; validate optional amount as whole INR 10–100.
3. Enforce cooldown and the partial unique index for one OPEN/LOCKED wish.
4. Persist with `expires_at = now + 24h`; publish; enqueue notification/outbox event.

### 7.5 Gift creation and UPI handoff (highest-risk flow)

Preconditions: authenticated donor, `Idempotency-Key`, wish OPEN and eligible, recipient ACTIVE with an active payment method, donor not blocked/restricted, donor unresolved-claim count below 2.

1. Look up the idempotency record. If present: same request hash → replay original response; different hash → `409 IDEMPOTENCY_CONFLICT`.
2. Begin transaction.
3. `SELECT wish FOR UPDATE`.
4. Re-validate eligibility under the lock.
5. Insert gift with `CREATED` then `HANDOFF_ISSUED`, unique `payment_ref`, integer `amount_inr`, snapshotted `payment_method_id/version`, recipient/donor IDs.
6. Insert `wish_reservations` row with `ACTIVE`, `expires_at = now + 10m`, `extension_count = 0`.
7. Transition wish `OPEN → LOCKED` through the wishes service.
8. Append `gift_events` and `outbox_events` with unique idempotency keys.
9. Build the UPI URI/QR from server-owned data; persist the handoff payload **encrypted**; record the idempotent response (URI excluded from plaintext storage). Do not expose it yet.
10. Commit.
11. Return the persisted response, including the handoff, to the donor.
12. A concurrent request serialises on the wish row and then receives `409 WISH_UNAVAILABLE`.

> **Decision needed (`DEC-A02`):** spec §4.4 says the URI must not be generated before commit, while §4.2 says it must be persisted. The proposed interpretation is: generate from validated/persisted server-owned data inside the transaction but do not expose it until after commit. If the owner requires literal post-commit generation, a recovery path must complete a committed-but-unissued handoff idempotently.

### 7.6 Donor outcome

1. Authenticate donor; require idempotency key; replay-safe.
2. Lock wish → reservation → gift.
3. Verify actor is the donor and the gift is in `HANDOFF_ISSUED` or `DONOR_PENDING`.
4. Apply exactly one outcome:
   - **PAID**: gift → `DONOR_CLAIMED_PAID`; wish → `PAYMENT_CLAIMED`; reservation → `CONSUMED`; set recipient response deadline (+24h). No karma.
   - **STILL_PROCESSING**: gift → `DONOR_PENDING`; extend the ACTIVE reservation once to a maximum total of 20 minutes. A second request is rejected or replayed, not extended again.
   - **FAILED**: gift → `FAILED`; reservation → `RELEASED`; wish → `OPEN` only if still within its original 24-hour lifetime and otherwise eligible, else `EXPIRED`.
5. Append events and outbox rows; commit.
6. Any outcome after PAID is rejected with `422 INVALID_STATE_TRANSITION`; late retries return the committed result.

### 7.7 Recipient confirmation and karma

1. Authenticate recipient (only the recipient account may act); require idempotency key.
2. Lock wish → reservation → gift.
3. Require gift `DONOR_CLAIMED_PAID`; apply the first valid outcome:
   - **RECEIVED**: gift → `RECIPIENT_CONFIRMED`; wish → `GRANTED`; validate/store reaction and ≤120-character message; write karma ledger events once; enqueue thank-you/notification events.
   - **NOT_RECEIVED**: gift → `DISPUTED`; wish → `DISPUTED`; no karma; enqueue dispute/support event.
4. A conflicting later outcome does not apply a second transition; it is returned as invalid state or routed to support.
5. Commit; notification delivery happens asynchronously and never rolls back the domain transaction.

### 7.8 Timeout workers

| Worker | Cadence | Behaviour |
|---|---|---|
| Wish expiry | 1 min | Expire eligible OPEN wishes; start 72h cooldown once; idempotent. LOCKED wishes resolve through their reservation. |
| Reservation expiry | 30–60 s | Lock wish/reservation/gift; abandon only eligible handoffs; never release a claimed or pending payment; expire rather than reopen where required. |
| Unverified timeout | 5 min | `DONOR_CLAIMED_PAID` past the 24h deadline → `UNVERIFIED`; no karma. |
| Outbox dispatcher | Continuous | Claim due outbox rows, deliver idempotently, retry with backoff, dead-letter and alert. |

> **Decision needed (`DEC-A04`):** from `DONOR_PENDING`, spec §4.1 permits reopening on ABANDONED within the lifetime while §4.3 says never release a pending gift. Proposed safe default: expire the wish and route to support; never reopen.

---

## 8. API surface map

All endpoints are under `/api/v1`, return JSON and use the error catalogue in spec §8.3.

| Module | Endpoint(s) | Access | Phase |
|---|---|---|---|
| Identity | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/logout` | Public / user | 2 |
| Profile | `GET/PATCH /me`, `DELETE /me` | User | 2 (deletion Phase 6) |
| Payment methods | `PUT /me/payment-method` | User + re-auth | 3 |
| Wishes | `POST/DELETE /wishes`, `GET /me/wishes` | User | 3 |
| Discovery | `GET /wishes`, `GET /wishes/{id}`, `GET /wishes/surprise` | Public / user | 4 (Surprise per `DEC-A01`) |
| Safety | `POST /wishes/{id}/reports`, `POST /users/{id}/reports`, `POST/DELETE /users/{id}/block` | User | 6 |
| Gifts | `POST /gifts`, `GET /gifts/{id}`, `POST /gifts/{id}/donor-outcome`, `POST /gifts/{id}/recipient-confirmation`, `GET /me/gifts` | User / participant | 5 |
| Notifications | `GET /me/notifications`, `POST /me/notifications/{id}/read` | User | 6 |
| Admin | `GET /admin/reports`, `GET /admin/users/{id}`, `POST /admin/users/{id}/actions`, `POST /admin/wishes/{id}/actions`, `GET /admin/gifts/{id}`, `GET /admin/audit-logs` | Admin + MFA | 6 |

Contract rules: explicit request/response DTOs, server-side validation for every mutation, idempotency on retryable writes, participant/role authorisation on every private read, and public payloads that cannot contain private fields by construction.

---

## 9. Security and privacy architecture

| Control | Implementation |
|---|---|
| Transport | TLS/HSTS; secure headers; strict CORS allow-list; CSP. |
| Authentication | Short-lived JWT access token; opaque rotating refresh token hashed in DB; `Secure`, `HttpOnly`, `SameSite` cookie; CSRF protection on cookie-authenticated routes. |
| OTP | Hashed codes, expiry, attempt limits, resend throttling, replay protection, anti-enumeration responses; 3 requests per phone per 15 min plus IP controls. |
| Authorization | Per-endpoint dependencies; participant checks for gifts; role checks for admin; account-status enforcement; IDOR tests. |
| Admin | MFA (TOTP proposed), least privilege, mandatory reason, append-only audit log, exceptional/audited plaintext VPA access. |
| Data at rest | Mobile, VPA, UTR and handoff payloads encrypted via `CryptoProvider`; lookup HMACs documented with rotation. |
| Logging | Structured JSON, request IDs, deny-by-default redaction; no OTP, tokens, phone, VPA, UTR or UPI URI; no request/response body logging. |
| Analytics | Pseudonymous IDs only; exclude phone/VPA/UTR/private messages. |
| Public responses | Explicit DTOs; privacy tests assert forbidden fields are absent from feed, detail, share and error payloads. |
| Abuse | Rate limits, report dedupe, auto-hide threshold, unresolved-claim cap, account status gates. |
| Dependencies | Lockfiles, dependency/secret scanning in CI (hardening in Phase 8). |

**Privacy invariant:** no code path may construct a public response, log record, analytics event or share card from an ORM entity containing a sensitive column. Public DTOs are assembled from allow-listed fields.

---

## 10. Environments, configuration and operations

| Environment | Purpose | Data |
|---|---|---|
| Local | Developer work | Synthetic only. |
| Development | Shared integration | Test accounts, synthetic data. |
| Staging | Production-like E2E/device tests | Synthetic data. |
| Production | Controlled Bengaluru beta | Real users; real-money handoff only after explicit approval. |

**Configuration**

- Environment variables with typed validation; `.env.example` contains names and safe defaults, never real secrets.
- Environment-backed feature flags. `PAYMENTS_LIVE_ENABLED=false` is the default everywhere; enabling it requires the Phase 8 external gates and explicit owner approval.
- Provider selection by environment (`local/test` adapters vs production adapters).

**Observability**

- JSON logs with request/correlation IDs; latency, error-rate and worker-lag metrics.
- Health: `/healthz` (process liveness) and `/readyz` (database required; Redis optional/degraded).
- Alerts on API error rate, worker backlog/dead letters, outbox age and database health.
- Sentry/equivalent and dashboards in Phase 8.

**Backups and retention**

- Managed PostgreSQL backups; restore drills before public beta; owner-approved RPO/RTO.
- Retention configurable; destructive cleanup only after counsel approval; financial/audit records preserved.

---

## 11. Testing architecture

| Layer | Scope | Tooling |
|---|---|---|
| Unit | Eligibility, cooldown, amount bounds, state transitions, karma rules, streak boundaries, fairness weights | pytest |
| Integration | API + PostgreSQL + migrations; auth, wishes, gifts, moderation, admin RBAC | pytest + HTTPX + real PostgreSQL |
| Concurrency | Parallel gift creation, PAID vs expiry, FAILED vs PAID, confirmation vs timeout, idempotency replay, partial-index races | pytest with separate sessions/threads and barriers |
| Security | IDOR, CSRF, XSS, injection, OTP abuse, token replay, privilege escalation | pytest + API tests |
| Privacy | Public DTOs, logs, analytics, cache, exports | pytest + log capture + response snapshots |
| Frontend component | Forms, states, accessibility semantics | Vitest + Testing Library |
| E2E | Browse → auth → gift → donor outcome → recipient confirmation → karma | Playwright (Phase 5 onward) |
| Performance | Feed, Surprise Me, concurrent gift creation, admin queue | Phase 8 load tooling |

**Non-negotiable gift tests (spec §18):** two simultaneous donors; same-key replay; same key/different payload conflict; PAID vs reservation expiry; FAILED vs PAID; recipient confirmation vs 24h timeout; abandoned reservation then valid re-reservation; old UPI URI after release. Phase 5 cannot be `DONE` if any is skipped or failing.

Test databases are real PostgreSQL 16, migrated with Alembic. SQLite is not used for persistence or concurrency tests.

---

## 12. Deliberate non-goals

- Microservices, separate admin service, event streaming platform.
- Wallet, escrow, stored value, platform custody, commissions, ads or cash-redeemable karma.
- Native iOS/Android apps, international users, multiple currencies.
- Open-ended chat, media attachments in wishes, proof-of-use or impact reporting.
- Redis as a lock/state authority.
- Automated UPI payment verification without an authorised provider.
- Elaborate analytics or badge systems before core correctness (Phase 7/8).
- Storing plaintext VPAs, UTRs, phone numbers, OTPs, tokens or UPI URIs.

---

## 13. Evolution rules

1. The v1.1 specification wins over this document. Conflicts are recorded in `DECISIONS.md`, not resolved silently.
2. New tables/columns are allowed when they strengthen invariants or privacy; weakening a constraint requires an owner decision.
3. A module may not reach into another module's tables. If a new flow needs it, add a service function or an explicit read model.
4. Every mutation is server-validated and transactionally state-checked; every async job is idempotent and retry-safe.
5. Any proposal to add custody, pooling, multiple donors per wish, minors, international users or cash-value rewards requires a new product/legal/architecture review.
6. Keep the monolith modular; performance work should optimise queries, indexes and workers before considering service splits.
