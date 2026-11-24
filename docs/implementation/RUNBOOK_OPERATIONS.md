# Operations Runbook — Trust, Safety and Payments

**Scope:** Local/staging operation of the FastAPI + Next.js monolith. Production launch remains
blocked by the external legal, bank/UPI, KMS, OTP and retention gates. This document does not
authorise production activation.

**Contacts and escalation:** use the operator on-call channel and legal/security owner configured
outside this repository. Do not place phone numbers, credentials or customer data in this file.

## 1. Late payment or old UPI handoff

Follow `RUNBOOK_LATE_PAYMENT.md`. Summary: support-only; no platform refund, reversal,
reassignment or automatic reopening; an admin DB role can see the gift/support detail and resolve
with an audited note. MFA is optional and currently disabled by owner override.

## 2. Recipient dispute / “I did not receive it”

1. The recipient opens the gift and chooses **No, I did not receive it**; the gift becomes
   `DISPUTED` and the wish `DISPUTED`.
2. The donor receives an in-app notification. No karma is awarded.
3. Support creates a case (`RECIPIENT_DISPUTE` or `OTHER`) from the gift.
4. An admin DB role reviews the case, gift status, payment reference, masked VPA, UTR if supplied,
   and participant names. Never share raw VPA, phone, UTR or UPI URI outside the admin console.
5. Resolve with a factual note. Do not promise a refund or bank verification. Advise the donor to
   contact their bank/UPI provider if they believe money moved.
6. If the recipient later confirms receipt, that is a new attestation and does not silently
   reverse the dispute; escalate to the owner for a policy decision.

## 3. OTP / SMS outage

1. Check the configured SMS provider and application health. The test adapter is not a production
   provider.
2. Do not disable OTP, share test codes publicly, or bypass authentication.
3. Existing access tokens remain valid until expiry (15 minutes); refresh is unavailable if OTP
   provider failure prevents new sign-in.
4. Communicate the outage through approved channels; do not expose phone numbers in logs or
   tickets.
5. After recovery, verify sign-in, session refresh, consent and rate-limit behavior.

## 4. VPA / recipient payment-method change

1. A recipient changes their UPI ID through My Space; reauthentication is required and the
   payment method version increments.
2. In-flight gifts retain the `payment_method_version` captured at reservation time. Do not edit
   an in-flight gift or resend a stale UPI URI.
3. If a recipient reports a wrong/old VPA, support reviews the gift and may resolve the case; the
   platform cannot redirect or reverse a payment.
4. If a donor paid an old/incorrect VPA, follow the late-payment/dispute runbook and advise bank
   or UPI-provider escalation.

## 5. Moderation escalation

1. Reports are deduplicated per reporter/target; three unique wish reports may move an active
   OPEN wish to `UNDER_REVIEW`. This is not proof of wrongdoing.
2. Admin signs in with a moderator/admin DB role and opens `/admin`. TOTP MFA is optional and
   currently disabled by owner override; if `ADMIN_MFA_REQUIRED=true`, verify it before proceeding.
3. Review the report queue and target context. Apply HIDE, RESTORE, REMOVE, WARN, RESTRICT,
   SUSPEND, BAN or REACTIVATE with a mandatory reason. Every action writes an append-only
   `admin_audit_logs` row with a request ID.
4. RESTORE is allowed only for an unexpired `UNDER_REVIEW` wish with no unresolved gift. REMOVE
   never silently bypasses an active gift; resolve/dispute the gift first.
5. A restricted/suspended/banned user can sign in for own profile, notifications and `/appeals`.
   They can submit one appeal per action; an accepted appeal does not automatically reactivate
   the account. Apply a separate audited REACTIVATE action if warranted.
6. If an admin action is disputed, preserve the audit log and escalate; do not edit or delete
   audit rows (the database trigger rejects mutation).

## 6. Account deletion request

1. Request is non-destructive: user status becomes `DELETION_PENDING`, sessions remain usable for
   read/appeal/cancel, and interactive actions are blocked.
2. Active wishes/unresolved gifts block the request. Do not force-delete records.
3. Admin can view requests in `/admin` (Deletion tab). Do not anonymise or delete financial/audit
   records until counsel-approved retention (`DEC-O8`) exists.
4. User can cancel and return to `ACTIVE`.

## 7. Outbox dead letters and notification delivery

1. Check `/admin` → Outbox or `GET /api/v1/admin/outbox/dead-letters` with an admin DB role
   (and MFA if `ADMIN_MFA_REQUIRED=true`).
2. Dead letters have already committed domain state; retrying must use only an idempotent handler.
3. Do not delete dead-letter rows. Investigate the event type, attempts and handler error class;
   escalate to engineering.
4. In-app notifications are deduplicated by `(user_id, dedupe_key)`. If a notification is missing,
   check the event transaction and dedupe key before inserting anything manually.

## 8. Restore and disaster recovery

1. Restore the latest approved PostgreSQL backup into a separate database first.
2. Run `alembic upgrade head`, verify migration revisions, then start the API with the restored
   database and confirm `/healthz`, `/api/v1/meta` and authentication.
3. Smoke-test: guest feed, OTP sign-in, one wish, one test handoff, support report, admin role login
   (and MFA if enabled).
   Do not use real money; production handoff remains disabled.
4. Record RPO/RTO and the drill outcome. RPO/RTO and backup provider selection remain external
   gates. Never restore over production without owner approval.

## 9. Privacy or security incident

1. Contain: revoke affected sessions/tokens, disable the affected credentials/provider, preserve
   logs and database evidence. Do not delete audit/outbox rows.
2. Do not paste phone numbers, VPAs, UTRs, UPI URIs, tokens or moderation notes into chat/email;
   use the approved incident channel.
3. Rotate JWT, refresh pepper, crypto/lookup/OTP HMAC keys only with a planned migration for
   encrypted data. Crypto key rotation is not yet automated; escalate.
4. Notify the owner/legal/security lead. Assess whether the incident triggers legal or regulatory
   notification duties.
5. After recovery, review append-only audit logs, session events, outbox dead letters and
   moderation actions. Record a post-incident report with request IDs.

## 10. Staging exercise record

At least the critical payment/dispute path must be exercised in a non-production environment.
Record the date, environment, participants, commands, outcome, deviations and follow-ups in
`TEST_EVIDENCE.md`. A local database/stack exercise does not replace a deployed staging drill when
one becomes available.

### Critical path checklist

- [ ] Sign in two separate accounts (donor and recipient).
- [ ] Recipient saves a masked VPA and publishes a wish.
- [ ] Donor creates a whole-INR handoff and receives a UPI URI/QR.
- [ ] Donor attests paid; recipient sees the claim and confirms or disputes.
- [ ] A support case is created and an admin DB role can see full details and resolve it.
- [ ] Audit entry contains actor, action, reason, request ID and no raw VPA/phone/UTR/URI.
- [ ] No real money is moved; production handoff remains disabled.
