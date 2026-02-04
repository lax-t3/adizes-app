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
- **Styling:** Tailwind CSS (inferred from className usage)
- **Deployment:** Netlify-ready

---

## Project Structure

```
the-vibe-coding-architect-course/
├── App.tsx                 # Main React component with modal management
├── index.tsx               # React DOM entry point
├── index.html              # HTML template
├── constants.ts            # Curriculum and use case data
├── types.ts                # TypeScript interfaces
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
├── metadata.json           # App metadata for AI Studio
├── .env.local              # Local environment (Gemini API key)
├── .gitignore              # Git ignore rules
├── README.md               # Original setup guide
├── public/                 # Static assets
│   └── AI Orchestration Training Agenda.pdf
└── .DS_Store               # macOS system file
```

---

## Key Features

### 1. Interactive Curriculum Display
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

### 3. Lead Capture System
- Modal-based forms for "Download Syllabus" and "Apply to Cohort"
- Integration with Google Sheets API for lead tracking
- Form validation and submission handling
- Success state with checkmark confirmation

### 4. Responsive Design
- Mobile-friendly interface with Tailwind CSS
- Glass-morphism modal styling
- Backdrop blur effects
- Proper accessibility with icon components

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
  - `activeMonth` - Current curriculum month selection
  - `modalType` - Modal state ('SYLLABUS', 'APPLY', or null)
  - `formData` - User input (name, email)
  - `isSubmitting` - Submission loading state
  - `isSuccess` - Form success confirmation

- **Key Functions:**
  - `openModal()` - Opens lead capture modal
  - `closeModal()` - Closes modal
  - `recordLeadToGoogleSheet()` - Sends lead data to backend (currently simulated)
  - `triggerSyllabusDownload()` - Initiates PDF download
  - `handleSubmit()` - Form submission handler

- **Icon Components:**
  - TerminalIcon, CpuIcon, CodeIcon, CalendarIcon, CloseIcon, CheckIcon, LinkedinIcon
  - SVG-based, reusable across the app

### Curriculum Data (`constants.ts`)
- `CURRICULUM` - Map of month strings to week data arrays
- `USE_CASES` - Array of practical enterprise scenarios

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

The application is configured for deployment to Netlify:
- Connected via Git repository
- Production build artifacts in `dist/`
- Environment variables managed through Netlify dashboard

**View the live app:** https://ai.studio/apps/drive/1MuI98uLd4beG741GLQtg5y3mA5r4C-km

---

## Google Sheets Integration

The app integrates with Google Sheets for lead capture:
- Function: `recordLeadToGoogleSheet(name, email, tag)`
- Currently simulated (logs to console)
- Tags used:
  - `'downloaded-syllabus'` - Syllabus download requests
  - `'interested-applied'` - Course application signups
- Admin email: `vrl.narayana@gmail.com`

**Future Enhancement:** Replace simulated call with actual Google Sheets API integration.

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

## Contact & Support

- **Course Admin:** vrl.narayana@gmail.com
- **Repository:** Git-managed project
- **Status:** Active development

---

*Last Updated: February 4, 2026*
