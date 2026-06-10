# LEAP™ Branding — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand `adizes-frontend` — copy HIL Isotope asset, replace all old logo references, update the login page (background, copy, branding), and update the `/leap` landing page (mountain hero photo, sample PDF CTA, new section, footer attribution).

**Architecture:** Pure UI changes. No new routes, no API changes, no state changes. One new static asset (`HIL-Isotope.png`) served from `public/`. The sample PDF secondary CTA links to a Supabase Storage public URL set up as a prerequisite in Task 4.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite. Deployed on Netlify from the `adizes-frontend` branch.

---

## File Map

| File | Change type | Summary |
|------|-------------|---------|
| `public/HIL-Isotope.png` | Create | New logo asset |
| `src/components/layout/Footer.tsx` | Modify | hil_blue.png → HIL-Isotope.png |
| `src/components/layout/AdminSidebar.tsx` | Modify | logo.png → HIL-Isotope.png; hil_blue.png → HIL-Isotope.png |
| `src/components/layout/Navbar.tsx` | Modify | logo.png → HIL-Isotope.png |
| `src/pages/Register.tsx` | Modify | Remove logo.png img; hil_blue.png → HIL-Isotope.png |
| `src/pages/ForgotPassword.tsx` | Modify | Remove logo.png img; hil_blue.png → HIL-Isotope.png |
| `src/pages/ResetPassword.tsx` | Modify | Remove logo.png img (×2); hil_blue.png → HIL-Isotope.png (×2) |
| `src/pages/PolicyPage.tsx` | Modify | logo.png → HIL-Isotope.png |
| `src/pages/AdminSettings.tsx` | Modify | Remove outdated email logo-tip block |
| `src/pages/Landing.tsx` | Modify | Full login page rebrand |
| `src/pages/LeapLanding.tsx` | Modify | Mountain hero, secondary CTA, new section, footer |

---

### Task 1: Copy HIL Isotope asset

**Files:**
- Create: `adizes-frontend/public/HIL-Isotope.png`

- [ ] **Step 1: Copy the asset**

```bash
cp /Users/vrln/HIL_Adizes_India/images/HIL-Isotope.png /Users/vrln/adizes-frontend/public/HIL-Isotope.png
```

- [ ] **Step 2: Verify**

```bash
ls -lh /Users/vrln/adizes-frontend/public/HIL-Isotope.png
```
Expected: file exists with non-zero size.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add public/HIL-Isotope.png
git commit -m "feat: add HIL Isotope logo asset"
```

---

### Task 2: Logo sweep — all files except Landing.tsx and LeapLanding.tsx

Some pages have both `/logo.png` and `/hil_blue.png` stacked in the same block (Register, ForgotPassword, ResetPassword). For those, the `/logo.png` img is removed entirely and `/hil_blue.png` becomes `/HIL-Isotope.png` — resulting in a single logo. For pages with only one logo, simple replacement. AdminSettings.tsx contains an email template tip block referencing the old logo approach — it is removed since the new email header is text-only.

**Files:**
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/pages/Register.tsx`
- Modify: `src/pages/ForgotPassword.tsx`
- Modify: `src/pages/ResetPassword.tsx`
- Modify: `src/pages/PolicyPage.tsx`
- Modify: `src/pages/AdminSettings.tsx`

- [ ] **Step 1: Simple replacements — Footer.tsx, AdminSidebar.tsx, Navbar.tsx, PolicyPage.tsx**

For each of these four files, run the sed commands below. They have no stacked-logo problem.

