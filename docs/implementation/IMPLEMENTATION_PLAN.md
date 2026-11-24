# Chillar / Kindly --- Claude Code Implementation Plan

**Plan version:** 1.0\
**Date:** 23 November 2026\
**Companion specification:** Chillar / Kindly --- Development-Ready
Product & Engineering Specification v1.1\
**Purpose:** Turn the product specification into a phased, verifiable
implementation that can be tracked across Claude Code sessions.

------------------------------------------------------------------------

## 1. How to use this plan

Treat the v1.1 product and engineering specification as the source of
truth for product behaviour, business rules, APIs, data constraints,
security and acceptance requirements. This file is the execution plan.
If they conflict, stop and record the conflict in
`docs/implementation/DECISIONS.md`; do not silently choose a behaviour.

Claude Code must work **one phase at a time**. Do not attempt a broad,
one-shot implementation of all phases. At the start of each session:

1.  Read the specification, this plan, `CLAUDE.md`, and
    `docs/implementation/IMPLEMENTATION_STATUS.md`.
2.  Inspect the current repository and git status before changing
    anything.
3.  Identify the current phase and the next incomplete task.
4.  State the intended scope and acceptance criteria before
    implementation.
5.  Implement only the current phase/task set, run the relevant tests,
    and report evidence.
6.  Update the status file, task checkboxes, decision log and test
    evidence before finishing.

A phase is not complete because code has been written. It is complete
only when its exit criteria are satisfied and the evidence is recorded.

### Status vocabulary

Use exactly these statuses in the progress tracker:

-   `NOT_STARTED`
-   `IN_PROGRESS`
-   `BLOCKED`
-   `DONE`

Only mark a task `DONE` when its acceptance criteria pass and the
evidence (test command, test result, manual verification, or approved
external dependency) is recorded. If a task is partially implemented,
keep it `IN_PROGRESS`.

------------------------------------------------------------------------

## 2. Delivery principles and hard constraints

1.  **Vertical slices over infrastructure breadth.** Prove the core user
    journey before building secondary features or every table in the
    target logical schema.
2.  **Modular monolith.** Keep the backend as a FastAPI modular
    monolith. Do not introduce microservices without an explicit
    architecture decision.
3.  **Spec-first.** Preserve the product decisions and state-machine
    invariants in the v1.1 specification.
4.  **No false payment certainty.** Direct UPI handoff is not payment
    verification. Donor PAID and recipient RECEIVED are attestations,
    not bank-verified facts.
5.  **No live money movement during development.** Build and test the
    UPI handoff behind a feature flag with mocked/test destinations. Do
    not enable real-money public transfers until the legal and
    bank/payment-partner gates in the specification are cleared and the
    product owner explicitly approves activation.
6.  **No custody.** Do not add wallet, escrow, pooled funds,
    platform-held money, commissions or refunds controlled by the
    platform.
7.  **Privacy by default.** Never expose mobile numbers, raw VPAs, UTRs,
    payment credentials or moderation notes in public responses, logs,
    analytics or share cards.
8.  **Database correctness is authoritative.** Use PostgreSQL
    constraints, transactions, row locks and idempotency. Redis locks
    must not be the correctness boundary.
9.  **Small-team sequencing.** Defer badges, advanced fairness
    analytics, optional push, rich admin analytics and delivery adapters
    until their planned phase.
10. **Do not fabricate external integrations.** If an OTP provider,
    cloud service, payment partner or credential is unavailable,
    implement an interface and a local/test adapter, document the
    dependency, and mark production readiness as blocked.

------------------------------------------------------------------------

## 3. Repository discovery and planning gate

### Phase 0 --- Understand before changing

**Goal:** Establish what already exists, what can be reused, and what
the implementation actually needs. No large-scale refactor or feature
implementation before this assessment.

**Tasks**

-   [x] P0.1 Inspect repository structure, languages, package managers,
    current application entry points and existing documentation.
-   [x] P0.2 Inspect current git branch, working tree, uncommitted
    changes and existing tests. Do not overwrite user work.
