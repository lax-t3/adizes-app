# LEAP™ Branding & UI Flow — Design Spec
**Date:** 2026-06-10  
**Source doc:** `HIL_Adizes_India/docs/LEAP Branding UI Flow.docx`  
**Repos affected:** `adizes-frontend` (Netlify deploy), `adizes-backend` (ECR + App Runner deploy)  
**Approach:** Frontend changesets first (Netlify), backend email changesets separately (Docker rebuild → ECR push)

---

## Co-branding Decision

**No co-branding.** LEAP™ + HIL Isotope only on all screens. No partner/client logo slots. Revisit only if a specific client requests it.

---

## Changeset 1 — Frontend (`adizes-frontend`)

### 1.1 Asset: HIL Isotope

Copy `/Users/vrln/HIL_Adizes_India/images/HIL-Isotope.png` → `/Users/vrln/adizes-frontend/public/HIL-Isotope.png`.

Served at `/HIL-Isotope.png`. No build step required.

### 1.2 Logo Sweep — All TSX Files

Grep `adizes-frontend/src` for all occurrences of `/logo.png` and `/hil_blue.png`. Replace every instance:

| Old | New | Alt text |
|-----|-----|----------|
| `/logo.png` | `/HIL-Isotope.png` | `"Heartfulness Institute of Leadership"` |
| `/hil_blue.png` | `/HIL-Isotope.png` | `"Heartfulness Institute of Leadership"` |

Any `alt` text that still reads `"Adizes Institute"` is updated to `"Heartfulness Institute of Leadership"`.

### 1.3 Login Page (`src/pages/Landing.tsx`)

**Left panel changes:**

- **Header logos** — Remove the `<img src="/logo.png" />` block entirely. Nothing replaces it. The headline sits at the top of the content area.
- **Background image** — Replace the `picsum.photos` URL with:  
  `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80`  
  Keep the existing dark gradient overlay (`from-gray-950/90 to-gray-950/40`).
- **Headline** — Change `"Leadership clarity starts with honest reflection."` → `"Leadership Alignment Begins with Honest Reflection"`
- **Bottom strip** — Remove Terms/Privacy/Refund links and the "© Adizes Institute · Powered by Turiyaskills" copyright line. Replace with single line:  
  `"Powered by the Adizes PAEI Framework"` — same small muted style (`text-xs text-gray-500`).

**Right panel changes:**

- **Copyright line** — Change `"© 2026 Adizes Institute · Powered by Turiyaskills"` → `"© {new Date().getFullYear()} Heartfulness Institute of Leadership | Powered by Turiyaskills"` (keep the dynamic year expression, update the organisation name only)
- **Logo at bottom** — `hil_blue.png` → `/HIL-Isotope.png` (covered by the logo sweep above)
- **Mobile header** (`lg:hidden` block) — Remove `/logo.png` img; `/hil_blue.png` → `/HIL-Isotope.png` (covered by sweep).

### 1.4 LEAP Landing Page (`src/pages/LeapLanding.tsx`)

#### 1.4.1 Hero section — background image + contrast

Replace the flat `bg-[#0D1B2A]` background with the same Unsplash mountain image:

```
https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80
```

Implementation: wrap the section content with a `relative` container, add an `<img>` or CSS `background-image` with a dark overlay (`bg-black/60` or equivalent) to ensure text remains legible. Adjust text colours:

- Primary headline: white (`text-white`) — unchanged
- Subheadline: `text-white/90` (was `text-blue-100` — now pure white-tinted for photo background)
- Microcopy items: `text-white/60` (was `text-blue-200/60`)
- Badge/eyebrow line: `text-white/70 uppercase tracking-widest` (was `text-blue-300`)
- CTA button: white background, `text-gray-900` — unchanged (already high contrast)

The dot-grid overlay stays but opacity may be reduced slightly (`opacity-[0.04]`) since it sits on a photo now.

#### 1.4.2 Hero section — secondary CTA

Add a ghost/outline secondary button next to "Begin Your LEAP Assessment":

- Label: `"View a Sample LEAP Profile"`
- Style: outline variant — `border border-white/60 text-white hover:bg-white/10` (ghost on dark/photo background)
- Behaviour: `onClick` opens a Supabase Storage public PDF URL in a new tab (`target="_blank" rel="noopener noreferrer"`)
- PDF source: upload one of the sample reports (`AMSI for Jack Allen.pdf` or `AMSI for Peter Fianu.pdf`) from `HIL_Adizes_India/` to a public Supabase Storage bucket during implementation. Hardcode the resulting public URL as a constant at the top of the component.
- Layout: buttons stacked on mobile (`flex-col sm:flex-row`), side by side on sm+.

#### 1.4.3 New Section 6 — "Designed for Real Leadership"

Insert between `WhatYouReceiveSection` and `NoIdealProfilesSection`.

- Background: `bg-white` (matches alternating white/light-grey pattern)
- Headline: `"Built for the complexity of real leadership."`
- Body copy (two paragraphs):
  - Para 1: *"Leadership is rarely static. Roles evolve. Organizations change. People adapt."*
  - Para 2: *"LEAP is designed to help leaders understand where adaptation is healthy, where tension is becoming costly, and where alignment can improve sustainability and effectiveness."*
- Layout: centred, `max-w-2xl mx-auto`, same typographic rhythm as `NoIdealProfilesSection`.

#### 1.4.4 Footer branding (FinalCTASection)

Replace the existing footnote:  
`"LEAP™ is powered by the Adizes PAEI Framework · Operated by HILeadership in partnership with Turiyaskills"`

With:

