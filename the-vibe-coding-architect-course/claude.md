# The Vibe-Coding Architect Course - Project Documentation

## Project Overview

**The Vibe-Coding Architect Course** is a premium single-page landing page application for a senior-level AI orchestration course. It's designed to teach professionals how to shift from writing traditional code syntax to orchestrating and guiding AI agents for enterprise-grade rapid prototyping.

The course emphasizes practical AI-native development workflows using tools like:
- **Bolt.new** - for browser-based full-stack development
- **Lovable.dev** - for internal tools and dashboards
- **Cursor** - for AI-native IDE development
- **Claude Code** - for agentic CLI workflows

**Target Audience:** Senior developers looking to master AI orchestration and rapid prototyping in enterprise contexts.

---

## Technical Stack

- **Frontend Framework:** React 19.2.4 with TypeScript
- **Build Tool:** Vite 6.2.0
- **Runtime:** Node.js ES Modules
- **Styling:** Tailwind CSS
- **Deployment:** Netlify (auto-deploy from GitHub)
- **Branding:** Architects Vibe SVG logo
- **SEO:** Open Graph, Twitter Card meta tags
- **Lead Capture:** N8n Webhook Integration

---

## Project Structure

```
the-vibe-coding-architect-course/
├── App.tsx                 # Main React component with page routing
├── FreshersPage.tsx        # Student workshop page component
├── index.tsx               # React DOM entry point
├── index.html              # HTML template with SEO meta tags
├── constants.ts            # Curriculum and use case data
├── freshersConstants.ts    # Student workshop content data
├── types.ts                # TypeScript interfaces
├── freshersTypes.ts        # Student workshop TypeScript interfaces
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── .npmrc                  # npm configuration (legacy-peer-deps=true)
├── metadata.json           # App metadata
├── netlify.toml            # Netlify build configuration
├── .gitignore              # Git ignore rules
├── CLAUDE.md               # Project documentation (this file)
├── README.md               # Course overview and quick start
├── docs/                   # Documentation and plans
│   └── plans/              # Design and implementation plans
│       ├── 2026-02-14-freshers-page-design.md
│       └── 2026-02-14-freshers-page-implementation.md
├── n8n-workflows/          # N8n workflow configurations
│   ├── student-workshop-lead-capture.json
│   └── README.md           # N8n setup instructions
├── public/                 # Static assets
│   ├── architectsvibe.svg  # Logo (SVG format)
│   ├── architectsvibe.png  # Logo (PNG for social media)
│   ├── AI Orchestration Training Agenda.pdf
│   ├── Student_Workshop_Details.pdf
│   ├── student-workshop-og.svg
│   ├── student-workshop-twitter.svg
│   └── STUDENT_WORKSHOP_ASSETS.md
└── dist/                   # Production build output
```

---

## Key Features

### 0. Multi-Page Architecture (Added Feb 14, 2026)
The application now supports multiple pages with client-side routing:

**Main Pages:**
- **Home Page** (`/`) - The Vibe-Coding Architect Course (8-week program for senior architects)
- **Freshers Page** (`/freshers`) - Student Workshop (4-hour hands-on workshop for students)
- **Terms of Service** (`/terms`)
- **Privacy Policy** (`/privacy`)

**Navigation:**
- Shared navbar with cross-page links
- "Students" menu item links to /freshers
- Footer cross-links between enterprise and student offerings
- Logo always links back to home

**SEO Implementation:**
- Route-specific meta tags using React Helmet Async
- Dedicated Open Graph images per page
- Custom titles and descriptions for each route
- Social media optimized (Facebook, LinkedIn, Twitter)

### 1. Course Positioning & Manifesto Section
- **"The Vibe-Coding Architect" Manifesto** - Positioned after hero banner
  - Core positioning: "AI Orchestration for Architects Working on Legacy & Enterprise Systems"
  - Target audience clarity: Solution/Enterprise Architects, Principal Engineers, Tech Leads
  - Problem definition: "You don't work on toy problems" - resonates with brownfield architects
  - Three pillars of architectural work: Understanding legacy systems, trade-offs under constraints, hands-on leadership
  - Program differentiation from typical AI courses
  - Real project walkthrough with practical workflow example
  - Strategic positioning: "AI will not replace architects, but architects who can orchestrate AI will replace those who can't"