-   [x] P0.3 Identify frontend framework, backend framework,
    database/ORM, migration tool, cache, deployment setup and CI.
-   [x] P0.4 Map existing modules to the specification: identity,
    profiles, payment methods, wishes, discovery, gifts, safety, admin
    and notifications.
-   [x] P0.5 Identify missing capabilities, duplicate implementations,
    risky coupling and technical debt that affects the MVP.
-   [x] P0.6 Produce `docs/implementation/REPOSITORY_ASSESSMENT.md` with
    current state, reuse decisions, gaps and risks.
-   [x] P0.7 Produce `docs/implementation/ARCHITECTURE.md` with the
    proposed modular-monolith boundaries and key data flows.
-   [x] P0.8 Produce `docs/implementation/DECISIONS.md`; record
    unresolved decisions and proposed defaults without treating them as
    approved.
-   [x] P0.9 Convert the remaining phases into repository-specific tasks
    and dependency order.
-   [x] P0.10 Present the assessment and proposed Phase 1 scope for
    owner review before broad implementation.

**Exit criteria**

-   Repository and runtime are understood.
-   Existing work and uncommitted changes are preserved.
-   Architecture and module boundaries are documented.
-   Known blockers, external dependencies and unresolved decisions are
    visible.
-   A repository-specific backlog exists.
-   Owner has approved the implementation approach.

**Deliverables**

-   `REPOSITORY_ASSESSMENT.md`
-   `ARCHITECTURE.md`
-   `DECISIONS.md`
-   Initial `IMPLEMENTATION_STATUS.md`

------------------------------------------------------------------------

## 4. Phased implementation roadmap

## Phase 1 --- Foundation and runnable skeleton

**Goal:** A developer can clone the repository, configure local
environment variables, start the application and run automated checks
reliably.

**In scope**

-   [x] P1.1 Establish or confirm repository layout for frontend,
    backend, shared docs and deployment.
-   [x] P1.2 Create reproducible local development setup and
    `.env.example`; never commit secrets.
-   [x] P1.3 Configure FastAPI application factory, settings management,
    health/readiness endpoints and structured error handling.
-   [x] P1.4 Configure frontend application shell, routing, responsive
    layout and API client.
-   [x] P1.5 Configure PostgreSQL connectivity, SQLAlchemy 2 session
    lifecycle and Alembic migrations.
-   [x] P1.6 Configure Redis only for justified ephemeral needs (rate
    limits/cache); application must still handle Redis outage safely.
-   [x] P1.7 Add linting, formatting, type checking and unit-test
    commands for each application.
-   [x] P1.8 Add CI checks for install/build/lint/type-check/tests.
-   [x] P1.9 Add structured logging, correlation/request IDs and
    secret/PII redaction.
-   [x] P1.10 Document local startup, test and migration commands.

**Exit criteria**

-   Fresh local setup succeeds using documented steps.
-   Frontend and backend start independently and communicate.
-   Database migration up/down or documented forward-only policy is
    verified.
-   Health checks work.
-   CI passes on a clean checkout.
-   Logs contain no secrets, OTPs, raw VPA or sensitive payment data.

**Not in scope:** elaborate production infrastructure, multi-region,
microservices, advanced observability platform.

------------------------------------------------------------------------

## Phase 2 --- Identity, sessions and profile

**Goal:** A user can securely authenticate and maintain a pseudonymous
account.

**In scope**

-   [x] P2.1 Implement OTP request/verify service abstraction with
    local/test adapter and rate limiting.
-   [x] P2.2 Implement Indian mobile number normalization and
    one-account-per-verified-number enforcement.
-   [x] P2.3 Implement secure session/token lifecycle, refresh rotation
    or equivalent revocation-safe design, logout and expiry.
-   [x] P2.4 Implement first-login 18+ self-declaration and
    Terms/Privacy/Guidelines acceptance timestamps.
-   [x] P2.5 Implement pseudonymous display name and avatar; enforce
    uniqueness and safe validation.
