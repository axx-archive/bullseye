# BULLSEYE

Agentic Script Intelligence Platform — multi-agent screenplay analysis powered by Claude.

## What It Does

BULLSEYE uses multiple AI agents to analyze screenplays the way a professional script coverage team would:

1. **Scout** orchestrates the workflow, communicating with users and coordinating sub-agents
2. **Three Reader Agents** (Maya the Optimist, Colton the Skeptic, Devon the Craftsman) independently analyze scripts from distinct perspectives
3. **Harmonization Engine** synthesizes reader analyses into unified coverage with consensus/divergence points
4. **Focus Groups** run live streaming conversations between readers, moderated by Scout
5. **Executive Pitch Simulation** models how industry executives would evaluate the project (PURSUE/PASS)
6. **Studio Intelligence** calibrates scores against historical corpus data
7. **Memory Architecture** maintains per-reader context across drafts and sessions

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **AI**: Claude Agent SDK + Anthropic Claude API (Opus 4.5 for analysis/orchestration, Haiku 4 for lightweight tasks)
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 7 (with pg adapter)
- **Auth**: Supabase Auth (email/password, cookie-based sessions)
- **UI**: Tailwind CSS 4, shadcn/ui components, Framer Motion
- **State**: Zustand (UI state) + React Query (server state)
- **PDF**: pdfjs-dist (server-side text extraction)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── projects/          # Project CRUD + draft upload
│   │   │   └── [id]/chat/     # Project-scoped chat persistence (GET/POST)
│   │   ├── drafts/[id]/       # Deliverable, focus-sessions, evaluations
│   │   ├── scout/             # Scout SSE streaming endpoint
│   │   ├── reader-chat/       # 1:1 reader chat SSE endpoint
│   │   ├── upload/            # PDF text extraction
│   │   ├── studio/            # Studio config, readers, executives, intelligence
│   │   └── auth/              # User provisioning, callbacks
│   ├── login/                 # Login/signup page
│   └── page.tsx               # Main app (tab-based, auth-protected)
├── components/
│   ├── home/              # Project grid, create/upload modals
│   ├── scout/             # Scout chat, right-panel modes (analysis, focus, reader chat, exec)
│   ├── coverage/          # Harmonized coverage report view
│   ├── focus/             # Focus group session browser
│   ├── revisions/         # Draft timeline and score comparison
│   ├── pitch/             # Executive evaluation view
│   ├── studio/            # Studio configuration (readers, executives, calibration)
│   ├── layout/            # App shell with icon rail + mobile bottom tab bar
│   ├── shared/            # Reader cards, score indicators, toast, skeleton, error boundary, empty state
│   └── ui/                # shadcn/ui primitives
├── hooks/                 # React Query hooks (useProjects, useDrafts, useStudio, etc.)
├── lib/
│   ├── agent-sdk/         # Claude Agent SDK integration (MCP tool server, prompts, event routing)
│   │   └── context-budget.ts  # Token budget allocation for 200K context window
│   ├── agents/            # Reader persona definitions
│   ├── executive/         # Executive profiles
│   ├── harmonization/     # Score harmonization logic
│   ├── memory/            # Three-layer memory engine
│   ├── studio-intelligence/ # Calibration and percentile engine
│   ├── supabase/          # Supabase client utilities (server, browser, admin)
│   ├── rate-limiter.ts    # Sliding-window rate limiter for Opus 4.5 API limits
│   ├── auth.ts            # getCurrentUser helper
│   └── db.ts              # Prisma client singleton (pg adapter)
├── stores/                # Zustand stores (app-store, toast-store)
├── types/                 # TypeScript type definitions
└── middleware.ts          # Auth redirect middleware
```

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An Anthropic API key

### Environment Variables

Copy `.env.example` to `.env` and fill in values:

```
DATABASE_URL="postgresql://..."          # Supabase pooler connection string
DIRECT_URL="postgresql://..."            # Supabase direct connection (for migrations)
ANTHROPIC_API_KEY="sk-ant-..."           # Anthropic API key (for Claude Agent SDK)
NEXT_PUBLIC_SUPABASE_URL="https://..."   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."      # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY="..."          # Supabase service role key
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Install & Run

```bash
npm install
npx prisma migrate deploy   # Apply database migrations
npx tsx scripts/seed.ts      # Seed default studio, readers, and executives
npm run dev                  # Start dev server (localhost:3000)
```

## Architecture

### Scout + MCP Tool Server

Scout is the user-facing orchestrator, powered by Claude Opus 4.5 via the Claude Agent SDK. It runs as an agentic loop with access to an MCP tool server (`src/lib/agent-sdk/tools/`) that provides:

- `ingest_script` — Parse and store uploaded screenplay text
- `spawn_readers` — Launch parallel reader analysis (3 independent agents)
- `harmonize_analyses` — Synthesize reader perspectives into unified coverage
- `focus_group` — Run moderated multi-reader conversations
- `reader_chat` — Direct 1:1 reader conversations
- `executive_eval` — Simulate executive pitch evaluations
- `memory_read/write` — Cross-draft reader memory persistence
- `studio_intelligence` — Historical calibration context

The Scout endpoint (`/api/scout`) streams results via SSE with typed events that drive the frontend's real-time UI.

### Chat Persistence

Scout conversations are project-scoped and persisted to the database via `ChatSession` and `ChatSessionMessage` models. When switching between projects, chat history is loaded/saved automatically. Scout receives full project context (script text, reader memories, focus group history) within a managed token budget to stay within the 200K context window.

### Rate Limiting

A sliding-window rate limiter (`src/lib/rate-limiter.ts`) ensures all API calls stay within Opus 4.5 Tier 1 limits (50 req/min, 30K input tokens/min, 8K output tokens/min). When requests are queued, the SSE stream emits status events and the UI shows a subtle processing indicator.

### Agent System

Each reader agent has a distinct persona and evaluation lens:

| Reader | Perspective | Focuses On |
|--------|-------------|------------|
| Maya Chen | The Optimist | Potential, emotional resonance, audience connection |
| Colton Rivers | The Skeptic | Logical consistency, market reality, execution gaps |
| Devon Park | The Craftsman | Technical craft, structure, dialogue quality |

Readers analyze independently, then their perspectives are harmonized into a single coverage report that preserves both consensus and divergence.

### Scoring System

Five dimensions scored on a 5-point scale (excellent/very_good/good/so_so/not_good) with 0-100 numeric precision:

- **Premise** — concept originality and hook
- **Character** — depth, arcs, castability
- **Dialogue** — voice, subtext, authenticity
- **Structure** — pacing, act breaks, momentum
- **Commerciality** — market positioning, audience appeal

### Memory Architecture

Three layers maintain agent continuity:

1. **Resources (L1)** — archived full outputs (coverage, transcripts)
2. **Items (L2)** — queryable atomic facts extracted from events
3. **Narratives (L3)** — evolving first-person summaries injected into prompts

### Multi-User Support

Each authenticated user gets their own Studio with isolated projects, drafts, and analysis history. Supabase Auth handles sessions; Prisma manages user-scoped data.

## License

Private — all rights reserved.
