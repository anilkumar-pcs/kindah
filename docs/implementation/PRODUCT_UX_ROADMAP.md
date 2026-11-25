# Product UX roadmap — post-Direction A

**Created:** 2026-11-25  
**Status:** ACTIVE  
**Source:** Owner ideation on 2026-11-25, reviewed against `CLAUDE.md` and `DECISIONS.md`.

## Product guardrails

- Never show an individual donor→recipient money-flow map. Kindly does not hold or verify payments and does not collect donor location.
- Public activity means **recipient-confirmed little gifts** or aggregate counts. Label attestation honestly; do not call it bank-verified money movement.
- Public statistics use aggregate data only, with minimum-count suppression for small slices.
- Admin can moderate and manage state, but cannot hard-delete users, wishes, gifts or financial/audit records.
- Admin cannot manually rewrite payment outcomes. Support resolution must preserve donor/recipient attestations.
- Private phone, raw VPA, UTR, credentials and moderation notes stay out of public payloads, logs and table columns.
- Discovery uses public searchable fields only. Cursor pagination is preferred for the live feed; numbered pages are used in admin tables.

## Parallel lanes

| Lane | Tasks | Dependencies |
|---|---|---|
| A. Personal space | UX-01 | None |
| B. Trust surfaces | UX-05 | None |
| C. Discovery and API foundation | UX-02, UX-03 | UX-02 backend filters |
| D. Admin operations | UX-04 | UX-04 backend pagination |
| E. Homepage and analytics UI | UX-03, UX-06 | UX-02 aggregates + UX-03 split |

## Tasks

### UX-01 — Compact My Space hub

**Goal:** Make My Space usable in one short glance, with deep details available without a long stacked form.

**Scope**

- Add tabbed sections: Overview, Wish, Gifts, Account.
- Overview shows profile/UPI status, next action, karma/streak, active wish and recent gifts.
- Move create-wish and UPI-edit forms into focused panels/sheets or dedicated subviews.
- Keep existing account, support and safety behavior intact.
- Preserve mobile bottom-tab shell.

**Acceptance**

- Main page fits within roughly one viewport/short scroll on mobile.
- Each tab is keyboard-accessible and deep-linkable.
- Existing wish/UPI/gift/karma tests pass or are updated for tab navigation.
- No API/backend change required.

**Status:** DONE — compact tabs, hash deep links, keyboard navigation; 9 component tests; mobile screenshot `docs/design/screenshots/my-space-mobile-tabs.png`.

### UX-02 — Discovery search, filters and pagination

**Goal:** Let users find wishes by intent, mood and amount without scanning the entire feed.

**Scope**

- `/discover` public feed separate from the new Home landing.
- Search over public wish message and pseudonym only.
- Filters: mood, amount band, sort; clear-all; URL state.
- Cursor pagination / Load more with result count.
- Server-specific query support and indexes where needed.
- Warm empty/error/loading states.

**Acceptance**

- Search/filter combinations preserve own/blocked/expired exclusions.
- Cursor remains valid across filter changes.
- No private fields enter search, response or analytics.
- API and UI tests cover filter/search/cursor behavior.

**Status:** DONE — `q`/mood/amount filters, cursor-bound filter fingerprint, `totalCount`, URL state, result counts and filter-specific empty state; 196 backend tests and 9 DiscoverFeed tests.

### UX-03 — Home and Discover information architecture

**Goal:** Give Kindly a true first-impression homepage without burying discovery.

**Scope**

- Decide Home + Discover navigation presentation.
- Home: hero, trust, aggregates, featured wish, how it works, CTA.
- Discover: searchable feed.
- Address mobile tab availability for Home, Discover, Updates, My Space and Account.

**Recommendation:** Home `/`, Discover `/discover`; mobile tabs Home, Discover, My Space, Account, with Updates available from the mobile header.

**Acceptance**

- No duplicate primary navigation.
- Guest and signed-in Home states are distinct.
- Deep links and bottom-tab active states remain correct.
- Full mobile/desktop browser check.

**Status:** DONE — Home is `/`; Discover is `/discover`; mobile tabs are Home, Discover, My Space and Account; Updates is in the mobile header; Home has City Pulse and the little-loop explanation.

### UX-04 — Table-first admin operations console

**Goal:** Let staff find and resolve anything from one console without loading unbounded arrays.

**Scope**

- Server-side search, filters, sort, numbered pagination and totals for users, wishes, gifts, support, appeals, deletion, outbox and audit.
- Data tables with row actions and a detail drawer.
- Safe bulk actions; mandatory reasons; append-only audit entries.
- User active/inactive, role changes; wish hide/restore/remove; support/appeal/deletion/outbox actions.
- Mobile card representation of tables.

