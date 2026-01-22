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

- **Framework**: Next.js 15 (App Router, Turbopack)
- **AI**: Anthropic Claude API (Sonnet for analysis, Haiku for utilities)
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 7
- **Auth**: Supabase Auth (email/password)
- **UI**: Tailwind CSS, shadcn/ui components
- **State**: Zustand

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/       # Script analysis endpoint
│   │   ├── chat/          # Scout chat endpoint
│   │   ├── executive/     # Executive evaluation endpoint
│   │   ├── focus-group/   # Focus group streaming endpoint
│   │   └── studio/        # Studio intelligence endpoint
│   ├── auth/              # Auth callbacks and signout
│   ├── login/             # Login/signup page
│   └── (dashboard)/       # Main app (auth-protected)
├── components/
│   ├── chat/              # Chat interface
│   ├── coverage/          # Coverage report view
│   ├── focus/             # Focus group view
│   ├── layout/            # App shell, navigation
│   ├── pitch/             # Executive pitch view
│   ├── revisions/         # Draft revision tracking
│   ├── scout/             # Scout orchestrator view
│   ├── shared/            # Reader cards, score indicators
│   ├── studio/            # Studio intelligence view
│   └── ui/                # shadcn/ui primitives
├── lib/
│   ├── agents/            # Reader personas, analysis orchestration, harmonization
│   ├── executive/         # Executive profiles and evaluation engine
│   ├── focus-group/       # Focus group conversation engine
│   ├── harmonization/     # Score harmonization logic
│   ├── memory/            # Three-layer memory (Resources, Items, Narratives)
│   ├── studio-intelligence/ # Calibration and percentile engine
│   ├── supabase/          # Supabase client utilities (server, browser, middleware)
│   ├── auth.ts            # getCurrentUser / requireUser helpers
│   ├── db.ts              # Prisma client singleton
│   └── utils.ts           # Shared utilities
├── stores/                # Zustand state management
├── types/                 # TypeScript type definitions
└── middleware.ts          # Auth redirect middleware
```

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An Anthropic API key

### Environment Variables

Create a `.env` file:

```
DATABASE_URL="postgresql://..."          # Supabase pooler connection string
ANTHROPIC_API_KEY="sk-ant-..."           # Anthropic API key
NEXT_PUBLIC_SUPABASE_URL="https://..."   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."      # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY="..."          # Supabase service role key
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Install & Run

```bash
npm install
npx prisma db push    # Push schema to database
npm run dev           # Start dev server (localhost:3000)
```

## Architecture

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
