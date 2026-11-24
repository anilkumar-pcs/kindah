# Runbook — Late Payment or Old UPI Handoff

**Status:** Active for local/test operation. Real-money UPI handoff remains disabled until
the external legal and bank/payment-partner gates are cleared and the owner approves activation.
**Owner decision:** `DEC-O5`; admin visibility and resolution approved as `DEC-A06`.

## What this covers

A donor may complete a UPI payment after the reservation expired, after the recipient's
24-hour response window closed, or from a handoff screen they had left open. The platform
does not verify bank settlement and cannot reverse, refund, reassign or reopen the wish.
The gift remains in its terminal or released state. Support handles the report manually.

## User-facing position

- A UPI intent/QR handoff is not proof of payment.
- The donor's "Donor says paid" and the recipient's confirmation are attestations.
- Chillar / Kindly never holds funds and cannot issue a refund or force a reversal.
- If money left the donor's account but the gift did not complete, the donor should raise a
  support case and, where appropriate, contact their bank or UPI provider.
- Karma is awarded only after recipient confirmation. A late or disputed payment does not
  automatically award karma.

## Participant flow

1. The donor or recipient opens the gift in the app and chooses **Report a problem**.
2. The participant submits one of `LATE_PAYMENT`, `DONOR_CLAIM`, `RECIPIENT_DISPUTE` or
   `OTHER` with a short description.
3. The case is created against the gift and is visible only to the reporter and administrator
   accounts. Raw VPA, phone numbers and the full UPI URI are never returned to the reporter.
4. A second open case for the same gift, reporter and case type returns
   `409 SUPPORT_CASE_EXISTS`; continue the existing case instead of opening another.

API: `POST /api/v1/gifts/{gift_id}/support-cases` (authenticated participant).

## Administrator flow

Administrator authorization uses the `users.role` column in PostgreSQL (`ADMIN` or
`MODERATOR`) plus a verified MFA session. The database role is the sole authority. Use
`backend/scripts/grant_role.py` only for initial bootstrap or recovery, then manage roles through
the admin Users tab. Do not create environment allow-lists.

1. List open cases: `GET /api/v1/admin/support-cases?status=OPEN`.
2. Review the full case detail returned by the admin endpoint. It includes the encrypted
   description decrypted for the administrator, gift and wish status, amount, payment
   reference, masked recipient VPA, donor/recipient display names and the UTR/reference if
   the donor supplied one.
3. Check the gift status, payment reference, donor outcome timestamps and any prior case
   entries before acting. The platform has no bank confirmation feed by design.
4. Record the outcome with `POST /api/v1/admin/support-cases/{case_id}/resolve` and a clear
   resolution note. The note is encrypted at rest and audited.
5. Do not promise a refund, reversal, reassignment, automatic reopening or karma correction.
   If the case needs provider action, advise the participant to contact their bank/UPI
   provider and record that guidance in the resolution note.
6. Use `CLOSED` only through a future administrative workflow; the current resolve endpoint
   moves the case to `RESOLVED`.

## Audit and data handling

- Case descriptions and resolution notes are encrypted with the application crypto provider.
- `SUPPORT_CASE_CREATED` and `SUPPORT_CASE_RESOLVED` audit events record identifiers and
  status only, never the case text, raw VPA, phone number or UPI URI.
- Support text, raw VPA, UTR and moderation notes must never appear in public payloads or
  application logs.
- The admin list does not include the full UPI URI. Only the masked recipient VPA is exposed.

## Verification

- `backend/tests/integration/test_support_cases.py` covers participant creation, duplicate
  prevention, non-participant denial, non-admin denial, admin visibility, redaction,
  resolution, double-resolution rejection and audit redaction.
- Re-run: `cd backend && uv run pytest tests/integration/test_support_cases.py -q`.
