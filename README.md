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