-   [x] P2.6 Implement profile read/update and account status checks.
-   [x] P2.7 Implement authorization dependencies and ensure
    restricted/suspended/banned accounts cannot perform prohibited
    actions.
-   [x] P2.8 Add OTP abuse controls, audit events and security tests.
-   [x] P2.9 Implement frontend sign-in, verification, consent and
    profile setup flows.

**Exit criteria**

-   OTP flow works end-to-end with a test adapter.
-   Duplicate phone accounts are prevented.
-   Sessions expire/revoke correctly.
-   Interactive actions require authentication.
-   18+ and legal acceptance are recorded.
-   Public profile never reveals phone number or legal identity.
-   Authorization and abuse tests pass.

**External dependency:** Production OTP provider selection and
credentials.

------------------------------------------------------------------------

## Phase 3 --- Recipient payment method and wish lifecycle

**Goal:** An eligible user can configure a private receiving VPA and
publish one valid wish.

**In scope**

-   [x] P3.1 Implement VPA validation at syntax level and explicit
    beneficiary-validation status; do not claim ownership verification
    without an approved provider.
-   [x] P3.2 Encrypt VPA at rest using the selected deployment's
    secret/KMS strategy; store keyed HMAC fingerprint for duplicate
    detection.
-   [x] P3.3 Ensure VPA is masked in UI and never included in public
    APIs, logs or analytics.
-   [x] P3.4 Implement payment-method create/update/versioning and
    privacy acknowledgement.
-   [x] P3.5 Implement wish creation, content validation, mood enum,
    optional city and optional suggested amount.
-   [x] P3.6 Enforce `MIN_GIFT_INR=10`, `MAX_GIFT_INR=100`, whole INR
    only for suggested amounts and later gift amounts.
-   [x] P3.7 Enforce one active wish per user, 24-hour expiry and
    72-hour cooldown according to the specification.
-   [x] P3.8 Implement wish withdrawal and expiry worker with idempotent
    state transitions.
-   [x] P3.9 Add database constraints and tests for duplicate active
    wishes, expiry races and cooldown.
-   [x] P3.10 Implement frontend VPA setup, disclosure, wish creation,
    preview, withdrawal and status display.

**Exit criteria**

-   User can save a VPA securely and see only a masked representation.
-   User can publish one eligible wish.
-   Invalid content and invalid amount suggestions are rejected.
-   Wish expiry/cooldown are enforced server-side.
-   Concurrent wish creation cannot violate the one-active-wish
    invariant.
-   VPA and user privacy tests pass.

**External dependency:** Approved VPA beneficiary validation approach;
do not misrepresent syntax validation as ownership validation.

------------------------------------------------------------------------

## Phase 4 --- Public discovery and selection

**Goal:** Visitors can browse public wishes; authenticated users can
view eligible wish details and initiate the gift journey.

**In scope**

-   [x] P4.1 Implement read-only public discovery feed with cursor
    pagination.
-   [x] P4.2 Exclude own, expired, locked, removed, under-review,
    blocked and ineligible wishes.
-   [x] P4.3 Implement optional city filter and Fresh ordering.
-   [x] P4.4 Implement wish detail view with only public-safe fields.
-   [x] P4.5 Enforce authentication before selecting/locking a wish.
-   [x] P4.6 Implement frontend feed, empty/loading/error states and
    mobile-responsive wish cards.
-   [x] P4.7 Add pagination, authorization, privacy and eligibility
    tests.

**Exit criteria**

-   Guest can browse without authentication.
-   Guest cannot reserve, report or interact.
-   Public API response contains no VPA, phone, UTR, payment credential
    or moderation data.
-   Feed pagination is stable and performant for expected beta volume.
-   Eligibility rules are tested.

**Deferred:** Surprise Me fairness weights and discovery exposure
analytics (Phase 7 unless a product decision moves them earlier).

------------------------------------------------------------------------

## Phase 5 --- Core gift, reservation and UPI handoff

**Goal:** Complete the most important product vertical slice: one donor
reserves one wish, receives a direct UPI handoff, attests an outcome,
and the recipient confirms or disputes.

