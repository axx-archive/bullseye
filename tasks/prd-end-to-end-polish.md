# PRD: End-to-End Polish — Bullseye Agentic Script Intelligence Platform

## Introduction

Take Bullseye from a working prototype to a production-ready application. This encompasses wiring up real backend persistence (Supabase + Prisma), connecting the Scout agent loop to the frontend, replacing all mock/demo data with live data flows, adding proper loading/error/empty states across every screen, ensuring mobile responsiveness, and delivering a cohesive, polished experience from login through analysis delivery.

## Goals

- Wire up Supabase Auth and Prisma database so all user data persists across sessions
- Complete the Scout chat integration so users can upload scripts and receive real AI analysis
- Replace all hardcoded mock data with live database-backed state
- Add consistent loading skeletons, error boundaries, and empty states to every view
- Ensure every screen is responsive and usable on tablet/mobile viewports
- Add toast notifications for user feedback on success/error/progress events
- Polish transitions, hover states, and interactive feedback across all components
- Ensure the app builds and typechecks cleanly with zero warnings

## User Stories

### US-001: Database Migration & Connection

**Description:** As a developer, I need the Prisma schema migrated and the database connection working so that all features can persist data.

**Acceptance Criteria:**
- [ ] Prisma migration generated and applied to Supabase PostgreSQL
- [ ] `db` client properly instantiated and exported from `src/lib/db.ts`
- [ ] Environment variables documented (`.env.example` with `DATABASE_URL`, `DIRECT_URL`, Supabase keys)
- [ ] Seed script creates default Studio with 3 default ReaderPersonas (Maya, Colton, Devon)
- [ ] Seed script creates default ExecutiveProfiles (3-5 industry executives)
- [ ] Typecheck passes

---

### US-002: Supabase Auth Integration

**Description:** As a user, I want to sign up, log in, and have my session persist so my projects are saved.

**Acceptance Criteria:**
- [ ] Login page uses Supabase Auth (email/password sign-up and sign-in)
- [ ] Auth middleware redirects unauthenticated users to `/login`
- [ ] On first login, a `User` record is created in Prisma linked to `supabaseAuthId`
- [ ] A default Studio is created for new users (or they join the seed studio)
- [ ] Session token persists across page refreshes
- [ ] Sign-out button clears session and redirects to `/login`
- [ ] Error states shown for invalid credentials, network errors
- [ ] Typecheck passes

---

### US-003: Project CRUD with Database Persistence

**Description:** As a user, I want to create, view, and manage projects that are saved to the database.

**Acceptance Criteria:**
- [ ] "New Project" modal saves project to database via API route
- [ ] Home view fetches projects from database for current studio
- [ ] Project cards show real data (title, logline, format, genre, draft count, updated date)
- [ ] Selecting a project sets it as active and navigates to Scout tab
- [ ] Loading skeleton shown while projects are fetching
- [ ] Empty state shown when no projects exist
- [ ] Error toast shown if project creation fails
- [ ] Typecheck passes

---

### US-004: Draft Upload with PDF Extraction

**Description:** As a user, I want to upload a screenplay PDF and have the text extracted and stored.

**Acceptance Criteria:**
- [ ] Draft upload modal sends PDF to `/api/upload` for text extraction
- [ ] Extracted text is stored in the `Draft` record (`scriptText` field)
- [ ] PDF file is stored in Supabase Storage (or local for dev) with URL in `scriptUrl`
- [ ] Draft number auto-increments per project
- [ ] Upload progress indicator shown during extraction
- [ ] Error toast shown for corrupt/password-protected PDFs
- [ ] Success toast confirms upload with page count
- [ ] Draft appears in Revisions timeline immediately after upload
- [ ] Typecheck passes

---

### US-005: Scout Chat — Full Integration

**Description:** As a user, I want to chat with Scout in the left panel, see streaming responses, and watch analysis unfold in the right panel.

**Acceptance Criteria:**
- [ ] Scout chat input sends messages to `/api/scout` SSE endpoint
- [ ] Scout's text responses stream token-by-token into chat bubbles
- [ ] When Scout calls `spawn_readers`, right panel switches to "analysis" mode showing reader activity
- [ ] Reader analysis events (per-reader progress, scores) render in the right panel in real-time
- [ ] When Scout calls `focus_group`, right panel switches to focus group mode with streaming messages
- [ ] When Scout calls `reader_chat`, right panel shows 1:1 reader conversation
- [ ] When Scout calls `executive_eval`, right panel shows executive evaluation progress
- [ ] Tool start/end events show status indicators in the chat ("Spawning readers...", "Running focus group...")
- [ ] Chat history persists within a session (not lost on tab switch)
- [ ] File attachment button allows uploading a script directly from chat
- [ ] Error handling: if SSE fails, show retry button and error message
- [ ] Typecheck passes

