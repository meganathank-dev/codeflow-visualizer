# Phase 11 — Reliability, Educational Accessibility and Security Hardening

Phase 11 prepares CodeFlow's completed learning features for dependable classroom
use and safer deployment. It improves readability without changing trace truth,
removes operating-system-native controls that did not match the product, orders
development-service startup, and establishes enforceable production boundaries.

## Educational display modes

The execution workspace now supports two persistent display modes:

- **Compact** is the default and keeps more execution information visible.
- **Presentation** increases tabs, variables, console output, call-stack frames,
  event descriptions, full-trace rows, and AI explanations for teachers and
  projectors.

The selected mode is stored locally and does not reset the current execution.
Inspector tabs have larger targets, the tab strip remains horizontally
scrollable, and variable/value typography uses the same scale across tabs.

## Run and playback continuity

Before the first run, the execution area shows a single honest ready state
instead of presenting the bundled example trace as if it had already executed.
`Run code` now creates the verified trace and starts playback as one action.
During playback the action becomes `Pause`; a learner can then `Resume`, and a
completed trace offers `Run again`. A second `Play trace` click is not required.

## CodeFlow dropdown system

The native language and playback-speed `<select>` elements have been replaced by
one reusable CodeFlow listbox component. It provides:

- theme-aligned menus, borders, focus states, descriptions, and selected marks;
- language colors and source filenames;
- readable playback-speed labels;
- the Compact/Presentation selector;
- mouse, touch, Arrow key, Home, End, Enter, Space, Escape, and Tab behavior;
- combobox/listbox roles and selected-state announcements.

This removes the bright operating-system dropdown shown by Windows while keeping
the control accessible to keyboard and assistive-technology users.

## Ordered development startup

`pnpm dev` now starts services in dependency order:

1. execution service;
2. API after execution health succeeds;
3. web application after API health succeeds.

The previous parallel command remains available as `pnpm dev:parallel`. Ordered
startup prevents the first Vite `/api/health` request from reaching port 4000
before the API has bound it. On Windows, the launcher routes pnpm through the
configured command processor instead of directly spawning `pnpm.cmd`, avoiding
the `spawn EINVAL` failure produced by newer Node.js releases.

## API hardening

The API now applies no-store caching, JSON-only content security policy,
clickjacking protection, content-type protection, referrer policy, restricted
browser permissions, configurable origin enforcement, and bounded request-rate
limits. Separate limits protect execution, AI, and account routes while the
general API allowance remains suitable for normal timeline and dashboard use.

`WEB_ORIGIN` defines the deployed frontend origin. Production rejects browser
origins outside the configured allowlist; local same-origin proxy development
continues to work without extra configuration.

## Production execution gate

The execution service continues to be safe for local trusted development and
continues to report that it does not accept untrusted code. Production startup
now fails closed unless the deployment supplies all six verified capabilities:

- network isolation;
- filesystem isolation;
- memory limits;
- CPU limits;
- process limits;
- an ephemeral execution workspace.

Health output exposes runtime readiness and the effective isolation capabilities.
An environment flag alone cannot silently convert the local runner into a public
sandbox.

## Acceptance coverage

Phase 11 tests cover custom dropdown semantics, removal of native language and
speed selects, display-mode normalization and persistence, presentation-mode
type scale, automatic playback after a verified run, an honest pre-run idle
state, API security headers, origin normalization, rate limiting, readiness
metadata, and the production isolation fail-closed gate. The complete existing
multi-language, user-platform, verified-AI, trace, core, and conformance suites
remain unchanged and must also pass.