### 2. Program Structure & Teaching Philosophy
- **Program Structure Details:**
  - Duration: 8 weeks intensive
  - Format: 2 hours live per weekend (16 hours total)
  - Interactive, discussion-driven sessions
  - Real systems, real constraints - not slideware
  - Designed for serious architects and senior technologists

- **Teaching Philosophy:**
  - "I teach only what I actively practice and use in my own work"
  - Three pillars:
    1. Used in Real Projects (not theoretical exercises)
    2. Applied to Real Systems (running in production)
    3. Tested Under Real-World Constraints (not idealized environments)
  - Focus on practical architectural leverage, not theory

### 3. Why Learn From Me Section
- **Instructor Credibility & Teaching Approach:**
  - Clear positioning: "I don't teach AI as a trend. I teach it as an architectural tool."
  - What instructor is NOT: tool evangelist, full-time trainer, or greenfield-only builder
  - What instructor approaches as: architect who needs leverage
  - Program existence rationale: "These workflows actually work and architects deserve to stay hands-on"
  - Value proposition: practical judgment, real trade-offs, immediately applicable techniques

### 4. Outcomes Section - "What You'll Be Able to Do After 8 Weeks"
Eight concrete capabilities with supporting details:
1. **Reason About Legacy Systems Faster** - Use AI to understand unfamiliar codebases, generate architecture explanations, ask better questions
2. **Operate at the Architect Level (Not the Syntax Level)** - Guide AI on design trade-offs, evaluate options, stay hands-on
3. **Prototype Safely Without Touching Production** - Build internal tools in hours, create API mocks, validate ideas
4. **Orchestrate AI Agents, Not Just Prompt Them** - Use CLI-based agents, chain tools, move beyond chat
5. **Automate Thinking-Heavy, Time-Consuming Work** - Automate compliance checks, generate structured outputs
6. **Design Practical Automation Workflows** - Connect code, data, messaging, notifications
7. **Lead AI Conversations With Confidence** - Know where AI helps/doesn't help, guide teams and stakeholders
8. **Build Long-Term Relevance** - Develop AI-native architectural mindset, stay relevant as systems evolve

### 5. Pricing Section
- **Transparent, architect-level pricing:**
  - India-based: ₹45,000 INR per participant
  - International: $800 USD per participant
  - Group discount: 20% off for 5+ participants

- **Cohort Details:**
  - Small, focused batches (not mass production)
  - High-signal participation (serious architects only)
  - Designed for senior technologists

- **Rationale for Pricing:**
  - Architect-level value (strategic investment, not bootcamp)
  - Deep, hands-on engagement (small cohorts, live mentorship)
  - Real-world enterprise applicability (pays for itself in first project)

### 6. Interactive Curriculum Display
- **Two-Month Course Structure:**
  - **Month 1:** "Zero-to-One" Phase (Greenfield Development)
    - Week 1: Web App Kickoff with Bolt.new
    - Week 2: Internal Tools with Lovable.dev
    - Week 3: AI-Native Development with Cursor
    - Week 4: Context & Test-Driven Development

  - **Month 2:** "Brownfield" & Agentic Phase (Enterprise Realism)
    - Week 5: Agentic Workflows with Claude Code
    - Week 6: Mission Control and Human-in-the-loop
    - Week 7: Enterprise Integration
    - Week 8: Capstone Project

- Each week includes:
  - Week title and focus tool
  - Two sessions with concepts and hands-on tasks
  - Real-world project scenarios

### 2. Use Case Gallery
Four practical enterprise use cases demonstrating AI-orchestration value:
- **Legacy Code Explainer** - Analyze and document complex codebases
- **Instant Admin Panel** - Build operational UIs in minutes
- **API Mock Generator** - Unblock frontend teams
- **Compliance Checker** - Automate security and policy verification

### 3. Logo & Branding
- **Architects Vibe SVG Logo** in navbar (clickable home button)
- **Logo in footer** (responsive sizing: h-16 sm:h-20 md:h-24)
- **Favicon** for browser tab (SVG)
- **Apple Touch Icon** for iOS devices
- Visible on all form factors (mobile, tablet, desktop)

