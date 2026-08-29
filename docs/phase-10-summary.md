# Phase 10 — AI Features, Feedback Integration and Reliability Refinement

Phase 10 turns verified execution data into a readable learning workflow while
preserving CodeFlow's core rule: AI may explain a real trace, but it may not
decide what the program executed.

## Learning views

- **Full trace** displays every event in strict `1..N` order and lets the learner
  jump directly to any recorded state.
- **Explain** creates a separate explanation for every source line. Loop headers,
  statements, output calls, blank/comment lines, and closing braces remain
  separate entries.
- Executed lines link back to their verified event numbers.

## Verified AI boundary

Successful executions are registered server-side for 20 minutes and receive an
opaque verification identifier. `/api/ai/explain` accepts only that identifier,
an explanation mode, and the selected event number. The server—not the browser—
supplies the corresponding source and verified trace context.

Supported modes are program explanation, current-step explanation, error
explanation, debugging suggestions, complexity analysis, and tutor questions.
Without `OPENAI_API_KEY`, the deterministic local trace engine remains available.
With a key, the API uses the configured Responses API model and explicitly treats
source code and questions as untrusted data.

## Reliability refinement

- Browser startup waits before its first health probe, avoiding the API proxy
  race that occurred while `pnpm dev` started services in parallel.
- A run waits through bounded readiness retries when the API or execution service
  is still starting.
- Java's stable debugger and teaching-algorithm helpers compile once into a
  content-addressed temporary cache; later runs compile only the learner source.
- Execution budgets are 20 seconds for JavaScript and SQL, 25 seconds for Python,
  40 seconds for Java, and 50 seconds at the API boundary.
- The header reports startup/compile/trace stages and elapsed time.
- The primary button becomes **Cancel run** during execution and aborts safely.
- Timeout and service errors provide specific recovery guidance.

## Account feedback integration

The sign-in view now includes **Forgot password?**, the registration view includes
**Already have an account?**, and both flows link back to one another. Password
reset tokens expire after 15 minutes, are stored only as SHA-256 hashes, work once,
and invalidate all existing refresh sessions after a successful reset.

The development dialog can receive the token directly. Production deployment
must connect `passwordResetDelivery` to an email provider and keep token exposure
disabled.

## Acceptance coverage

Regression tests cover all six explanation modes, rejection of expired or unknown
trace identifiers, exact numbered traces, per-line brace explanations, readiness
retry behavior, friendly timeout guidance, password reset and token reuse, API
reliability metadata, and the existing multi-language visualization suite.
