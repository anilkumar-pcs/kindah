# Repository Assessment — Chillar / Kindly

**Phase:** 0 — Repository discovery and planning
**Date:** 2026-11-23
**Assessed by:** Claude Code (AI assistant)
**Specification:** Chillar / Kindly — Development-Ready Product & Engineering Specification v1.1 (23 Nov 2026)
**Execution plan:** `docs/implementation/IMPLEMENTATION_PLAN.md` v1.0 (23 Nov 2026)
**Status:** Draft for owner review. Nothing in this document is owner approval.

---

## 1. Executive summary

- The repository is **greenfield**. It contains no application source code, tests, package manifests, database schema or migrations, CI configuration, container/deployment configuration, or version-control history.
- The only existing artefacts are the governing documents: `CLAUDE.md`, the v1.1 product specification (`.docx`), the implementation plan, and an initial status tracker. `DECISIONS.md`, `CHANGELOG.md` and `TEST_EVIDENCE.md` were zero-byte placeholders at assessment start.
- `backend/` and `frontend/` exist but are empty. They confirm the intended two-application split but contain nothing to reuse.
- There is no legacy architecture, technical debt, duplicate implementation or risky coupling to refactor. Nothing needs to be migrated or deleted. All existing work is documentation, and it has been preserved.
- The specification is detailed enough to implement against. The plan's phase boundaries map cleanly to it. A small number of specification/plan ambiguities are recorded in `DECISIONS.md`; the most material are Surprise Me/Random-tab scope, UPI URI generation ordering, wish eligibility after a donor PAID claim, and `DONOR_PENDING` handling at reservation timeout.
- The highest-risk work is the Phase 5 gift/reservation state machine and its concurrency behaviour. It must be built test-first against real PostgreSQL, not SQLite and not Redis locks.
- Phase 1 is feasible on this machine, but the local toolchain is incomplete: Python 3.12+ and a Python package manager are absent (system Python is 3.9.6), and PostgreSQL, Redis and Docker are not installed. Homebrew and Node.js 26/npm 11 are available. These are installation tasks, not architectural blockers.
- Recommended next step: owner approves the assessment, architecture, decision defaults and proposed Phase 1 scope; Phase 0 then closes and Phase 1 begins.

---

## 2. Current repository inventory

| Area | Path | Current state |
|---|---|---|
| Project instructions | `CLAUDE.md` | Present. Sets source of truth, working protocol and non-negotiable constraints. |
| Product specification | `docs/product/Chillar_Kindly_Development_Ready_Specification_v1.1.docx` | Present. Authoritative v1.1 specification, 23 Nov 2026. |
| Implementation plan | `docs/implementation/IMPLEMENTATION_PLAN.md` | Present. Phases 0–8, tasks, exit criteria, reporting format. |
| Implementation status | `docs/implementation/IMPLEMENTATION_STATUS.md` | Present. Initial dashboard; Phase 0 `NOT_STARTED` at assessment start. |
| Decisions log | `docs/implementation/DECISIONS.md` | Empty at assessment start; populated during Phase 0. |
| Changelog | `docs/implementation/CHANGELOG.md` | Empty at assessment start; populated during Phase 0. |
| Test evidence | `docs/implementation/TEST_EVIDENCE.md` | Empty at assessment start; populated during Phase 0. |
| Backend | `backend/` | Empty directory. No source, manifest, tests, migrations or configuration. |
| Frontend | `frontend/` | Empty directory. No source, manifest, tests or configuration. |
| Database | — | No schema, ORM models, migrations or local database. |
| Cache | — | No Redis configuration or client. |
| CI/CD | — | No CI workflow, build scripts or deployment configuration. |
| Version control | `.git/` | **Absent.** The directory is not a git repository. |

**Verification performed**

```text
find . -type f -not -path './.git/*' | sort
→ 7 files: CLAUDE.md, five implementation docs, one product spec .docx

git status
→ fatal: not a git repository (or any of the parent directories): .git

find backend frontend -type f
→ 0 files
```

At assessment start the `docs` folder was named `docs/implmentation` (misspelled). It has been renamed to `docs/implementation` to match `CLAUDE.md`, the implementation plan and the status file. The rename preserved all file contents; a backup was taken before any Phase 0 edit.

---

## 3. Toolchain assessment

Probed on the development machine on 2026-11-23 (macOS 15.8.3, arm64).