**This phase has the highest correctness risk. Implement and test its
state machine before polishing the UI.**

**In scope**

-   [x] P5.1 Implement canonical enums and state transitions exactly as
    defined in specification Section 4.
-   [x] P5.2 Implement `wish_reservations` with explicit status,
    timestamps, extension count and partial unique index for one ACTIVE
    reservation per wish.
-   [x] P5.3 Implement `POST /api/v1/gifts` with authenticated donor,
    server-side amount validation, row locking and idempotency.
-   [x] P5.4 Persist gift, reservation, wish lock, gift event and
    outbox/domain event atomically.
-   [x] P5.5 Generate UPI intent/QR payload for test destinations behind
    a feature flag; clearly disclose bank-registered-name visibility.
-   [x] P5.6 Implement donor outcomes: PAID, STILL_PROCESSING and
    FAILED, with actor authorization and state guards.
-   [x] P5.7 Implement one allowed reservation extension and the
    configured reservation expiry worker.
-   [x] P5.8 Implement recipient RECEIVED/NOT_RECEIVED confirmation and
    24-hour response deadline.
-   [x] P5.9 Implement terminal states UNVERIFIED/DISPUTED and ensure no
    automatic reopening after a paid claim.
-   [x] P5.10 Implement late-payment/old-URI support path; do not
    promise platform-controlled reversal/refund.
-   [x] P5.11 Implement gift history/status for donor and recipient.
-   [x] P5.12 Implement karma ledger only after recipient confirmation;
    enforce unique idempotency key and no duplicate awards.
-   [x] P5.13 Add concurrency tests: simultaneous donors, donor outcome
    vs expiry, recipient confirmation vs timeout, retry and
    re-reservation.
-   [x] P5.14 Add end-to-end UI for amount selection, review, UPI
    handoff, return-to-app, donor outcome and recipient confirmation.
-   [x] P5.15 Keep production real-money handoff disabled until written
    legal and bank/payment-partner gates are cleared.

**Mandatory exit criteria**

-   Exactly one donor can hold an active reservation for a wish.
-   Duplicate requests with the same idempotency key replay the original
    response.
-   Reusing an idempotency key with a different payload returns
    conflict.
-   Failed/abandoned reservations release correctly and permit
    re-reservation only when the wish is still eligible.
-   A paid claim cannot be silently reopened or changed to FAILED.
-   Recipient confirmation is accepted only from the recipient account.
-   Timeout workers are idempotent and re-check state under
    transaction/row locks.
-   Karma is awarded once, only after recipient confirmation.
-   Old UPI URI limitations and late-payment handling are visible in UX
    and support runbook.
-   All critical concurrency and state-machine tests pass.
-   Real-money production feature flag remains OFF pending launch
    approvals.

**Do not mark Phase 5 DONE** if any mandatory race-condition test is
skipped or failing.

------------------------------------------------------------------------

## Phase 6 --- Trust, safety, moderation and operational support

**Goal:** The closed beta can be operated safely with basic abuse
handling and auditable moderator actions.

**In scope**

-   [x] P6.1 Implement wish/user reporting with duplicate-report
    prevention and abuse controls.
-   [x] P6.2 Implement block/unblock and ensure blocked users cannot
    discover or interact with each other as specified.
-   [x] P6.3 Implement auto-hide threshold and review queue.
-   [x] P6.4 Implement minimum protected admin/moderator area in the
    same application.
-   [x] P6.5 Implement role checks, admin MFA requirement and
    append-only admin audit log.
-   [x] P6.6 Implement warn/restrict/suspend/ban and wish restore/remove
    actions with state guards.
-   [x] P6.7 Implement basic appeal/support workflow and dispute
    visibility.
-   [x] P6.8 Implement account deletion request workflow and
    retention-safe anonymisation strategy, subject to counsel-approved
    retention.
-   [x] P6.9 Implement in-app notifications for critical gift and safety
    events.
-   [x] P6.10 Implement durable outbox processing and retry/dead-letter
    visibility for critical domain events.
