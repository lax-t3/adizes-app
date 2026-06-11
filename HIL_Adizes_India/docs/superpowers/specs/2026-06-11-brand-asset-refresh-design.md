# Design: LEAP™ Brand Asset Refresh — HIL Identity Standardisation

**Date:** 2026-06-11  
**Status:** Approved for implementation

## Overview

Standardise all visual brand anchors to use the HIL isotype as the primary identifier.
Replace the legacy Adizes "A" placeholder assets and apply a uniform header band across
email templates. Update attribution text to match the canonical brand hierarchy.

## Brand Hierarchy (canonical)

```
LEAP™
Leadership Energy Alignment Profile
Developed by the Heartfulness Institute of Leadership
Powered by the Adizes PAEI Framework
```

Adizes is referenced only as "Powered by the Adizes PAEI Framework" — never as a logo or
primary visual anchor. Turiyaskills remains as a small technical note in footer/sidebar,
removed from emails.

## Files Changed

### Frontend — adizes-frontend

| File | Change |
|------|--------|
| `public/icon.svg` | Replace "A" placeholder with HIL isotope trefoil on navy |
| `index.html` | Update `og:image` + `twitter:image` → `/HIL-Isotope.png`; add width/height meta; add `apple-touch-icon` |
| `src/components/layout/Footer.tsx` | `© Adizes Institute` → `© Heartfulness Institute of Leadership`; keep Turiyaskills as small note |
| `src/components/layout/AdminSidebar.tsx` | Same attribution fix |

### Backend — adizes-backend

| File | Change |
|------|--------|
| `app/services/email_service.py` | Replace `_EMAIL_WRAPPER_OPEN` text-only header with navy band matching Image #2 |

### Docs — HIL_Adizes_India

| File | Change |
|------|--------|
| `CLAUDE.md` | Add Brand Hierarchy + Email Header Band sections |

## Favicon / Browser Tab Icon

**File:** `public/icon.svg`

SVG trefoil (three interlocking loops) approximating the HIL isotope, white strokes
on navy `#1D3557` rounded-rect background. Used by `<link rel="icon">` in `index.html`.
`icon.png` (the existing "A" placeholder PNG) is superseded by the SVG; the `<link>` in
`index.html` already points to `icon.png` which will keep serving (won't replace the PNG,
just make the SVG canonical going forward).

## OG / Social Meta

**File:** `index.html`

```html
<meta property="og:image" content="/HIL-Isotope.png" />
<meta property="og:image:width" content="542" />
<meta property="og:image:height" content="383" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="apple-touch-icon" href="/HIL-Isotope.png" />
```

Note: The existing HIL-Isotope.png (542×383) is better than the current "A" placeholder.
A dedicated 1200×630 social banner can be added later without code changes.

## Email Header Band

**File:** `app/services/email_service.py` — `_EMAIL_WRAPPER_OPEN`

Structure (table-based, email-safe):
```
┌─────────────────────────────────────────────────────────┐ ← navy #1D3557
│  ⊙ HIL isotope   LEAP™           Leadership Energy...   │
├─────────────────────────────────────────────────────────┤ ← 3px red #C8102E
```

- Full-width table cell, `background-color: #1D3557`
- Left inner cell: 48×48 circle, `background: rgba(255,255,255,0.15)`, contains inline SVG
  of HIL trefoil (white, ~28px, stroke-based). MSO/Outlook fallback: plain circle.
- Middle cell: "LEAP™" — Arial/Helvetica, 22px, bold, white
- Right cell: "Leadership Energy Alignment Profile" — Arial, 12px, `rgba(255,255,255,0.7)`
- Stripe row below: `background-color: #C8102E`, height 3px

Email footer attribution changes:
- Remove "Powered by Turiyaskills" from email footer
- Footer shows: "Developed by Heartfulness Institute of Leadership"

## Footer / Sidebar Attribution

**Current:**
```
© 2024 Adizes Institute. All rights reserved.
App powered by Turiyaskills
```

**New:**
```
© 2024 Heartfulness Institute of Leadership
Powered by the Adizes PAEI Framework · Technical platform: Turiyaskills
```

AdminSidebar: same pattern, condensed to two small lines.
