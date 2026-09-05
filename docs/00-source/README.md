# Threads Social Listening — Requirements Pack v1.0

**Snapshot date:** 2026-09-05  
**Product scope:** Internal social listening & content intelligence product for Threads  
**Default listening terms:** `1zone`, `#1zone`, `eventista`, `#eventista`

## Finalized technology stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Untitled UI React
- Recommended: App Router
- Recommended: TanStack Query for client-side server state
- Recommended chart layer: Recharts or the chart implementation already bundled/used by the selected Untitled UI dashboard components

### Backend
- NestJS
- TypeScript
- REST API for MVP
- Scheduled collector / workers
- Recommended ORM: Prisma with PostgreSQL

### Data
- Supabase Postgres
- Supabase Auth is recommended for the internal product
- Supabase database is accessed through NestJS for business data; the browser must never receive a Supabase service-role key

### AI / content intelligence
- Safety: OpenAI Moderation API (`omni-moderation-latest`) as the initial provider
- Relevance / sentiment / intent / topic / language / summary: provider abstraction with a small structured-output LLM as the initial implementation
- The exact LLM must remain configurable and must not be hard-coded into the product domain

## Document set

1. `01_PRODUCT_REQUIREMENTS.md`
   - Product goals and scope
   - Users and RBAC
   - Listening queries
   - Dashboard and Mentions Explorer
   - Classification taxonomy
   - Functional requirements and acceptance criteria

2. `02_TECHNICAL_ARCHITECTURE.md`
   - Next.js/NestJS/Supabase architecture
   - Threads ingestion
   - Analysis pipeline
   - Scheduling, retries, deduplication
   - Security, observability, performance and testing

3. `03_DATA_MODEL_AND_API.md`
   - Supabase/Postgres schema
   - Enums
   - Indexes
   - REST API contract
   - Example payloads
   - Metric definitions

4. `04_OPERATIONS_COSTS_ROADMAP.md`
   - Cost model
   - Supabase sizing
   - Threads API constraints
   - AI usage model
   - POC/MVP roadmap
   - Risks and launch checklist

5. `THREADS_SOCIAL_LISTENING_REQUIREMENTS.md`
   - Combined master file containing all requirements above

## Key product decisions

- MVP supports **Threads only**.
- The product listens to public content through the official Threads keyword/topic-tag search capability.
- Do **not** make “full comment-tree crawling for arbitrary third-party posts” an MVP promise. Validate the available reply access separately during the Meta API POC.
- Data is persisted in Supabase because historical analytics, trend comparison, deduplication, re-analysis and operational auditability all require first-party storage.
- Binary image/video content is not stored in the database in MVP.
- Store timestamps in UTC; display analytics in the user-selected timezone. Default product timezone: `Asia/Ho_Chi_Minh`.
- MVP is a single internal workspace, but the data model includes `project_id` so future brands/artists/events can be added without a major schema migration.
- `1zone`, `#1zone`, `eventista`, and `#eventista` are seeded defaults, not hard-coded constants.
- All AI labels are versioned by model, prompt and taxonomy version.
- “Confidence” shown by a generative classifier is an estimated confidence for prioritization, not a statistically calibrated probability.
- Analytics must exclude `irrelevant` content by default.

## External references checked for this version

- Meta Threads API / Search for Threads Posts:
  https://www.postman.com/meta/threads/request/m9j4i2x/search-for-threads-posts
- Meta Threads API collection:
  https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- Supabase pricing:
  https://supabase.com/pricing
- Supabase billing:
  https://supabase.com/docs/guides/platform/billing-on-supabase
- Untitled UI Next.js integration:
  https://www.untitledui.com/react/integrations/nextjs
- Untitled UI React:
  https://www.untitledui.com/react
- OpenAI Moderation:
  https://platform.openai.com/docs/api-reference/moderations