-   [x] P6.11 Add runbooks for disputes, late payment, OTP outage, VPA
    change, moderation escalation, restore and privacy/security
    incident.

**Exit criteria**

-   Users can report and block.
-   Moderators can review and act with authorization and audit.
-   Admin actions cannot bypass gift/wish state invariants.
-   Critical notifications are durable and deduplicated.
-   Account deletion respects approved retention requirements.
-   Support can find and resolve operational cases without exposing
    secrets.
-   Runbooks are reviewed and exercised in staging.

------------------------------------------------------------------------

## Phase 7 --- Karma, retention loops and discovery enhancements

**Goal:** Complete non-monetary engagement features after core safety
and transaction correctness are proven.

**In scope**

-   [ ] P7.1 Implement karma history and balance projection from
    immutable karma ledger.
-   [ ] P7.2 Implement streak calculation with correct IST day
    boundaries.
-   [ ] P7.3 Implement badge rules and idempotent award processing.
-   [ ] P7.4 Implement thank-you reaction and optional message.
-   [ ] P7.5 Implement privacy-safe share cards.
-   [ ] P7.6 Implement Surprise Me with documented eligibility and
    weighted fairness.
-   [ ] P7.7 Add exposure records/caps only if required by the validated
    fairness policy.
-   [ ] P7.8 Add optional push/SMS delivery enhancements only when
    providers and consent are in place.

**Exit criteria**

-   Karma has no cash value or redemption.
-   Duplicate jobs/events cannot duplicate karma, streaks or badges.
-   Streak boundaries are tested in Asia/Kolkata.
-   Donor identity is never exposed in thank-you or share surfaces.
-   Surprise Me excludes ineligible wishes and applies documented
    weights.
-   Optional notification channels respect consent and provider
    configuration.

------------------------------------------------------------------------

## Phase 8 --- Hardening, launch readiness and Bengaluru beta

**Goal:** Prove the application is safe, supportable and reliable enough
for a controlled launch.

**In scope**

-   [ ] P8.1 Complete threat modelling and security review.
-   [ ] P8.2 Run dependency, secret, container and static-analysis
    scans.
-   [ ] P8.3 Run load tests for feed, authentication, gift creation and
    critical workflows using agreed beta assumptions.
-   [ ] P8.4 Verify rate limits, abuse protections and graceful
    degradation.
-   [ ] P8.5 Verify database backup and restore; document RPO/RTO
    targets approved by owner.
-   [ ] P8.6 Verify metrics, dashboards, alerts and on-call ownership.
-   [ ] P8.7 Verify accessibility, responsive UX and supported mobile
    browsers.
-   [ ] P8.8 Complete production deployment and rollback/forward-fix
    rehearsal.
-   [ ] P8.9 Complete legal review, written bank/payment-partner
    position, terms/privacy/community guidelines, grievance channel and
    retention approval.
-   [ ] P8.10 Complete UPI URI/QR testing across target apps/devices and
    document limitations.
-   [ ] P8.11 Obtain explicit owner approval to enable real-money
    feature flag, only after every external gate is met.
-   [ ] P8.12 Run internal alpha, then closed Bengaluru beta with daily
    safety/support review.

**Exit criteria**

-   No open critical/high security findings without explicit risk
    acceptance.
-   Backup restore and incident runbooks are exercised.
-   Monitoring and support ownership are live.
-   Legal and partner approvals are documented---not assumed.
-   Real-money feature activation has explicit owner approval.
-   Rollout can be paused or rolled back safely.
-   Beta exit metrics and safety thresholds are defined before cohort
    expansion.

------------------------------------------------------------------------

## 5. Cross-phase engineering standards

Every task that changes behaviour must include:

-   [ ] Acceptance criteria.
-   [ ] Unit tests for business rules.
-   [ ] Integration tests for persistence and API behaviour.
-   [ ] Authorization and privacy tests where relevant.
-   [ ] Failure/timeout/retry behaviour.
-   [ ] Migration and rollback/forward-fix consideration.
-   [ ] API documentation updates.
-   [ ] Logs/metrics that exclude sensitive data.
-   [ ] User-facing loading, empty, success and error states.
-   [ ] Relevant documentation and runbook updates.

