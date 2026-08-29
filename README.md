# CodeFlow Visualizer

> Run It. Trace It. See It. Understand It.

CodeFlow Visualizer is an interactive program-execution visualization platform that helps users understand how code and SQL queries execute step by step.

## Current Languages

- JavaScript
- Python
- Java
- SQL

## Main Technology

- React
- JavaScript
- Vite
- Node.js
- Express.js
- MongoDB
- pnpm workspace

## Core Architecture

```text
Source Code
→ Language Adapter
→ Execution Runtime
→ Standardized Trace
→ State Reconstruction
→ Visualization
→ Timeline and Animation
```

JavaScript, Python and Java use program-execution traces.

SQL uses a specialized logical-query trace.

## Phase 9 User Platform

CodeFlow now includes an optional authenticated MERN workspace:

- Registration and sign-in
- Short-lived access tokens and rotating HTTP-only refresh sessions
- User profile
- Private saved projects with load, rename, duplicate, and delete actions
- Automatic execution history for signed-in users
- Personal dashboard and language activity summary

Guest execution remains available. Sign in only when you want persistence.

## Phase 10 AI and reliability

Phase 10 adds learning assistance without allowing AI to invent program state:

- Separate explanations for every source line, including braces and block endings
- A complete numbered execution procedure with direct event navigation
- Verified-trace program, current-step, error, debugging, complexity, and tutor explanations
- An optional OpenAI Responses API provider with a deterministic verified-trace fallback
- Service-readiness checks, cached Java helpers, safer timeout budgets, elapsed run status, and run cancellation
- Forgot-password and one-time password-reset flows

Set `OPENAI_API_KEY` in `apps/api/.env` to enable OpenAI explanations. When it
is empty, all explanation actions continue to work with the local verified-trace
engine. AI requests are accepted only for a short-lived trace identifier issued
after a successful real execution.

In development, the reset token is returned to the account dialog for local
testing. Production must provide a password-reset delivery adapter and never
expose the token in an API response.

### MongoDB setup

Copy the API environment template:

```cmd
copy apps\api\.env.example apps\api\.env
```

The default connection is:

```text
mongodb://127.0.0.1:27017/codeflow_visualizer
```

Replace both token secrets in `apps/api/.env` with different long random values.
When `MONGODB_URI` is absent in local development, CodeFlow uses temporary
in-memory user storage so the visualizer still starts. Production always
requires MongoDB.

### Start

```cmd
pnpm install
pnpm test
pnpm build
pnpm dev
```

Open `http://127.0.0.1:5173/` and use the **Sign in** button in the header.

## Project Structure

```text
apps/
├── web/
├── api/
└── execution/

packages/
├── config/
├── execution-trace/
└── visualizer-core/

docs/
pocs/
```

## Documentation

- [Technical architecture](docs/architecture.md)
- [Phase 0 — Technical validation](docs/phase-0-summary.md)
- [Phase 1 — Architecture foundation](docs/phase-1-summary.md)
- [Phase 2 — Real JavaScript execution](docs/phase-2-summary.md)
- [Phase 3 — Real Python execution](docs/phase-3-summary.md)
- [Phase 4 — Real Java JDI execution](docs/phase-4-summary.md)
- [Phase 5 — Real SQL and relational visualization](docs/phase-5-summary.md)
- [Phase 6 — Cross-language data structures](docs/phase-6-summary.md)
- [Phase 7 — Algorithms and algorithm closure](docs/phase-7-summary.md)
- [Phase 8 — Core MVP completion](docs/phase-8-summary.md)
- [Phase 9 — MERN user platform](docs/phase-9-summary.md)
- [Phase 10 — AI, feedback, and reliability](docs/phase-10-summary.md)