```bash
cd /Users/vrln/adizes-frontend

# Footer.tsx — hil_blue → HIL-Isotope
sed -i '' 's|/hil_blue\.png|/HIL-Isotope.png|g' src/components/layout/Footer.tsx
sed -i '' 's|alt="Heartfulness Institute of Leadership"|alt="Heartfulness Institute of Leadership"|g' src/components/layout/Footer.tsx

# AdminSidebar.tsx — both logos
sed -i '' 's|/logo\.png|/HIL-Isotope.png|g' src/components/layout/AdminSidebar.tsx
sed -i '' 's|/hil_blue\.png|/HIL-Isotope.png|g' src/components/layout/AdminSidebar.tsx
sed -i '' 's|alt="Adizes Institute"|alt="Heartfulness Institute of Leadership"|g' src/components/layout/AdminSidebar.tsx

# Navbar.tsx — logo only
sed -i '' 's|/logo\.png|/HIL-Isotope.png|g' src/components/layout/Navbar.tsx
sed -i '' 's|alt="Adizes Institute"|alt="Heartfulness Institute of Leadership"|g' src/components/layout/Navbar.tsx

# PolicyPage.tsx — logo only
sed -i '' 's|/logo\.png|/HIL-Isotope.png|g' src/pages/PolicyPage.tsx
sed -i '' 's|alt="Adizes Institute"|alt="Heartfulness Institute of Leadership"|g' src/pages/PolicyPage.tsx
```

- [ ] **Step 2: Register.tsx — remove logo.png img, update hil_blue.png**

In `src/pages/Register.tsx`, find lines 133–134 (the two stacked logos). Remove the logo.png line and update the hil_blue.png line:

Find:
```tsx
          <img src="/logo.png" alt="Adizes Institute" className="h-14 w-auto" referrerPolicy="no-referrer" />
          <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-9 w-auto opacity-85" referrerPolicy="no-referrer" />
```
Replace with:
```tsx
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```

- [ ] **Step 3: ForgotPassword.tsx — remove logo.png img, update hil_blue.png**

In `src/pages/ForgotPassword.tsx`, find lines 36–37:

Find:
```tsx
          <img src="/logo.png" alt="Adizes Institute" className="h-14 w-auto" referrerPolicy="no-referrer" />
          <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-9 w-auto opacity-85" referrerPolicy="no-referrer" />
```
Replace with:
```tsx
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```

- [ ] **Step 4: ResetPassword.tsx — two stacked-logo blocks to fix**

In `src/pages/ResetPassword.tsx`, there are two identical logo pairs (lines 36–37 and lines 93–94). Fix both with the same pattern.

**First occurrence** (around line 36–37):
Find:
```tsx
            <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
            <img src="/hil_blue.png" alt="HIL" className="h-12 w-auto" referrerPolicy="no-referrer" />
```
Replace with:
```tsx
            <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```

**Second occurrence** (around line 93–94):
Find:
```tsx
          <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
          <img src="/hil_blue.png" alt="HIL" className="h-12 w-auto" referrerPolicy="no-referrer" />
```
Replace with:
```tsx
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```

- [ ] **Step 5: AdminSettings.tsx — remove outdated email logo tip**

The email templates no longer use hosted logo images (Changeset 2 switches to a text-based LEAP™ header). Remove the entire "Logo tip" block in `src/pages/AdminSettings.tsx`.

Find and delete this block:
```tsx
      {/* Logo tip */}
      {tmpl.variables.includes("platform_url") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Logo images in email</p>
          <p>The default template uses logos hosted on your platform. Use these <code className="bg-blue-100 px-1 rounded">{"<img>"}</code> tags to reference them:</p>
          <div className="mt-1 space-y-0.5 font-mono text-[11px] text-blue-600 break-all">
            <p>{`<img src="{{platform_url}}/logo.png" alt="Adizes Institute" width="150" />`}</p>
            <p>{`<img src="{{platform_url}}/hil_blue.png" alt="HIL" width="110" />`}</p>
          </div>
          <p className="text-blue-500 mt-1">Email clients block images by default until the recipient allows them. Always include descriptive <code className="bg-blue-100 px-1 rounded">alt</code> text.</p>
        </div>
      )}
```

- [ ] **Step 6: Verify no remaining old logo references**