### 4. Lead Capture System (N8n Webhook)
- Modal-based forms for "Download Agenda PDF" and "Join Waitlist"
- Integration with N8n webhook for lead tracking
- Sends: name, email, action type, timestamp, source
- Form validation and submission handling
- Success state with checkmark confirmation
- Graceful error handling

### 5. SEO & Social Media Optimization
- **Meta Tags:** Description, keywords, author, robots
- **Open Graph Tags:** For Facebook/LinkedIn rich previews
  - og:title, og:description, og:image, og:url
  - og:site_name, og:locale
- **Twitter Card Tags:** For Twitter/X social previews
  - twitter:card (summary_large_image)
  - twitter:title, twitter:description, twitter:image
  - twitter:creator handle
- Rich previews when URL is shared on social platforms
- Improved search engine indexing

### 6. Student Workshop Page (/freshers) - Added Feb 14, 2026
Complete landing page for 4-hour student workshop targeting final year students, PG students, and early career professionals.

**Page Sections:**
1. **Hero Section** - "Build Your First AI-Powered Web App in 4 Hours"
2. **Why AI Skills Matter** - 5 career-focused benefits (industry reshaping, speed, job market, gig economy, future-proofing)
3. **What You'll Build** - Portfolio project showcase with tech stack
4. **Workshop Outline** - 4 sessions (Setup, Frontend, Backend, Deployment)
5. **Who Should Attend** - Target audience and prerequisites
6. **Requirements** - Laptop specs, free accounts needed, what to bring
7. **Instructor Profile** - Same instructor, student-focused positioning
8. **Pricing** - ₹5,000 standard, ₹4,500 early bird, institutional booking option
9. **Footer** - CTAs and cross-links

**Three CTAs:**
- "Register Your Interest" → Student registration form
- "Download Workshop Details" → PDF download + lead capture
- "Book for Your Institution" → Institutional inquiry form (25+ students)

**N8n Integration:**
- Dedicated webhook: `/webhook/architectsvibe-student-workshop`
- Three form types with different tags
- Google Sheets logging + email automation + Telegram notifications

**Assets:**
- `Student_Workshop_Details.pdf` - Workshop details document
- `student-workshop-og.svg` - Open Graph social sharing image
- `student-workshop-twitter.svg` - Twitter Card image

**Navigation:**
- "Students" menu item in main navbar
- Cross-link from home footer: "🎓 Student Workshop Available →"
- Cross-link from freshers footer: "🏢 For Enterprises →"

### 7. Responsive Design
- Mobile-friendly interface with Tailwind CSS
- Glass-morphism modal styling
- Backdrop blur effects
- Proper accessibility with icon components
- Logo scaling across breakpoints

---

## Data Structures

### WeekData Interface
```typescript
interface WeekData {
  id: string;                    // "W1", "W2", etc.
  title: string;                 // Week title
  focusTool: string;             // Primary tool (Bolt.new, Cursor, etc.)
  session1: {
    concept: string;
    task: string;
  };
  session2: {
    concept: string;
    task: string;
  };
}
```

### UseCase Interface
```typescript
interface UseCase {
  title: string;                 // Use case name
  tools: string;                 // Tools involved
  scenario: string;              // Business scenario
  task: string;                  // AI orchestration task
  background?: string;           // Optional context
  timeEstimate?: string;         // Optional time estimate
}
```

---

## Core Components & Functions

### App Component (`App.tsx`)
Main React component managing:
- **State Management:**
  - `currentPage` - Page routing ('home' | 'terms' | 'privacy')
  - `activeMonth` - Current curriculum month selection
  - `modalType` - Modal state ('SYLLABUS', 'APPLY', or null)
  - `formData` - User input (name, email)
  - `isSubmitting` - Submission loading state
  - `isSuccess` - Form success confirmation

- **Key Functions:**
  - `openModal()` - Opens lead capture modal
  - `closeModal()` - Closes modal
  - `submitLeadToN8n()` - Sends lead data to n8n webhook
  - `triggerSyllabusDownload()` - Initiates PDF download
  - `handleSubmit()` - Form submission handler

