# CodeFlow Visualizer — Technical Architecture

## 1. Project Definition

CodeFlow Visualizer is an interactive program-execution visualization platform.

Users can write code, run it, and observe how the program or SQL query executes step by step.

Core philosophy:

> Run It. Trace It. See It. Understand It.

Core pipeline:

```text
Source Code
→ Language Adapter
→ Execution Runtime
→ Standardized Trace
→ State Reconstruction
→ Visualization
→ Animation and Timeline
```

## 2. Supported Languages

The current product scope includes:

1. JavaScript
2. Python
3. Java
4. SQL

C is not part of the current requirements.

## 3. Application Technology

The main web application will be developed using JavaScript, not TypeScript.

### Frontend

- React
- JavaScript
- Vite
- Tailwind CSS
- Monaco Editor
- Zustand
- React Router
- Framer Motion
- Lucide React

### Backend

- Node.js
- Express.js
- JavaScript
- MongoDB
- Mongoose
- Zod
- JWT and bcrypt when authentication is introduced

## 4. Language Adapter Strategy

Each language uses its own execution adapter.

```text
JavaScript → JavaScript Adapter
Python     → Python Adapter
Java       → Java Adapter
SQL        → SQL Adapter
```

The adapters convert language-specific runtime behavior into a standardized execution trace.

### JavaScript

JavaScript source is parsed into an Abstract Syntax Tree and instrumented before controlled execution.

### Python

Python runtime behavior is observed using Python tracing facilities.

### Java

Java execution is observed using the Java Debug Interface.

### SQL

SQL uses a specialized logical-query visualization model verified against sandboxed database execution.

SQL visualization can represent:

- Table scan
- Row filtering
- Column projection
- Sorting
- Grouping
- Aggregation
- Joins
- Result generation

SQL visualization does not claim to reproduce the database engine’s internal physical execution plan.

## 5. Trace Domains

CodeFlow Visualizer uses two trace domains.

### Program Execution

Used by:

- JavaScript
- Python
- Java

### Query Execution

Used by:

- SQL

Both domains use ordered, structured and versioned events.

## 6. Execution Events

Every event contains:

- Schema version
- Trace ID
- Event ID
- Sequence number
- Domain
- Language
- Event type
- Source location
- Payload
- State delta

Common program events include:

- `PROGRAM_START`
- `PROGRAM_END`
- `STATEMENT_EXECUTE`
- `VARIABLE_DECLARE`
- `VARIABLE_UPDATE`
- `ARRAY_CREATE`
- `ARRAY_ACCESS`
- `ARRAY_UPDATE`
- `FUNCTION_CALL`
- `FUNCTION_ENTER`
- `FUNCTION_RETURN`
- `LOOP_START`
- `LOOP_CONDITION`
- `LOOP_ITERATION`
- `LOOP_END`
- `CONDITION_EVALUATE`
- `BRANCH_ENTER`
- `OUTPUT`
- `ERROR`

SQL events include:

- `SQL_QUERY_START`
- `SQL_SCAN`
- `SQL_FILTER`
- `SQL_PROJECT`
- `SQL_SORT`
- `SQL_GROUP`
- `SQL_AGGREGATE`
- `SQL_JOIN`
- `SQL_RESULT`

## 7. State Reconstruction

Code execution happens once and produces an ordered trace.

The visualizer reconstructs the corresponding state for every event:

```text
Event 0 → State 0
Event 1 → State 1
Event 2 → State 2
```

Users can move backward and forward through reconstructed states without rerunning the program.

Supported timeline controls:

- First
- Previous
- Play
- Pause
- Next
- Last
- Reset
- Seek
- Speed control

## 8. Visualization Architecture

Execution events are converted into meaningful visual behavior.

Examples:

```text
VARIABLE_UPDATE
→ Display the new value

ARRAY_ACCESS
→ Highlight the accessed index

ARRAY_UPDATE
→ Animate the changed cell

FUNCTION_ENTER
→ Add a call-stack frame

FUNCTION_RETURN
→ Remove the call-stack frame

LOOP_ITERATION
→ Advance the iteration indicator

SQL_FILTER
→ Separate matching and rejected rows

SQL_SORT
→ Move rows into sorted order
```

Animations must represent actual execution behavior. They must not be decorative only.

## 9. Security Architecture

Arbitrary user code must never execute inside the main Express server process.

Production execution flow:

```text
React Frontend
→ Express API
→ Execution Service
→ Isolated Sandbox
→ Language Runtime
→ Validated Trace
→ Frontend
```

The production sandbox must enforce:

- CPU limits
- Memory limits
- Execution timeout
- Maximum code size
- Maximum output size
- Maximum trace steps
- Network restrictions
- Filesystem restrictions
- Process isolation
- Runtime-error handling
- Infinite-loop protection

The current local runner uses dedicated child processes and strict language-level
timeouts, but it is still a trusted-development environment. It does not accept
untrusted public code. Phase 11 makes production startup fail closed unless the
hosting layer confirms network, filesystem, memory, CPU, process-count, and
ephemeral-workspace isolation.

The Express API additionally applies security headers, bounded JSON request
sizes, configurable production-origin enforcement, and separate rate limits for
general, authentication, execution, and verified-AI operations.

## 10. Architecture Principles

- Use JavaScript for the MERN application.
- Keep execution separate from the Express API.
- Keep language adapters separate from visualization.
- Reuse the same visualizers across languages.
- Keep SQL’s query model separate where necessary.
- Execute once and replay from trace states.
- Treat the execution engine as the source of truth.
- Let AI explain verified traces only.
- Do not claim unimplemented language support.
- Build and test one module at a time.
- Keep documentation concise and necessary.