---

### US-006: Reader Analysis Right Panel

**Description:** As a user, I want to see each reader's analysis progress and results in real-time as Scout orchestrates.

**Acceptance Criteria:**
- [ ] Right panel shows 3 reader cards (Maya, Colton, Devon) with status indicators
- [ ] Each reader card shows: "Analyzing..." → streaming progress → final scores + recommendation
- [ ] Scores animate in with the 10-bar visualization when complete
- [ ] After all readers finish, harmonized scores appear at the top
- [ ] Clicking a reader card expands to show full perspective (strengths, concerns, quote)
- [ ] Panel content persists when switching back from other right-panel modes
- [ ] Typecheck passes

---

### US-007: Focus Group Panel

**Description:** As a user, I want to watch a live focus group conversation between readers in the right panel.

**Acceptance Criteria:**
- [ ] Focus group messages stream in real-time with reader avatars and colors
- [ ] Moderator (Scout) messages styled distinctly from reader messages
- [ ] Typing indicator shows which reader is "speaking" next
- [ ] User can inject follow-up questions into the focus group via input field
- [ ] Messages auto-scroll to bottom as new ones arrive
- [ ] Focus group session is persisted to database when complete
- [ ] Typecheck passes

---

### US-008: Reader Chat Panel (1:1)

**Description:** As a user, I want to have a private 1:1 conversation with any reader about the script.

**Acceptance Criteria:**
- [ ] Right panel shows reader selector (3 readers with colored avatars)
- [ ] Selecting a reader opens a chat interface styled with that reader's color
- [ ] Messages sent to `/api/reader-chat` with reader context
- [ ] Reader responses stream token-by-token
- [ ] Conversation history maintained per reader per session
- [ ] Reader references their analysis/memory when responding
- [ ] Typecheck passes

---

### US-009: Coverage View — Live Data

**Description:** As a user, I want to see the full harmonized coverage report populated from real analysis data.

**Acceptance Criteria:**
- [ ] Coverage view fetches `DraftDeliverable` from database for current draft
- [ ] Harmonized scores render with real numeric values in 10-bar visualization
- [ ] Reader perspectives section shows real data from each reader's analysis
- [ ] Scout analysis section shows consensus, divergence, watch-outs
- [ ] Calibration toggle shows real percentile data from StudioIntelligence
- [ ] "No analysis yet" empty state shown when draft hasn't been analyzed
- [ ] Loading skeleton shown while fetching deliverable data
- [ ] Typecheck passes

---

### US-010: Focus Group View — Live Data

**Description:** As a user, I want to browse past focus group sessions and their transcripts.

**Acceptance Criteria:**
- [ ] Focus view lists past FocusSessions for current draft
- [ ] Selecting a session shows full message transcript with reader avatars
- [ ] "Start New Focus Group" button triggers Scout to run a new session
- [ ] Empty state shown when no focus sessions exist for this draft
- [ ] Loading skeleton during data fetch
- [ ] Typecheck passes

---

### US-011: Revisions View — Live Data

**Description:** As a user, I want to see all drafts in a timeline and compare scores across revisions.

**Acceptance Criteria:**
- [ ] Left sidebar shows real drafts from database (draft number, date, rating, page count)
- [ ] Selecting a draft shows its deliverable scores
- [ ] Compare mode shows score deltas between two drafts with directional arrows
- [ ] Reader memory narratives shown for each draft (evolution notes)
- [ ] "Upload New Draft" button opens draft upload modal
- [ ] Empty state when project has no drafts
- [ ] Loading skeleton during fetch
- [ ] Typecheck passes

---

### US-012: Pitch (Executive Evaluation) View — Live Data

**Description:** As a user, I want to run executive evaluations against real coverage data and see persisted results.

**Acceptance Criteria:**
- [ ] Executive grid fetches profiles from database
- [ ] "Run Simulation" calls Scout to execute `executive_eval` tool
- [ ] Results (verdict, confidence, rationale, factors, concerns) saved to database
- [ ] Past evaluations shown when revisiting the view
- [ ] Loading state during evaluation with per-executive progress
- [ ] Empty state when no evaluations exist yet
- [ ] Typecheck passes

---

### US-013: Studio Configuration View — Live Data

**Description:** As a user, I want to view and edit my studio's reader personas, executives, and calibration data.

**Acceptance Criteria:**
- [ ] Readers tab shows personas from database with editable fields
- [ ] Executives tab shows profiles from database with editable fields
- [ ] Calibration tab shows real StudioIntelligence data (distributions, percentiles, trends)
- [ ] Settings tab allows editing studio name and analysis preferences
- [ ] Changes save to database with success toast
- [ ] Validation errors shown inline for invalid inputs
- [ ] Typecheck passes

