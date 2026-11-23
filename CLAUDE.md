# Claude Code Instructions --- Chillar / Kindly

## Source of truth

-   Product and engineering requirements: the supplied **Chillar /
    Kindly Development-Ready Specification v1.1**.
-   Execution order, task IDs, goals, exit criteria and progress
    reporting: `docs/implementation/IMPLEMENTATION_PLAN.md`.
-   Current progress: `docs/implementation/IMPLEMENTATION_STATUS.md`.
-   Owner decisions: `docs/implementation/DECISIONS.md`.

If the spec and implementation plan conflict, do not guess. Record the
conflict and ask the owner.

## Working protocol

1.  At the start of every session, read the above documents and inspect
    `git status`.
2.  Work only on the current approved phase and its next incomplete
    tasks.
3.  Before editing, state scope, files likely to change, dependencies
    and acceptance criteria.
4.  Prefer small, reviewable changes. Do not perform unrelated
    refactors.
5.  Run relevant tests and report exact commands and outcomes.
6.  Update task checkboxes and `IMPLEMENTATION_STATUS.md`,
    `TEST_EVIDENCE.md` and `CHANGELOG.md`.
7.  Mark work `DONE` only when acceptance criteria pass and evidence is
    recorded. Otherwise use `IN_PROGRESS` or `BLOCKED`.
8.  At session end, provide the report format in the implementation plan
    and name the next smallest safe task set.

## Non-negotiable product and engineering constraints

-   Use a FastAPI modular monolith; do not split into microservices for
    MVP.
-   Preserve the pseudonymous identity model and private phone/VPA data.
-   Guests may browse; authentication is required for interactive
    actions as specified.
-   Enforce 18+ eligibility.
-   One active wish per user; one donor per wish; no pooling.
-   Gift amounts are whole INR from ₹10 to ₹100 inclusive
    (`MIN_GIFT_INR=10`, `MAX_GIFT_INR=100`).
-   Direct UPI handoff is not payment verification. Donor and recipient
    actions are attestations.
-   Never expose raw VPA, phone, UTR, credentials or moderation notes in
    public payloads/logs.
-   PostgreSQL transactions, constraints, row locks and idempotency are
    the correctness boundary; Redis is not.
-   Never introduce wallet, escrow, platform custody, commission, ads or
    cash-redeemable karma.
-   Keep real-money production UPI handoff disabled until written legal
    and bank/payment-partner gates are cleared and the owner explicitly
    approves activation.
-   Use test adapters/mocks where external providers are not yet
    selected.
-   Do not invent credentials, provider integrations, legal approvals or
    product decisions.

## Initial task

Begin with Phase 0 only. Inspect, assess and plan. Do not start feature
implementation until the owner approves the repository assessment and
Phase 1 scope.