| Tool | Required / expected | Observed | Assessment |
|---|---|---|---|
| Python | 3.12+ per spec §6.1 | 3.9.6 only | **Gap.** Install 3.12+ before Phase 1. Do not downgrade the target stack. |
| Python package manager | Not mandated | `uv`, `poetry`, `pipx` absent | **Gap.** `uv` recommended (manages Python 3.12+ and lockfiles). |
| Node.js | Next.js runtime | v26.13.1 | Available. Confirm compatibility with the pinned Next.js version in Phase 1. |
| npm | Frontend package manager | 11.20.0 | Available. Proposed default. |
| pnpm / yarn | Optional | Absent | Not required. |
| PostgreSQL | Source of truth | Not installed; no `psql`/`initdb` | **Gap.** Install PostgreSQL 16 locally or approve a container runtime. |
| Redis | Cache/rate-limit only | Not installed | Phase 1 can start without it; install before rate-limit work. Must never be a correctness boundary. |
| Docker / Colima / Podman | Container images for deployment | Absent | Optional for early local development; required later for image builds/deploy rehearsal. |
| Homebrew | Local installation | 7.0.15 | Available. Enables native PostgreSQL/Redis install. |
| Git | Version control | 2.39.5 | Available, but repository is not initialised. |

**Implications**

1. Phase 1's "fresh local setup succeeds" criterion cannot pass until Python 3.12+, PostgreSQL and a package manager are installed. This is a documented prerequisite, not a reason to change the architecture.
2. The local database must be real PostgreSQL. SQLite cannot exercise partial unique indexes, `SELECT … FOR UPDATE`, `timestamptz` behaviour or concurrency semantics required by the gift flow.
3. Node 26 is newer than the current LTS line. Pin the Next.js version at Phase 1 and verify build/test support; fall back to a supported Node LTS if necessary.

---

## 4. Documentation findings

| ID | Finding | Consequence |
|---|---|---|
| F-01 | `docs/implmentation/` was misspelled relative to every documented path (`docs/implementation/…`). | Corrected by content-preserving folder rename in Phase 0. |
| F-02 | `DECISIONS.md`, `CHANGELOG.md` and `TEST_EVIDENCE.md` were empty. | Populated in Phase 0; the plan's tracking protocol can now be followed. |
| F-03 | No git repository and no history. | No rollback baseline. Version control initialisation and an initial commit are proposed as the first Phase 1 task. |
| F-04 | The specification exists only as `.docx`; it was converted to plain text for this assessment. | The `.docx` remains authoritative. No derived Markdown copy was created to avoid divergence; a generated, explicitly non-authoritative copy can be added later if searchability is needed. |
| F-05 | Plan task counts are planning estimates. | Phase 1 remains 10 tasks. Repository-specific detail is added in `IMPLEMENTATION_BACKLOG.md` without changing the plan's scope or counts. |
| F-06 | Spec §3.1 requires Fresh **and Random** tabs and §4.5 defines Surprise Me; plan P4.3 names only Fresh ordering, and the plan defers "Surprise Me fairness weights" to Phase 7 while providing no base Surprise Me task. | Recorded as ambiguity `DEC-A01`. Owner must confirm whether Surprise Me and the Random tab are Phase 4 or Phase 7, and whether they are launch requirements. |
| F-07 | Spec §4.2 says the UPI URI/QR is persisted; §4.4 says a URI must not be generated or returned before the transaction commits. | Recorded as ambiguity `DEC-A02` with a proposed interpretation. The gift flow cannot be finalised until this is settled. |
| F-08 | Spec §3.2 limits a user to one **OPEN or LOCKED** wish and starts cooldown only after GRANTED or EXPIRED. After a PAID claim the wish is PAYMENT_CLAIMED, so the literal rules appear to permit posting another wish during that period. | Recorded as ambiguity `DEC-A03`. Owner must confirm intended behaviour. |
| F-09 | Spec §4.1 allows LOCKED → OPEN on ABANDONED within the original lifetime; §4.3 says never release a wish while the gift is DONOR_PENDING. The timeout path from DONOR_PENDING is therefore contradictory. | Recorded as ambiguity `DEC-A04`. Must be resolved before Phase 5; proposed safe default is to expire, never reopen. |
| F-10 | No visual mockups or brand assets are present beyond the screen inventory and accessibility requirements in spec §5. | Phase 1 can proceed with neutral design tokens. Brand/visual direction is an owner input (`DEC-A05`). |
| F-11 | No OTP/SMS, KMS/cloud, payment-partner or admin-MFA provider is selected. | Implement provider interfaces plus local/test adapters. Production readiness for those capabilities must remain `BLOCKED` until providers and approvals exist. |

---

## 5. Reuse and preservation decisions