---

### US-014: Toast Notification System

**Description:** As a user, I want clear feedback when actions succeed, fail, or require attention.

**Acceptance Criteria:**
- [ ] Toast component renders in bottom-right corner with auto-dismiss (5s)
- [ ] Variants: success (green), error (red), warning (amber), info (blue)
- [ ] Toasts stack vertically, dismiss on click or timeout
- [ ] Used consistently for: project created, draft uploaded, analysis complete, errors, auth events
- [ ] Framer Motion enter/exit animations
- [ ] Typecheck passes

---

### US-015: Loading Skeletons

**Description:** As a user, I want to see skeleton placeholders while data loads so the UI doesn't jump.

**Acceptance Criteria:**
- [ ] Skeleton components created for: project card, reader card, score bar, chat message, timeline item
- [ ] Each view shows appropriate skeletons during initial data fetch
- [ ] Skeletons match the exact dimensions of real content (no layout shift)
- [ ] Pulse animation on skeletons using existing design system colors
- [ ] Typecheck passes

---

### US-016: Error Boundaries & Error States

**Description:** As a user, I want graceful error handling when things go wrong instead of blank screens.

**Acceptance Criteria:**
- [ ] React Error Boundary wraps each major view (Scout, Coverage, Focus, Revisions, Pitch, Studio)
- [ ] Error boundary shows: error icon, message, "Try Again" button
- [ ] API errors caught and displayed as inline error states (not just console.error)
- [ ] Network disconnect shows reconnection banner
- [ ] SSE stream errors show retry prompt in chat
- [ ] Typecheck passes

---

### US-017: Empty States

**Description:** As a user, I want helpful empty states that guide me on what to do next.

**Acceptance Criteria:**
- [ ] Every view has a contextual empty state (not just "No data")
- [ ] Empty states include: relevant icon, descriptive message, primary CTA button
- [ ] Home: "Create your first project" with New Project button
- [ ] Scout: "Upload a script to get started" with upload prompt
- [ ] Coverage: "Run analysis from Scout to see coverage" with link to Scout
- [ ] Focus: "Start a focus group from Scout" with explanation
- [ ] Revisions: "Upload your first draft" with upload button
- [ ] Pitch: "Complete coverage analysis first" with guidance
- [ ] Typecheck passes

---

### US-018: Mobile & Responsive Layout

**Description:** As a user, I want to use Bullseye on tablet and mobile devices without layout breaking.

**Acceptance Criteria:**
- [ ] Left icon rail collapses to bottom tab bar on mobile (< 768px)
- [ ] Scout split-screen stacks vertically on mobile with tab toggle for left/right panels
- [ ] Project grid goes to single column on mobile
- [ ] Modals are full-screen on mobile (not floating)
- [ ] Chat input stays fixed at bottom on mobile
- [ ] Reader cards stack to single column on tablet
- [ ] Score bars remain readable at small widths
- [ ] All text remains legible (no overflow or truncation without ellipsis)
- [ ] Typecheck passes

---

### US-019: Interactive Polish (Hover, Focus, Transitions)

**Description:** As a user, I want every interactive element to feel responsive and intentional.

**Acceptance Criteria:**
- [ ] All clickable elements have hover state transitions (opacity, background, or scale)
- [ ] Buttons show active/pressed state (scale down slightly)
- [ ] Cards have subtle hover elevation (border brightness increase or shadow)
- [ ] Tab switches use crossfade transitions (not hard cuts)
- [ ] Right panel mode switches animate with slide/fade
- [ ] Score bars animate on first render (fill from left)
- [ ] Disabled buttons show reduced opacity + not-allowed cursor
- [ ] All transitions use consistent duration (150-200ms) and easing
- [ ] Typecheck passes

---

### US-020: Data Fetching Layer (React Query)

**Description:** As a developer, I need a consistent data fetching layer so all views load and cache data properly.

**Acceptance Criteria:**
- [ ] React Query provider wrapped at app root
- [ ] Custom hooks created: `useProjects`, `useProject`, `useDrafts`, `useDeliverable`, `useFocusSessions`, `useEvaluations`, `useStudioIntelligence`, `useReaderPersonas`, `useExecutiveProfiles`
- [ ] Each hook handles loading, error, and data states
- [ ] Mutations created for: createProject, uploadDraft, updateStudio, updateReaderPersona, updateExecutiveProfile
- [ ] Optimistic updates for project creation (show immediately, rollback on error)
- [ ] Stale time configured appropriately (projects: 30s, deliverables: 5min, studio config: 10min)
- [ ] Typecheck passes

---

### US-021: API Routes for CRUD Operations

**Description:** As a developer, I need API routes for all data operations that the frontend hooks consume.