```bash
grep -rn "logo\.png\|hil_blue\.png" src/ --include="*.tsx" | grep -v "Landing.tsx\|LeapLanding.tsx"
```
Expected: no output (all occurrences cleared).

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/Footer.tsx \
        src/components/layout/AdminSidebar.tsx \
        src/components/layout/Navbar.tsx \
        src/pages/Register.tsx \
        src/pages/ForgotPassword.tsx \
        src/pages/ResetPassword.tsx \
        src/pages/PolicyPage.tsx \
        src/pages/AdminSettings.tsx
git commit -m "feat: replace Adizes/HIL logos with HIL Isotope across all app screens"
```

---

### Task 3: Login page — full Landing.tsx rebrand

**Files:**
- Modify: `src/pages/Landing.tsx`

- [ ] **Step 1: Update left panel background image**

Find:
```tsx
            src="https://picsum.photos/seed/corporate/1920/1080?blur=2" 
            alt="Corporate background" 
```
Replace with:
```tsx
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80" 
            alt="Mountain landscape" 
```

- [ ] **Step 2: Remove left panel header logo block**

Find and delete the entire logo header div:
```tsx
        <div className="flex items-center gap-3 mb-16">
            <img
              src="/logo.png"
              alt="Adizes Institute"
              className="h-14 w-auto brightness-0 invert"
              referrerPolicy="no-referrer"
            />
          </div>
```
(The `<motion.div>` containing the headline becomes the first child of `<div className="relative z-10">` after this deletion.)

- [ ] **Step 3: Update left panel headline**

Find:
```tsx
              {isAdminRoute ? "Manage assessments and cohorts." : "Discover your leadership alignment."}
```
Replace with:
```tsx
              {isAdminRoute ? "Manage assessments and cohorts." : "Leadership Alignment Begins with Honest Reflection"}
```

- [ ] **Step 4: Replace left panel bottom strip**

Find:
```tsx
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link to="/refund" className="hover:text-gray-300 transition-colors">Refund Policy</Link>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Adizes Institute &middot; Powered by <span className="text-gray-400 font-medium">Turiyaskills</span>
          </p>
        </div>
```
Replace with:
```tsx
        <div className="relative z-10">
          <p className="text-xs text-gray-500">Powered by the Adizes PAEI Framework</p>
        </div>
```

- [ ] **Step 5: Update right panel copyright line**

Find:
```tsx
            &copy; {new Date().getFullYear()} Adizes Institute &middot; Powered by <span className="font-medium text-gray-500">Turiyaskills</span>
```
Replace with:
```tsx
            &copy; {new Date().getFullYear()} Heartfulness Institute of Leadership | Powered by <span className="font-medium text-gray-500">Turiyaskills</span>
```

- [ ] **Step 6: Update mobile header (lg:hidden block)**

Find:
```tsx
          <div className="lg:hidden flex flex-col items-center gap-4 mb-12">
            <img src="/logo.png" alt="Adizes Institute" className="h-16 w-auto" referrerPolicy="no-referrer" />
            <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-10 w-auto opacity-90" referrerPolicy="no-referrer" />
          </div>
```
Replace with:
```tsx
          <div className="lg:hidden flex flex-col items-center gap-4 mb-12">
            <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-14 w-auto opacity-90" referrerPolicy="no-referrer" />
          </div>
```

- [ ] **Step 7: Update right panel bottom logo**

Find:
```tsx
            <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```
Replace with:
```tsx
            <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-12 w-auto opacity-90" referrerPolicy="no-referrer" />
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Visual check in browser**

Ensure the dev server is running (`npm run dev`). Open http://localhost:3000 and verify:
- Left panel: mountain photo background, no logo in header, updated headline, "Powered by the Adizes PAEI Framework" at the bottom
- Right panel: "© [year] Heartfulness Institute of Leadership | Powered by Turiyaskills", HIL Isotope at bottom
- Resize browser to mobile width: single HIL Isotope logo at top of right panel

Also open http://localhost:3000/admin and verify the admin route left panel is unchanged (still shows "Manage assessments and cohorts.").

- [ ] **Step 10: Commit**