- **Page Routes:**
  - Home page (default) - Interactive curriculum and CTA
  - Terms of Service page - Refund policy and course commitment
  - Privacy Policy page - Data collection and usage information

- **Navigation Menu (Navbar):**
  - Philosophy → #philosophy (Teaching Philosophy section)
  - Instructor → #instructor (Instructor Profile)
  - Curriculum → #curriculum (8-Week Curriculum)
  - Outcomes → #outcomes (What You'll Be Able to Do)
  - Pricing → #pricing (Pricing & Cohort Details)

- **Icon Components:**
  - TerminalIcon, CpuIcon, CodeIcon, CalendarIcon, CloseIcon, CheckIcon, LinkedinIcon
  - SVG-based, reusable across the app

### Curriculum Data (`constants.ts`)
- `CURRICULUM` - Map of month strings to week data arrays
- `USE_CASES` - Array of practical enterprise scenarios

### Legal Pages

**Terms of Service Page**
- Route: `/terms` (via `setCurrentPage('terms')`)
- Content:
  - **Refund Policy:** No refund after attending 3 sessions in the programme
  - **Course Commitment:** Requirements and expectations
  - Contact information for inquiries

**Privacy Policy Page**
- Route: `/privacy` (via `setCurrentPage('privacy')`)
- Content:
  - **Data Collection:** Form data from "Join Waitlist" and "Download Agenda" forms
  - **Data Usage:** Lead information used to reach out and discuss the course
  - **Data Storage:** Secure storage via N8n workflow automation
  - **User Rights:** Access, deletion, correction, and opt-out rights
  - **Policy Updates:** Last updated February 4, 2026

**Footer Links:**
- Both pages accessible via footer buttons in App.tsx:354-357
- Back-to-home navigation on each policy page
- Contact email: lakshminarayanan@architectsvibe.com

---

## Running the Application

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   - Set `GEMINI_API_KEY` in `.env.local` (for Gemini API integration, if needed)
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Development Server:**
   ```bash
   npm run dev
   ```
   - Starts Vite dev server (usually on `http://localhost:5173`)
   - Hot module replacement enabled

4. **Production Build:**
   ```bash
   npm run build
   ```
   - Creates optimized bundle in `dist/`
   - Ready for deployment

5. **Preview Production Build:**
   ```bash
   npm run preview
   ```
   - Serves the built bundle locally for testing

---

## Deployment

### Netlify Configuration

The application is optimized for Netlify deployment via `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Build Settings:**
- **Build Command:** `npm run build` (Vite production build)
- **Publish Directory:** `dist/` (optimized output)
- **SPA Redirect:** All routes redirect to `/index.html` for client-side routing
- **Environment Variables:** Managed through Netlify dashboard
  - `GEMINI_API_KEY` (optional, for Gemini features)

### Vite Build Configuration

**Output Directory:** `dist/` (explicitly configured in `vite.config.ts`)
- Gzip-optimized JavaScript (66.77 kB gzipped)
- Static assets bundled
- No source maps in production

### Deployment Process

1. **Push to GitHub:** Code changes trigger Netlify webhook
2. **Build:** Netlify runs `npm install && npm run build`
3. **Publish:** `dist/` directory deployed to CDN
4. **Live:** Accessible at `https://architectsvibe.com/`

**View the live app:** https://architectsvibe.com/

---

## N8n Workflow Integration

The app integrates with n8n workflows for lead capture and form automation.

### Webhook Endpoint

**N8n Webhook URL:** `https://n8n.srv913628.hstgr.cloud/webhook/architectsvibe-learner-form`

### Form Submission Flow

**Trigger Points:**
- User clicks "Get Training Agenda" button → `tag: 'downloaded-syllabus'`
- User clicks "Join Waitlist" button → `tag: 'interested-applied'`

**Payload Sent (POST):**
```json
{
  "name": "User's Full Name",
  "email": "user@email.com",
  "tag": "downloaded-syllabus | interested-applied",
  "timestamp": "2026-02-04T13:30:00.000Z",
  "source": "vibe-coding-architect-course"
}
```

### N8n Workflow Features