**Acceptance Criteria:**
- [ ] `GET/POST /api/projects` — list projects for studio, create project
- [ ] `GET /api/projects/[id]` — get project with drafts
- [ ] `POST /api/projects/[id]/drafts` — create draft (with upload)
- [ ] `GET /api/drafts/[id]/deliverable` — get coverage/analysis data
- [ ] `GET /api/drafts/[id]/focus-sessions` — list focus sessions
- [ ] `GET /api/drafts/[id]/evaluations` — list executive evaluations
- [ ] `GET/PUT /api/studio` — get/update studio config
- [ ] `GET/PUT /api/studio/readers` — get/update reader personas
- [ ] `GET/PUT /api/studio/executives` — get/update executive profiles
- [ ] `GET /api/studio/intelligence` — get calibration data
- [ ] All routes validate auth via Supabase session
- [ ] All routes return proper error codes (400, 401, 404, 500)
- [ ] Typecheck passes

---

### US-022: Build & Type Safety Cleanup

**Description:** As a developer, I want the app to build cleanly with no TypeScript errors or lint warnings.

**Acceptance Criteria:**
- [ ] `npm run build` completes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No `any` types remaining (replace with proper types)
- [ ] All unused imports removed
- [ ] All unused variables removed
- [ ] No console.log statements in production code (use proper error handling)
- [ ] ESLint passes with zero warnings

---

## Functional Requirements

- FR-1: All user data (projects, drafts, analysis, evaluations) must persist in PostgreSQL via Prisma
- FR-2: Authentication must use Supabase Auth with session cookies
- FR-3: The Scout agent must stream responses via SSE with typed event protocol
- FR-4: PDF text extraction must happen server-side via pdfjs-dist
- FR-5: All views must show loading, error, and empty states appropriately
- FR-6: Toast notifications must appear for all user-initiated actions (success + failure)
- FR-7: The app must be fully functional on viewports >= 375px wide
- FR-8: All interactive elements must have visible hover/active/disabled states
- FR-9: React Query must handle all data fetching with proper cache invalidation
- FR-10: API routes must validate authentication and return proper HTTP status codes
- FR-11: The app must typecheck and build with zero errors or warnings
- FR-12: SSE streams must handle disconnection gracefully with retry logic

## Non-Goals

- Accessibility/WCAG compliance (deferred to separate effort)
- Internationalization/localization
- Offline support or service workers
- Real-time collaboration (multi-user editing)
- Payment/billing integration
- Analytics/telemetry
- Performance optimization (bundle splitting, lazy loading) beyond what's necessary
- Custom reader persona creation UI (just viewing/editing defaults)
- Script versioning or diff visualization (just score comparison)
- Export to PDF/Word for coverage reports

## Design Considerations

- Maintain existing "Precision Confidence" design language (dark theme, gold accent, minimal borders)
- Use existing shadcn/ui primitives wherever possible (Button, Dialog, DropdownMenu, ScrollArea, etc.)
- Toasts should use the existing color system (success green, error red, warning amber)
- Loading skeletons should use `bg-elevated` with `animate-pulse`
- Empty states should use Lucide icons at 48px with `text-muted-foreground`
- Mobile bottom tab bar should mirror the icon rail icons with active gold indicator
- Reuse existing Framer Motion patterns (spring animations, `animate-fade-in-up`)

## Technical Considerations

- **Database**: Supabase PostgreSQL with Prisma ORM (schema already defined)
- **Auth**: Supabase Auth SDK with `@supabase/ssr` for cookie-based sessions
- **AI**: Anthropic Claude SDK + Claude Agent SDK for Scout orchestration
- **State**: Zustand for UI state, React Query for server state (avoid duplication)
- **SSE**: Native EventSource or fetch-based stream reading for Scout/Reader chat
- **Storage**: Supabase Storage for PDF files (or local filesystem in dev)
- **Env vars needed**: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- **Build target**: Next.js 16 with App Router, deployed to Vercel

## Success Metrics

- Every screen renders meaningful content or an appropriate empty/loading state (no blank screens)
- A user can sign up, create a project, upload a script, and receive full coverage in one session
- All data persists across browser refreshes and re-logins
- The app builds with zero TypeScript errors and zero ESLint warnings
- All interactive elements provide visual feedback within 100ms
- Scout SSE streams recover gracefully from network interruptions
- Mobile layout is usable without horizontal scrolling on 375px viewport

## Open Questions

- Should we use Supabase Storage or a simpler local file approach for dev-mode PDF storage?
- Should the Studio seed data match specific real executives, or use fictional ones?
- Should React Query cache be persisted to localStorage for faster subsequent loads?
- Should Scout conversation history persist across browser sessions (in database), or just within a session (in Zustand)?
- What is the maximum script length (in characters) we should accept before truncating for Claude's context window?