| Item | Decision |
|---|---|
| Specification | Authoritative as supplied. Not edited, copied or reinterpreted silently. |
| `CLAUDE.md` | Preserved unchanged. Paths in it are now correct after the folder rename. |
| Implementation plan | Preserved; only Phase 0 task checkboxes and status references are updated per the plan's own tracking rules. |
| Status / decisions / changelog / evidence files | Maintained in place, per the plan. Existing empty files were populated, not discarded. |
| `backend/` and `frontend/` | Retained as the intended application roots. No files existed to preserve. |
| Application code | None exists. Nothing to reuse, migrate, delete or refactor. |
| Backup | Original docs copied to `/tmp/kindah-docs-backup-20261123-223328` before Phase 0 edits. |

**No existing application work was overwritten.** The only structural change is the docs-folder rename.

---

## 6. Gap analysis against the specification

No functional capability is implemented. The table records the gap per capability and which phase owns it. "Gap" means the delta from the specification, not just missing code.

| # | Capability | Spec reference | Current state | Gap | Target phase |
|---|---|---|---|---|---|
| G-01 | Runtime and application skeleton | §6.1, §17 E0 | None | FastAPI app factory, settings, health/readiness, error handling, structured logging | Phase 1 |
| G-02 | Frontend shell and PWA baseline | §5, §6.1 | None | Next.js App Router shell, routing, responsive layout, API client, manifest | Phase 1 |
| G-03 | PostgreSQL, ORM and migrations | §6.1, §7 | None | SQLAlchemy 2, Alembic, session lifecycle, migration policy | Phase 1 |
| G-04 | Redis (non-authoritative) | §6.1 | None | Optional client/health handling; safe under outage; no correctness use | Phase 1 |
| G-05 | CI, lint, format, type-check, tests | §16.1 | None | GitHub Actions, backend/frontend quality commands, Postgres service | Phase 1 |
| G-06 | Secrets and environment configuration | §11 | None | `.env.example`, validation, no committed secrets | Phase 1 |
| G-07 | Observability and redaction | §11, §14 | None | JSON logs, request IDs, PII/secret redaction, metrics hooks | Phase 1, reinforced Phase 8 |
| G-08 | Identity and OTP | §2, §3.1, §11 | None | OTP challenges, SMS provider interface/test adapter, rate limits, one account per verified number | Phase 2 |
| G-09 | Sessions and revocation | §8, §11 | None | Access token, rotating refresh session, logout, expiry, CSRF | Phase 2 |
| G-10 | Age, terms and privacy consent | §2 | None | 18+ self-declaration, policy versions and timestamps | Phase 2 |
| G-11 | Pseudonymous profile | §2, §5 | None | Unique display name, avatar, optional city, public-safe DTOs | Phase 2 |
| G-12 | Account lifecycle enforcement | §2.1 | None | ACTIVE/RESTRICTED/SUSPENDED/BANNED/DELETION_PENDING enforcement | Phase 2 (deletion workflow Phase 6) |
| G-13 | VPA capture, encryption and masking | §3.3, §11 | None | KMS-compatible encryption, keyed HMAC, masked view, versioning, re-authentication, privacy acknowledgement | Phase 3 |
| G-14 | Wish creation and validation | §3.2 | None | Message/mood/amount/city validation; prohibited content filters; one active wish; 24h expiry; 72h cooldown | Phase 3 |
| G-15 | Wish withdrawal and expiry worker | §3.2, §13 | None | Idempotent withdrawal and expiry, cooldown start once | Phase 3 |
| G-16 | Public discovery feed | §3.1, §4.1 | None | Cursor feed, Fresh ordering, city filter, exclusions, public-only DTO | Phase 4 |
| G-17 | Random tab / Surprise Me | §3.1, §4.5 | None | Random ordering; Surprise Me fairness, skips and exposure policy. **Scope ambiguity** (`DEC-A01`). | Phase 4 / Phase 7 |
| G-18 | Wish detail and selection gate | §3.1, §5.1 | None | Public detail; authentication required before selection | Phase 4 |
| G-19 | Gift reservation and handoff | §4.2–§4.4, §9 | None | Three state machines, partial unique index, atomic reservation, UPI URI/QR, feature flag | Phase 5 |
| G-20 | Donor outcomes and attestations | §4.2, §8.2, §9.3 | None | PAID / STILL_PROCESSING / FAILED; one extension; honest labels; no state escape from PAID | Phase 5 |
| G-21 | Recipient confirmation | §4.2, §8.2 | None | RECEIVED / NOT_RECEIVED, participant-only authorisation, 24h deadline, terminal outcomes | Phase 5 |
| G-22 | Late-payment / old-URI support path | §4.3, §9.5 | None | Warning copy, support routing, no automatic refund or silent reassignment | Phase 5 |
| G-23 | Gift history and status | §8 | None | Participant-only sent/received history | Phase 5 |
| G-24 | Karma ledger | §3.6 | None | Append-only idempotent ledger after recipient confirmation; no karma on donor claim | Phase 5 |
| G-25 | Karma history, streaks, badges | §3.6 | None | Balance projection, IST-day streaks, badge rules | Phase 7 |
| G-26 | Thank-you reaction/message | §3.7 | None | Predefined reactions + ≤120-char message, private to participants | Phase 7 (data captured Phase 5) |
| G-27 | Reporting, blocking and auto-hide | §3.8, §10 | None | Deduplicated reports, block relationships, 3-report review threshold | Phase 6 |
| G-28 | Moderation and admin | §10.1, §8 | None | Admin area in same app, RBAC, MFA, action guards, append-only audit | Phase 6 |
| G-29 | Notifications and outbox | §3.9, §13 | None | In-app inbox, durable outbox, retry/dead-letter visibility | Phase 5 outbox write / Phase 6 delivery |
| G-30 | Account deletion and retention | §2.1, §11 | None | Request workflow, anonymisation, retention-safe handling (counsel-approved) | Phase 6 / Phase 8 |
| G-31 | Share cards | §5.1, D8 | None | Privacy-safe share card; no donor identity | Phase 7 |
| G-32 | Security controls | §11 | None | TLS/HSTS/CSP/CORS, CSRF, rate limits, dependency scanning, admin MFA | Phase 1 baseline / Phase 8 audit |
| G-33 | Accessibility and responsive UX | §5.2, §14 | None | WCAG 2.2 AA target, touch targets, keyboard, reduced motion | Ongoing; audited Phase 8 |
| G-34 | Legal and partner gates | §12 | **Not started** | Written legal opinion, UPI/bank position, DPDP, IT rules, tax, age, brand | External; before public beta |
| G-35 | Environments and deployment | §16 | None | Local → development → staging → production, containers, backups | Phase 1 local; Phase 8 production |
| G-36 | Test suites | §15, §18 | None | Unit, integration, concurrency, security, privacy, E2E, performance | Every phase; mandatory gift tests Phase 5 |
| G-37 | Runbooks and support | §16.2 | None | UPI/late payment, disputes, OTP outage, VPA takeover, moderation, restore, incident | Phase 6 / Phase 8 |