**Function:** `submitLeadToN8n()` in `App.tsx:46-73`
- Sends POST request to n8n webhook
- Handles response and error management
- Graceful error handling (still shows success UX)
- Logs request/response for debugging

**N8n Workflows Available:**
- `webhook-email-basic.json` - Basic email notification
- `webhook-zoho-crm.json` - Zoho CRM integration
- `webhook-form-email-telegram-sheets.json` - Multi-channel routing (Email, Telegram, Sheets)

**Configuration Guide:** See `n8n-workflows/references/configuration-guide.md`

### Skill Installation

**Location:** `/Users/vrln/.claude/skills/n8n-workflows.skill`
**Contains:**
- SKILL.md - Setup and usage documentation
- JSON workflow templates
- Configuration examples
- Integration guides

---

## Related Projects

In the parent directory (`../`), there's a related project:
- **smolvlm/visionscan-pos** - A vision scan POS system with:
  - FastAPI backend
  - React frontend
  - Ollama integration for vision detection
  - Docker Compose setup

---

## TypeScript Configuration

The project uses strict TypeScript settings:
- Target: ES2020 (modern JavaScript features)
- Module: ESNext (ES modules)
- JSX: React
- Strict mode enabled for type safety

---

## Development Notes

### Key Technologies
- **React 19:** Latest React with improved hooks and performance
- **Vite:** Fast build tool with instant HMR
- **TypeScript:** Type-safe development
- **Tailwind CSS:** Utility-first styling

### Browser Support
- Modern browsers (ES2020 support required)
- Chrome, Firefox, Safari, Edge

### Performance Considerations
- Vite's fast refresh for development
- Optimized production bundle output
- PDf asset bundled in public folder

---

## Future Enhancements

1. **Backend Integration**
   - Real Google Sheets API integration
   - Lead tracking and analytics
   - Email notifications

2. **Interactive Features**
   - Curriculum progress tracking
   - Session video embeds
   - Downloadable resources

3. **Marketing Features**
   - Success story testimonials
   - Cohort alumni section
   - Pricing and payment integration

4. **Analytics**
   - Mixpanel/Segment integration
   - Course interest tracking
   - Conversion metrics

---

## Troubleshooting

### Known Issues & Solutions (Updated Feb 14, 2026)

#### React 19 + react-helmet-async Peer Dependency Conflict

**Issue:** Netlify build fails with peer dependency error:
```
npm ERR! ERESOLVE because react-helmet-async@2.0.5 declares a peer dependency
on react@"^16.6.0 || ^17.0.0 || ^18.0.0", but project depends on react@19.2.4
```

**Solution (WORKING):**
- Create `.npmrc` file in project root with: `legacy-peer-deps=true`
- This tells npm to ignore peer dependency conflicts
- react-helmet-async works fine with React 19 despite the warning
- Netlify builds will now succeed automatically

**Files:**
- `.npmrc` (committed: 7175d26)

**Status:** ✅ FIXED - Do not remove .npmrc file

---

#### Tailwind CSS: CDN vs PostCSS

**Issue:** Console warning "cdn.tailwindcss.com should not be used in production"

**IMPORTANT - DO NOT FIX YET:**
- ⚠️ Attempting to replace Tailwind CDN with PostCSS breaks all site styling
- ⚠️ Tailwind v4 PostCSS plugin requires significant configuration changes
- ⚠️ Risk of complete CSS breakdown (as experienced Feb 14, 2026)

**Current Solution (KEEP AS-IS):**
- Use Tailwind CDN from index.html (line 35)
- Yes, there's a console warning, but site works perfectly
- Styling is reliable and consistent
- Build succeeds every time

**Future Enhancement (Do NOT attempt without full testing):**
- If migrating to PostCSS becomes necessary:
  1. Use Tailwind v3 (not v4) with PostCSS
  2. Test thoroughly in dev environment first
  3. Verify all custom classes (.glass, .hero-gradient) still work
  4. Check responsive design at all breakpoints
  5. Test production build multiple times before deploying

**Status:** 🟡 ACCEPTABLE - Console warning is cosmetic only

---

#### LinkedIn Image Hotlinking 403 Error

