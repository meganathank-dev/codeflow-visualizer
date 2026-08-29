# Phase 2 — Real JavaScript Execution

## Status

Completed.

## Objective

Replace the curated JavaScript preview with the first complete real-execution
vertical slice from editor source to an interactive verified timeline.

## Delivered

- JavaScript source submission from the React workspace.
- Request validation and forwarding through the Express API.
- Execution in a dedicated child process owned by the execution service.
- AST-based source instrumentation and a controlled VM runtime.
- Source-policy rejection for unsupported or unsafe operations.
- Ordered program events compatible with the shared trace schema.
- State reconstruction for variables, arrays, stacks, functions, loops,
  conditions, console output, and errors.
- Real trace presentation in the existing editor, visualizer, inspector, and
  timeline components.
- Syntax-error, runtime-error, timeout, output-size, and trace-size handling.

## Execution Flow

```text
React editor
→ POST /api/execute
→ execution service
→ JavaScript adapter
→ instrumented child-process runtime
→ validated trace and replay states
→ frontend visualization
```

## Important Boundary

JavaScript does not execute inside the API process. The execution service and
its worker process are separate from authentication, persistence, and HTTP
routing. This phase is intended for local trusted development; production
sandbox isolation remains a later hardening requirement.

## Verification

- Real JavaScript execution completed successfully.
- Variables and array mutations matched the runtime result.
- Stack operations and console output stayed synchronized with the trace.
- Loops and condition outcomes were replayable without rerunning the source.
- Invalid source and restricted operations returned structured errors.
- Shared trace validation and frontend presentation tests passed.

## Primary Commands

```cmd
pnpm test:execution
pnpm test:api
pnpm test:web
pnpm build
```