### 6.1 Non-obvious gaps not explicit in the plan

- **OTP challenge storage** is not in the spec's logical schema. Implementation must add a durable OTP challenge record (hashed code, expiry, attempts, phone binding) or justify an ephemeral equivalent. Recommended: PostgreSQL.
- **Idempotency records** are required by spec §4.4 but not listed in the §7 table. Add a dedicated table with `(actor_id, endpoint, idempotency_key)` uniqueness and request/response hashes.
- **Unresolved donor claims cap (max 2)** from spec §4.6 is not a task in the plan. Enforce it inside gift creation in Phase 5.
- **Re-authentication on VPA change** from spec §3.3 is not explicit in plan P3.4. Add it to the Phase 3 acceptance criteria.
- **Random tab** from spec §3.1 is absent from plan P4.3. Covered by `DEC-A01`.
- **Cheer note length (80 characters)** from spec §4.6 is not mentioned in the plan. Add it to Phase 5 gift creation and UI validation.
- **Admin access to plaintext VPA** must be exceptional, purpose-limited and audited (spec §10.1). Add an explicit policy/implementation task in Phase 6.
- **Feature flag default** for real-money handoff must be `OFF` in every environment, with no production activation path except explicit owner approval (Phase 8).
- **Analytics events** must use pseudonymous IDs and exclude phone/VPA/UTR/message content. No analytics is planned before Phase 8; if added earlier, this rule applies.

---

## 7. Technical risks

Likelihood/impact are qualitative. Mitigations are proposed, not approved.

