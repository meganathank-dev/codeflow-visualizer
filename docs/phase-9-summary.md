# Phase 9 — MERN User Platform

Phase 9 adds an authenticated persistence layer without coupling user data to
the execution runtime.

## API boundaries

- `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- `/api/auth/me` and `/api/profile`
- `/api/projects` and owner-scoped project resources
- `/api/history`
- `/api/dashboard`

Authenticated `/api/execute` requests create compact history records after a
verified execution succeeds. Guest executions do not create user records.

## Security model

- Passwords use salted `scrypt` hashes.
- Access tokens expire after 15 minutes.
- Refresh tokens expire after seven days, rotate on use, and are stored in an
  HTTP-only, SameSite cookie.
- Refresh tokens are stored only as SHA-256 hashes in the database.
- Every project and history query is scoped to the authenticated user.
- API responses never expose password hashes or refresh tokens.

Rate limiting, production sandboxing, and deployment policy remain part of the
production-hardening phase.

## Storage

Production uses MongoDB through Mongoose models for users, sessions, projects,
and execution history. API tests inject a deterministic in-memory repository;
local development also falls back to temporary memory storage when no
`MONGODB_URI` is configured.

## Frontend

The existing visualizer remains the primary workspace. A responsive account
dialog adds registration, login, dashboard, saved projects, history, and
profile management. Saved projects can be loaded directly into the editor.
