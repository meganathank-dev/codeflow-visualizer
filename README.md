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

## Current Status

- Phase 0: Completed
- Phase 1: In progress

Phase 0 validated:

- Automatic JavaScript tracing
- Python runtime tracing
- Java JDI tracing
- SQL logical-query visualization
- Trace validation and serialization
- State reconstruction
- Timeline playback
- Cross-language compatibility

## Run Phase 0 Tests

```bash
pnpm test:pocs
```

## Security

Phase 0 POCs execute controlled local fixtures only.

Arbitrary user code must never execute inside the main Express API process. Production code execution will require an isolated sandbox with resource and network restrictions.

See [Technical Architecture](docs/architecture.md) for the main architecture.