```bash
git add src/pages/Landing.tsx
git commit -m "feat: rebrand login page — mountain background, HIL Isotope, LEAP copy"
```

---

### Task 4: Upload sample PDF to Supabase Storage (manual prerequisite for Task 5)

This produces the `SAMPLE_PDF_URL` constant used in Task 5. Complete this before Task 5.

**Files:** None — Supabase dashboard action.

- [ ] **Step 1: Open Supabase Storage for the production project**

Navigate to: https://supabase.com/dashboard/project/swiznkamzxyfzgckebqi/storage/buckets

- [ ] **Step 2: Create a public bucket named `samples`**

Click "New bucket". Set name: `samples`. Enable "Public bucket" toggle. Click "Create bucket".

(If `samples` already exists, skip creation and proceed to step 3.)

- [ ] **Step 3: Upload the sample PDF**

Inside the `samples` bucket, click "Upload file". Upload:
`/Users/vrln/HIL_Adizes_India/AMSI for Jack Allen.pdf`

- [ ] **Step 4: Copy the public URL**

Click the uploaded file → "Get URL" (or "Copy URL"). The URL will be in the form:
`https://swiznkamzxyfzgckebqi.supabase.co/storage/v1/object/public/samples/AMSI%20for%20Jack%20Allen.pdf`

**Save this URL — it is required in Task 5, Step 1.**

---

### Task 5: LeapLanding.tsx — hero section (background photo, contrast adjustments, secondary CTA)

**Files:**
- Modify: `src/pages/LeapLanding.tsx`

- [ ] **Step 1: Add the SAMPLE_PDF_URL constant**

At the top of `LeapLanding.tsx`, before the `HeroSection` function declaration, add:

```tsx
const SAMPLE_PDF_URL =
  "https://swiznkamzxyfzgckebqi.supabase.co/storage/v1/object/public/samples/AMSI%20for%20Jack%20Allen.pdf";
```

Replace the URL value with the one you copied in Task 4, Step 4.

- [ ] **Step 2: Replace the entire HeroSection function**

Find and replace the entire `function HeroSection() { ... }` block with:

```tsx
function HeroSection() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden text-white py-24 px-6">
      {/* Background photo */}
      <img
        src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/65" />
      {/* Background dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      <div className="relative mx-auto max-w-5xl text-center">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mb-6">
          LEAP™ — Leadership Energy Alignment Profile &nbsp;·&nbsp; Powered by the Adizes PAEI Framework
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
          Discover the hidden tensions<br className="hidden sm:block" /> shaping how you lead.
        </h1>
        <p className="text-lg text-white/90 max-w-2xl mx-auto mb-4">
          LEAP™ helps leaders understand the alignment between how they currently operate, what their role demands, and what naturally energizes them.
        </p>
        <p className="text-sm text-white/60 max-w-xl mx-auto mb-10">
          The result is a practical view into execution pressure, engagement strain, authenticity tension, and sustainable leadership effectiveness.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-8 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
          >
            Begin Your LEAP Assessment <ArrowRight className="h-5 w-5" />
          </button>
          <a
            href={SAMPLE_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 text-white px-8 py-4 text-base font-semibold hover:bg-white/10 transition-colors"
          >
            View a Sample LEAP Profile
          </a>
        </div>
        <div className="flex justify-center gap-8 mt-8 flex-wrap">
          {["~15 minutes", "Personalized leadership insights", "Immediate alignment profile", "Action-oriented guidance"].map((item) => (
            <span key={item} className="text-xs text-white/60 flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-white/40" />{item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Visual check**

Open http://localhost:3000/leap. Verify:
- Hero shows the mountain photo with a dark overlay (text is clearly readable)
- Dot grid is subtle (not distracting over the photo)
- Two buttons appear side by side on desktop, stacked on mobile
- "View a Sample LEAP Profile" button opens the PDF in a new tab when clicked

- [ ] **Step 5: Commit**

```bash
git add src/pages/LeapLanding.tsx
git commit -m "feat: leap landing — mountain hero background, sample PDF secondary CTA"
```

---

### Task 6: LeapLanding.tsx — new "Designed for Real Leadership" section

**Files:**
- Modify: `src/pages/LeapLanding.tsx`

- [ ] **Step 1: Add the new section function**

Insert the following function in `LeapLanding.tsx` immediately before the `function NoIdealProfilesSection()` declaration:

```tsx
function RealLeadershipSection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
          Built for the complexity of real leadership.
        </h2>
        <p className="text-gray-600 text-lg mb-4 leading-relaxed">
          Leadership is rarely static. Roles evolve. Organizations change. People adapt.
        </p>
        <p className="text-gray-500 leading-relaxed">
          LEAP is designed to help leaders understand where adaptation is healthy, where tension
          is becoming costly, and where alignment can improve sustainability and effectiveness.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Insert into the render order**