1. HIL Isotope image — `<img src="/HIL-Isotope.png" />` centred, `h-10`, `opacity-70`, `mb-3`
2. Text line: `"LEAP™ — Leadership Energy Alignment Profile · Developed by Heartfulness Institute of Leadership · Powered by the Adizes PAEI Framework & Turiyaskills"`
3. Same `text-xs text-blue-300/50` style.

---

## Changeset 2 — Backend (`adizes-backend`)

All changes are in `app/services/email_service.py` and `app/schemas/settings.py`.

Deploy path: code change → `docker compose up --build -d` locally to verify → ECR push → App Runner auto-redeploys.

### 2.1 Sender name default

| File | Old value | New value |
|------|-----------|-----------|
| `app/schemas/settings.py` — `SmtpConfig.from_name` | `"Adizes Platform"` | `"Leap Invitation"` |
| `app/services/email_service.py` — `send_email()` fallback | `'Adizes'` | `"Leap Invitation"` |
| `app/routers/settings.py` — test email fallback | `"Adizes Platform"` | `"Leap Invitation"` |

**Config note (not a code change):** The `from_email` in the admin SMTP settings panel should be updated to `noreply@turiyaskills.co`. This is an admin UI config change — no code change required.

### 2.2 Email subjects

| Template | Old subject | New subject |
|----------|-------------|-------------|
| `user_enrolled` | `"You've been enrolled in {{cohort_name}} — {{platform_name}}"` | `"Ready for your LEAP™ Assessment? — {{cohort_name}}"` |
| `cohort_enrollment_existing` | `"You've been enrolled in {{cohort_name}} — {{platform_name}}"` | `"Ready for your LEAP™ Assessment? — {{cohort_name}}"` |
| `assessment_complete` | `"Your AMSI results are ready — {{platform_name}}"` | `"Your LEAP™ results are ready — {{platform_name}}"` |
| `org_welcome` | `"You've been added to {{org_name}} on the Adizes PAEI Platform"` | `"You've been added to {{org_name}} on the LEAP™ Platform"` |
| `admin_invite` | unchanged | unchanged |
| `password_reset` | unchanged | unchanged |

### 2.3 Email header block (`_EMAIL_WRAPPER_OPEN`)

Replace the two `<img>` logo tags in the header `<td>` with a text-only LEAP™ identity block:

```html
<!-- LEAP identity header (no images — works in all email clients) -->
<tr>
  <td align="center" style="padding:32px 48px 28px;border-bottom:1px solid #e8e8e8;background-color:#ffffff;">
    <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#C8102E;letter-spacing:1px;">LEAP™</p>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1D3557;letter-spacing:1px;text-transform:uppercase;">Leadership Energy Alignment Profile</p>
    <table role="presentation" width="260" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;border-top:1px solid #e8e8e8;">
      <tr><td style="padding:12px 0 0;">
        <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555555;">Understand the gap between:</p>
        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; How you lead today</p>
        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; What your role requires</p>
        <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; What naturally energizes you</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;">15 minutes &nbsp;&middot;&nbsp; Personalized report &nbsp;&middot;&nbsp; Immediate insights</p>
      </td></tr>
    </table>
  </td>
</tr>
```

### 2.4 Enrollment email body + CTA label

In `_enrolled_html()` and `_cohort_enrollment_existing_html()`:

- Replace `"Adizes Management Style Assessment (AMSI)"` → `"LEAP™ — Leadership Energy Alignment Profile"`
- In `_cohort_enrollment_existing_html()`: change CTA label `"Go to Dashboard & Begin Assessment"` → `"Begin My LEAP Assessment"`
- In `_enrolled_html()`: CTA label `"Accept Invitation & Set Password"` stays unchanged (new-user activation flow, not assessment start)

In `_org_welcome_html()` and `_assessment_complete_html()`:

- Replace `"Adizes PAEI Assessment Platform"` → `"LEAP™ Platform"`
- Replace `"Adizes Management Style Assessment (AMSI)"` → `"LEAP™ — Leadership Energy Alignment Profile"`

### 2.5 Three-dimension HTML block (enrollment emails only)

Add below the CTA button in `_enrolled_html()` and `_cohort_enrollment_existing_html()`, inside the body `<td>`:

```html
<!-- Three-dimension pills -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding:8px 10px;background-color:#C8102E;border-radius:4px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Current State (IS)</span>
          </td>
          <td style="width:8px;"></td>
          <td align="center" style="padding:8px 10px;background-color:#1D3557;border-radius:4px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Role Expectations (SHOULD)</span>
          </td>
          <td style="width:8px;"></td>
          <td align="center" style="padding:8px 10px;background-color:#2A9D8F;border-radius:4px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Intrinsic Preference (WANT)</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### 2.6 Email footer (`_EMAIL_WRAPPER_CLOSE`)

Replace the `hil_blue.png` `<img>` tag in the footer with a text-only HIL attribution line (no images in footer either, for consistency):

```html
<p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888888;">
  Developed by Heartfulness Institute of Leadership
</p>
```

---

## Deployment Notes

### Frontend (Changeset 1)
- Copy asset, edit TSX files, `npm run dev` to verify locally, push `adizes-frontend` branch → Netlify auto-deploys.
- Verify: `/leap` hero photo, secondary CTA, new section, footer; login page logo, background, text changes.

### Backend (Changeset 2)
- Edit `email_service.py` + `schemas/settings.py` + `settings.py` router.
- `docker compose up --build -d` locally, send a test email via admin panel to verify header + body + pills.
- Admin panel: update SMTP `from_email` to `noreply@turiyaskills.co` and `from_name` to `"Leap Invitation"`.
- ECR push → App Runner auto-redeploys.

---

## Out of Scope

- Co-branding slots for external consultants/clients (decided: no).
- Sample PDF regeneration with LEAP™ branding (sample PDFs used as-is for the "View a Sample" CTA).
- PDF Lambda v2 report template changes (separate initiative).