**Acceptance**

- No sensitive fields in list columns; privileged detail is scoped and audited.
- Actions are idempotent/guarded and never hard-delete financial/audit records.
- Pagination/filter state is URL-addressable.
- Admin APIs and UI tests cover empty, loading, error and permission states.

**Status:** DONE for the table-first conversion — Users/Wishes and all five operational queues use server pagination/search/filters with detail drawers and guarded actions. The shared queue table has mobile card rows; Users/Wishes mobile cards, bulk actions and full accessibility review remain.

### UX-05 — Footer and trust surfaces

**Goal:** Give users a clear, warm explanation of Kindly’s limits and links to trust resources.

**Scope**

- Direction A footer with About/intent, safety, privacy, terms, accessibility and contact links.
- Static declarations: not a charity/crowdfunding/wallet/escrow/payment processor; direct UPI; no guarantee/verification; 18+; draft-policy notice.
- About and Safety pages where content exists; no invented legal entity, address or grievance details.
- Legal copy must be flagged for counsel review.

**Acceptance**

- Footer is responsive, accessible and does not duplicate primary navigation.
- No false payment/charity/legal claims.
- Links resolve; unavailable legal pages are marked clearly rather than fabricated.
- Mobile bottom navigation does not obscure footer content.

**Status:** DONE — Direction A footer, About, Safety centre and draft Legal & declarations; all links resolve; mobile footer clears the bottom tabs. Legal copy is explicitly marked for counsel review.

### UX-06 — Homepage City Pulse and aggregate map/chart

**Goal:** Make the first screen feel alive and locally warm without compromising privacy or truthfulness.

**Scope**

- Aggregate public stats: open wishes, confirmed gifts this week, confirmed value this week, active neighbourhoods, community streak if reliable.
- Privacy-safe stylised Bengaluru neighbourhood map and weekly chart.
- Minimum-count suppression and delayed/cached updates.
- Featured/random wish and how-it-works/trust modules.

**Acceptance**

- No individual donor/recipient flow, identity or precise location.
- Stats are labelled as recipient-confirmed/attested and update from aggregate API.
- Low-volume data degrades gracefully to warm empty states.
- Chart has text alternatives and reduced-motion behavior.

**Status:** DONE — aggregate member/wish/value/streak counters, seven-day confirmed-gift chart with a table alternative, thresholded area pulse and honest empty states. Deliberately **not** an individual A→B money-flow map; no donor location or individual payment route is exposed.

### UX-07 — Cross-cutting quality

**Goal:** Keep the larger surface usable and trustworthy.

**Scope**

- Keyboard/focus checks for tabs, tables, drawers and filter sheets.
- Loading/empty/error states; reduced motion; mobile 390px and desktop checks.
- Privacy review of every new public payload and admin table.
- Tests and documentation updates.

**Status:** IN_PROGRESS — automated backend/frontend tests, lint, format, typecheck, production build and desktop/mobile browser passes complete. Remaining: admin card-to-table conversion for support/appeals/deletion/outbox/audit, mobile admin card form, full manual screen-reader/WCAG matrix and independent security review.

## Recommended delivery order

1. UX-01 + UX-05 (frontend-only).
2. UX-02 API foundation + UX-03 navigation split.
3. UX-04 admin API pagination and table UI.
4. UX-06 aggregate stats, map/chart and final Home.
5. UX-07 full QA pass and external accessibility/security review.

## Parallel execution rule

Lane A and Lane B can proceed independently. Lane C backend work can proceed in parallel with frontend work, but discovery UI must not merge until its API contract is stable. Lane D must not ship until admin action guards and audit are covered. Lane E visualizes only approved aggregate fields.

## Delivery snapshot — 2026-11-25

- **Done:** UX-01, UX-02, UX-03, UX-04 (table-first conversion), UX-05 and UX-06.
- **In progress:** UX-07 — automated and browser QA done; full screen-reader/WCAG and independent security review remain.
- **Next safe slice:** add mobile card rows for Users/Wishes, bulk actions with mandatory reasons, then run the full accessibility/privacy pass.
- **Location copy:** all hard-coded Bengaluru branding/location claims were removed from user-facing surfaces; user-entered wish cities remain user data.
- **Evidence:** `TEST_EVIDENCE.md` VE-049–VE-051; screenshots under `docs/design/screenshots/`.
- **Owner review flag:** `DEC-A08` records that Home uses aggregate recipient-confirmed activity rather than an individual A→B money-flow map.
