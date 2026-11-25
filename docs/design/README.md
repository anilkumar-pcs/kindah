# Kindly visual design lab

Standalone mockups for the visual-language decision. Nothing in this folder is imported by the
application.

**Selected direction:** **A — Neighbourhood Postcard** (2026-11-24). Directions B and C remain
reference material only. Direction A is now implemented across the app; the post-v1 UX pass added
Home City Pulse, Discover filters, compact My Space, admin Users/Wishes tables and trust surfaces.

## Open it

```bash
cd /Users/pcsanilkumar/Work/kindah
python3 -m http.server 4173 --directory docs/design/mockups
```

Then open `http://localhost:4173`.

Full-page captures are saved in `screenshots/`:

- `screenshots/concept-a-full.png`
- `screenshots/concept-b-full.png`
- `screenshots/concept-c-full.png`
- `screenshots/app-home-desktop.png`
- `screenshots/app-home-feed.png`
- `screenshots/app-home-mobile.png`
- `screenshots/home-city-pulse.png`
- `screenshots/home-mobile-pulse.png`
- `screenshots/discover-filters.png`
- `screenshots/discover-mobile-compact.png`
- `screenshots/my-space-mobile-tabs.png`
- `screenshots/admin-users-table.png`
- `screenshots/admin-wishes-table.png`
- `screenshots/admin-support-table.png`
- `screenshots/admin-support-detail.png`
- `screenshots/admin-audit-table.png`
- `screenshots/footer-mobile.png`

## What is inside

Three coherent directions, each applied to the same core screens:

| Direction | Mood | Best for |
|---|---|---|
| **A — Neighbourhood Postcard** | warm paper, deep green, crafted illustration | a grown-up, trustworthy kind of fun |
| **B — Sticker Scrapbook** | tactile collage, pastels, handwritten notes | maximum friendliness and shareability |
| **C — Afterglow** | bold type, dark green panels, street-poster energy | the sharpest, most design-forward expression |

Each direction includes a desktop home, mobile home, wish detail, sign-in, gift flow, My Space and
notifications.

## Shared visual language

- Bricolage Grotesque for display type
- Plus Jakarta Sans for UI/body
- warm paper base, deep green ink
- marigold and coral as punctuation
- illustration-led, with no real-user photography inside the product
- clean interactions with tactile/scrapbook accents rather than a full scrapbook layout

The lab remains the design reference; the application now uses Direction A, with the post-v1 UX
additions documented in `docs/implementation/PRODUCT_UX_ROADMAP.md`.