In the `export function LeapLanding()` return, add `<RealLeadershipSection />` between `<WhatYouReceiveSection />` and `<NoIdealProfilesSection />`:

```tsx
export function LeapLanding() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <TensionCardsSection />
      <SampleInsightsSection />
      <WhyDifferentSection />
      <WhatYouReceiveSection />
      <RealLeadershipSection />
      <NoIdealProfilesSection />
      <OrgApplicationsSection />
      <FinalCTASection />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeapLanding.tsx
git commit -m "feat: leap landing — add 'Designed for Real Leadership' section"
```

---

### Task 7: LeapLanding.tsx — footer branding and final CTA secondary button

**Files:**
- Modify: `src/pages/LeapLanding.tsx`

- [ ] **Step 1: Replace the entire FinalCTASection function**

Find and replace the entire `function FinalCTASection() { ... }` block with:

```tsx
function FinalCTASection() {
  const navigate = useNavigate();
  return (
    <section className="py-24 px-6 bg-[#0D1B2A] text-white text-center">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-5">
          Discover where your leadership energy is aligned.
        </h2>
        <p className="text-blue-200 mb-10 text-lg">
          Gain insight into the hidden tensions shaping your leadership effectiveness.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0D1B2A] px-10 py-4 text-base font-bold hover:bg-blue-50 transition-colors shadow-lg"
          >
            Begin Your LEAP Assessment <ArrowRight className="h-5 w-5" />
          </button>
          <a
            href={SAMPLE_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 text-white px-10 py-4 text-base font-semibold hover:bg-white/10 transition-colors"
          >
            Download a Sample Profile
          </a>
        </div>
        <div className="flex flex-col items-center gap-2">
          <img
            src="/HIL-Isotope.png"
            alt="Heartfulness Institute of Leadership"
            className="h-10 w-auto opacity-70 mb-1"
          />
          <p className="text-xs text-blue-300/50">
            LEAP™ — Leadership Energy Alignment Profile &nbsp;·&nbsp; Developed by Heartfulness Institute of Leadership &nbsp;·&nbsp; Powered by the Adizes PAEI Framework &amp; Turiyaskills
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Visual check**

Open http://localhost:3000/leap and scroll to the bottom. Verify:
- Two buttons side by side (Begin + Download Sample)
- HIL Isotope logo above the footnote text
- Footnote reads the full LEAP™ attribution line
- "Download a Sample Profile" opens the PDF in a new tab

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeapLanding.tsx
git commit -m "feat: leap landing — HIL footer attribution, Download Sample CTA in final section"
```

---

## Deploy

Push the `adizes-frontend` branch — Netlify auto-deploys on push.

```bash
git push origin adizes-frontend
```

Verify the Netlify deploy completes successfully. Spot-check in production:
- `https://<netlify-url>/` — login page: mountain background, new headline, HIL Isotope, correct copyright
- `https://<netlify-url>/leap` — hero photo, two CTAs, new section visible between "What You Receive" and "No Ideal Profiles", HIL footer attribution
- `https://<netlify-url>/register` — single HIL Isotope logo (no duplicate)
- `https://<netlify-url>/forgot-password` — single HIL Isotope logo