| ID | Risk | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|---|
| R-01 | No version control baseline; Phase 0/1 edits are not diffable or revertible via git. | Certain | High | Initialise git and commit the baseline as P1.1 before any application code. | 1 |
| R-02 | Local machine lacks Python 3.12+, PostgreSQL, Redis and Docker; Phase 1 cannot meet its setup exit criteria until installed. | Certain | Medium | Install `uv` + Python 3.12, PostgreSQL 16, Redis 7 (or approve a container runtime). Record exact versions. | 1 |
| R-03 | Gift/reservation concurrency is the correctness core; mistakes cause double gifts, stranded wishes or false karma. | Medium | Critical | Test-first state machine; real PostgreSQL row locks and partial indexes; mandatory race tests from spec §18; no Redis locks. | 5 |
| R-04 | UPI URIs cannot be revoked; a "released" wish may still receive a late transfer. | Certain | High | Honest warnings, no automatic reopen after PAID, support/dispute runbook, real-money flag OFF in development. | 5 |
| R-05 | VPA/mobile/UTR encryption and key management are underspecified until a KMS is selected. | Medium | High | `CryptoProvider` interface, local AES-GCM test adapter, production KMS gate, key-rotation and recovery documentation. | 3 |
| R-06 | No OTP/SMS provider is selected; production authentication is blocked. | Certain | Medium | Provider interface + deterministic test adapter; rate limits and abuse tests; production readiness marked `BLOCKED`. | 2 |
| R-07 | Legal, UPI/bank, DPDP, intermediary, tax and brand gates are unresolved; public launch is prohibited without them. | Certain | Critical | Track as external blockers; keep real-money disabled; no launch claim in code or docs. | 8 |
| R-08 | Admin MFA mechanism/provider is not selected. | Medium | High | TOTP (RFC 6238) with recovery codes, enforced for admin routes; no SMS-only MFA. | 6 |
| R-09 | Spec/plan ambiguity on Surprise Me, Random and post-PAID wish eligibility could cause rework. | Medium | Medium | Resolve in Phase 0 decisions before Phase 4/5 implementation. | 0 |
| R-10 | Retention and deletion rules need Indian counsel; premature deletion could destroy required records or retain too much. | High | High | Configurable retention, no destructive cleanup before approval, deletion workflow preserves financial/audit records. | 6/8 |
| R-11 | No visual design assets; frontend could invent inconsistent UX. | Medium | Medium | Neutral Phase 1 design tokens; owner supplies/approves visual direction before polishing user journeys. | 1/4 |
| R-12 | Redis outage could accidentally affect correctness if introduced as a lock or state store. | Medium | High | Architectural rule and review checklist: Redis is cache/rate-limit only; tests run with Redis absent. | 1+ |
| R-13 | IST day-boundary bugs in streaks and cooldowns. | Medium | Medium | Store UTC, convert explicitly with `zoneinfo("Asia/Kolkata")`, test across UTC midnight. | 7 |
| R-14 | Idempotency records grow unbounded or are purged too early, breaking safe retries. | Medium | Medium | Configurable retention (proposed 30 days), cleanup job, monitor table size, never purge records for unresolved gifts. | 5+ |
| R-15 | Cloud/worker platform choice deferred (O10) may cause deployment rework. | Medium | Medium | Keep runtime container-friendly and provider-neutral; defer only managed-service selection. | 1/8 |
| R-16 | Test/CI database differs from production (SQLite, version skew). | Medium | High | Real PostgreSQL 16 locally and in CI; migrations applied before tests; pin versions. | 1 |
| R-17 | Logs or analytics leak phone, VPA, UTR, OTP, tokens or UPI URI. | Medium | Critical | Deny-by-default redaction, structured logs, privacy tests, no request/response body logging, no URI logging. | 1+ |

---

## 8. Assessment conclusions

1. **No existing implementation to preserve beyond documentation.** The workspace is a clean greenfield start.
2. **No architectural conflict with the specification.** The spec's prescribed stack (Next.js PWA, FastAPI, SQLAlchemy 2, PostgreSQL, Redis as non-authoritative, Alembic) is appropriate and is the proposed baseline.
3. **The work is delivery-sequenced, not discovery-sequenced.** Phase 1 can start as soon as the owner approves scope and the local prerequisites are installed.
4. **The main risks are correctness, privacy and external approvals — not legacy code.** They are managed through phase gates, real-PostgreSQL tests and keeping real-money handoff disabled.
5. **Phase 0 can close only after owner approval of this assessment and the proposed Phase 1 scope** (P0.10).

---

## 9. Assessment limitations

- There was no application to build, run or test, so no runtime behaviour could be verified.
- The `.docx` specification was read via a text conversion; tables and layout were flattened. The original document remains authoritative.
- The toolchain probe reflects only this development machine. CI and other developer environments may differ.
- No owner interview was conducted. Every recommendation in `DECISIONS.md` is an AI proposal and is explicitly not approval.
