# Threat Model and Security Review — Chillar / Kindly

**Date:** 2026-11-24
**Scope:** FastAPI modular monolith, Next.js PWA, PostgreSQL, optional Redis, outbox workers,
local/test adapters. Production UPI handoff is disabled and external gates are not cleared.

## Assets

- Phone numbers, VPA/payment-method records and UTR/payment references (private; encrypted at rest)
- Session/refresh credentials, CSRF tokens, admin MFA secrets/recovery codes
- Wish and gift state, reservations, karma ledger and badges
- Support/moderation text, appeals, admin audit log and outbox records
- Admin/moderator availability and integrity

## Actors

- Guest (read-only discovery)
- Authenticated user (donor/recipient)
- Restricted/suspended/banned user (read own profile, inbox and appeals only)
- Moderator/admin (MFA-protected)
- External providers: OTP/SMS, UPI handoff, crypto/KMS, future push
- Operator with database/backup access

## Trust boundaries

1. Browser ↔ Next.js: untrusted input; client gating is UX only.
2. Next.js ↔ FastAPI: bearer access token, refresh cookie + CSRF, CORS allow-list.
3. FastAPI ↔ PostgreSQL: correctness boundary; row locks, constraints, unique keys, idempotency.
4. FastAPI ↔ providers: test adapters only; production credentials/approvals are external.
5. Admin console ↔ admin APIs: role check + TOTP MFA token bound to the access session.
6. Workers ↔ PostgreSQL: `SKIP LOCKED`, idempotency keys, append-only records.

## Principal threats and controls

| Threat | Control | Residual risk |
|---|---|---|
| OTP brute force / SMS abuse | Six-digit OTP, attempt cap, phone+IP windows, test code only in non-production | Production provider and SIM-swap controls external |
| Session theft / fixation | Short-lived access JWT in memory, rotating opaque refresh cookie, family revocation, CSRF double-submit | Browser compromise outside scope |
| Account enumeration | Generic OTP responses and 404s for unavailable wishes/users | Timing/provider metadata outside scope |
| IDOR on gifts/wishes/admin | Participant checks on gift reads/actions; public allow-list DTOs; admin role+MFA dependencies | Add endpoint-specific tests as endpoints grow |
| Donor/recipient privacy leakage | Public DTOs exclude phone/VPA/UTR/URI/donor identity; share cards allow-listed; logs redact sensitive shapes | Future analytics/delivery adapters must reuse allow-lists |
| Double reservation / duplicate karma | Wish row locks, one ACTIVE reservation, unique karma idempotency keys, gift state guards | Concurrency tests must remain green |
| Race between PAID and expiry/confirmation | Row locks + state re-checks; true race tests in `test_gifts.py` | DB/provider latency not load-tested at beta scale |
| Admin compromise | DB role + TOTP MFA (provisional DEC-I13), recovery codes hashed/one-time, session-bound token, append-only audit | Owner confirmation, role provisioning UI and MFA recovery policy pending |
| Moderator abuse | Mandatory reasons, self/privileged-target guards, append-only audit, appeals | No second-admin approval for high-impact actions |
| Report brigading / ban evasion | Unique reporter/target, hourly cap, threshold auto-hide once, blocks, account statuses | Phone/device provenance and appeal abuse are operational concerns |
| Deletion/retention misuse | Non-destructive request, active-transaction guards, no anonymisation before DEC-O8 | Retention approval and account-linking policy external |
| Outbox duplicate/loss | Transactional write, `SKIP LOCKED`, attempts/backoff, dead-letter visibility, idempotent handlers | External delivery providers not selected; alert escalation owner pending |
| Web/API hardening | CORS allow-list including admin MFA header, CSP/security headers, redacted structured logs | CSP review and pen-test not completed |
| Supply chain | `npm audit` 0, `pip-audit` no known vulnerabilities, Bandit medium/high clean, no tracked env/secret patterns | No container image exists; CI remote run still pending |

## Security review checklist

- [x] Passwords/OTP/PINs never logged; log redaction covers phone/VPA/UPI URI/bearer tokens.
- [x] Raw VPA/phone/UTR not returned in public payloads; admin access requires role+MFA.
- [x] Session refresh rotation, CSRF header+`SameSite` cookie, CORS allow-list.
- [x] PostgreSQL constraints/locks/idempotency enforce one reservation and one karma award.
- [x] Append-only admin audit trigger rejects UPDATE/DELETE.
- [x] Report/block/moderation/deletion/appeal endpoints have authorization tests.
- [x] Dependency and static scans run; MD5 feed-ordering use clarified as non-security.
- [ ] Independent penetration test / threat-model review by security owner.
- [ ] Deployed staging RPO/RTO, monitoring/alert ownership and incident paging.
- [ ] Production KMS, SMS/OTP, UPI/bank and legal approvals.

## Open findings and gates

1. **DEC-I13 admin MFA** is an implemented recommended default, not an owner-approved decision;
   production admin activation remains blocked.
2. **DEC-O7 removal cooldown** and **badge thresholds** are provisional implementation defaults.
3. Deployed staging and approved RPO/RTO are unavailable; only a local restore drill is recorded.
4. No production payment handoff, KMS, OTP or push/SMS provider is selected.
5. A future exposure-cap policy may require privacy review before adding tracking.
6. The MD5 call in `discovery/service.py` is used only for deterministic ordering with
   `usedforsecurity=False`; the SQL `md5()` expression is likewise non-security ordering.