**Issue:** Instructor profile image from LinkedIn returns 403 Forbidden
```
GET https://media.licdn.com/...profile-displayphoto... 403 (Forbidden)
Error: Resource::kQuotaBytes quota exceeded
```

**Root Cause:**
- LinkedIn blocks direct image hotlinking for security
- Repeated failed attempts trigger browser quota limits
- Causes console spam and performance issues

**Solution (IMPLEMENTED):**
- Use ui-avatars.com API directly instead of LinkedIn URL
- URL: `https://ui-avatars.com/api/?name=Lakshminarayanan+Ramakrishnan&background=4f46e5&color=fff&size=512`
- Reliable, no authentication needed
- Professional appearance with brand colors

**Files Changed:**
- `App.tsx:1054` (committed: 23f51e6)

**Status:** ✅ FIXED - No more image errors

---

#### Modal Type Mismatch Causing CTAs to Fail

**Issue:** CTA buttons on /freshers page not opening modals when clicked

**Root Cause:**
- Type incompatibility between `App.tsx` and `FreshersPage.tsx`
- FreshersPage expected restricted modal type subset
- App.tsx provides full ModalType union
- TypeScript type mismatch prevented modal opening

**Solution (IMPLEMENTED):**
```typescript
// In FreshersPage.tsx - Use full ModalType instead of subset
type ModalType = 'SYLLABUS' | 'APPLY' | 'STUDENT_DETAILS' | 'STUDENT_REGISTER' | 'INSTITUTIONAL_INQUIRY';

interface FreshersPageProps {
  openModal: (type: ModalType) => void;  // ✅ Full type, not subset
  setCurrentPage: (page: PageType) => void;
}
```

**Files Changed:**
- `FreshersPage.tsx:11-14` (committed: 1b01ef2)

**Status:** ✅ FIXED - All CTAs now trigger modals correctly

---

### Netlify Deployment Issues

**Issue:** 404 errors for CSS/JS files after deployment

**Solution (Applied Feb 4, 2026):**
- Added `netlify.toml` with proper build configuration
- Removed references to non-existent `index.css` from HTML
- Added SPA redirect rule for client-side routing
- Updated `vite.config.ts` with explicit `outDir: 'dist'`

**Result:** App now deploys successfully to Netlify

### Local Development

**Issue:** Dependencies not installed
```bash
npm install  # Install all dependencies
```

**Issue:** Port 3000 already in use
```bash
npm run dev -- --port 5173  # Use different port
```

**Issue:** Logo not displaying
```bash
# Ensure public/architectsvibe.svg and public/architectsvibe.png exist
# Restart dev server if files were added
npm run dev
```

**Issue:** SEO tags not appearing on social media
```bash
# Verify index.html has meta tags in <head>
# Wait for social media platforms to re-cache the URL
# You can force re-cache using social platform's link preview tools
# Facebook: facebook.com/sharer/debug/
# Twitter: cards-dev.twitter.com/validator
# LinkedIn: linkedin.com/post-inspector/
```

---

## Git Repository & Version Control

**Repository URL:** https://github.com/vrlnarayana/vibe-code-architect.git

- **Remote Origin:** `https://github.com/vrlnarayana/vibe-code-architect.git`
- **Default Branch:** `main`
- **Latest Commits:**
  - Added pricing section with cohort details and group discount (d6f0650)
  - Updated navigation menu to link to new sections (5ee41ac)
  - Added comprehensive course positioning and outcomes sections (261a050)
- **Initialized:** February 4, 2026
- **Last Updated:** February 5, 2026

### Git Workflow
- Clone: `git clone https://github.com/vrlnarayana/vibe-code-architect.git`
- Pull latest: `git pull origin master`
- Create feature branch: `git checkout -b feature/your-feature`
- Push changes: `git push origin your-branch-name`

---

## Contact & Support

- **Course Admin:** lakshminarayanan@architectsvibe.com
- **Repository:** https://github.com/vrlnarayana/vibe-code-architect
- **Status:** Active development

---

*Last Updated: February 5, 2026 (Added comprehensive course positioning sections: Manifesto, Program Structure, Teaching Philosophy, Why Learn From Me, Outcomes, and Pricing with navigation menu mapping)*