Every database mutation must be validated server-side. Never rely on
frontend validation alone.

Every async job must be idempotent, observable, retry-safe and safe
under duplicate delivery.

------------------------------------------------------------------------

## 6. Persistent progress tracking

Create and maintain these files in the repository:

### `docs/implementation/IMPLEMENTATION_STATUS.md`

Keep a compact dashboard at the top:

  Phase                    Status          Tasks done   Tasks total Evidence / blocker
  ------------------------ ------------- ------------ ------------- --------------------
  0\. Discovery            NOT_STARTED              0            10 
  1\. Foundation           NOT_STARTED              0            10 
  2\. Identity             NOT_STARTED              0             9 
  3\. Recipient & wishes   NOT_STARTED              0            10 
  4\. Discovery            NOT_STARTED              0             7 
  5\. Gift & UPI           NOT_STARTED              0            15 
  6\. Trust & safety       NOT_STARTED              0            11 
  7\. Engagement           NOT_STARTED              0             8 
  8\. Hardening & beta     NOT_STARTED              0            12 

The task counts above are planning estimates. Update them if the
repository-specific backlog is refined; explain changes rather than
silently dropping scope.

### `docs/implementation/DECISIONS.md`

For each decision record:

-   ID
-   Question
-   Options
-   Recommendation
-   Owner decision
-   Date
-   Affected phases/tasks

Never treat an AI recommendation as owner approval.

### `docs/implementation/TEST_EVIDENCE.md`

For each verification record:

-   Date
-   Phase/task ID
-   Command or manual procedure
-   Environment
-   Result (PASS/FAIL/BLOCKED)
-   Relevant output/artifact
-   Known limitation

### `docs/implementation/CHANGELOG.md`

Record meaningful implementation milestones, migrations, API contract
changes and deviations from the spec.

### Task completion rule

For every completed task, update the checkbox in this plan and add a
one-line evidence entry to the status/evidence files. Do not claim
progress based only on generated code.

------------------------------------------------------------------------

## 7. Definition of phase completion

A phase can move to `DONE` only if all are true:

1.  All in-scope tasks are complete or explicitly deferred with owner
    approval.
2.  Phase exit criteria pass.
3.  Relevant automated tests pass.
4.  Migrations have been tested.
5.  Security/privacy implications are addressed.
6.  Documentation and API contracts are updated.
7.  Test evidence is recorded.
8.  No unresolved blocker is hidden.
9.  A concise phase summary is added to `IMPLEMENTATION_STATUS.md`.

If an external dependency blocks production use, the code may be
complete in test mode, but production readiness must remain `BLOCKED`
and the dependency must be named.

------------------------------------------------------------------------

## 8. End-of-session report format

At the end of every Claude Code work session, provide:

### Session summary

-   Phase and task IDs addressed.
-   What changed and why.
-   Important files/modules changed.

### Verification

-   Commands run.
-   Tests passed/failed/not run.
-   Migration status.
-   Manual checks performed.

### Progress

-   Phase status before and after.
-   Completed task IDs.
-   Remaining task IDs.

### Blockers and decisions

-   External dependencies.
-   Product/architecture questions requiring owner input.
-   Risks or spec conflicts.

### Next recommended step

-   The smallest next task set that advances the current phase safely.

Do not report a phase complete unless its exit criteria are met.

------------------------------------------------------------------------

## 9. First instruction to Claude Code

Start with **Phase 0 only**. Inspect the repository and the supplied
v1.1 specification. Do not implement features yet. Produce the
repository assessment, architecture proposal, decision log and
repository-specific task backlog. Identify any mismatch between the
actual repository and the specification. Then present the Phase 1 plan
and wait for approval before making broad changes.

After Phase 0 approval, proceed phase by phase. Do not jump ahead
because a later feature appears easy.
