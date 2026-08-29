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
