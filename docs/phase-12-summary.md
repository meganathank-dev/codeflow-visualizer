# Final Phase 12 — Practice Platform and Production Closure

Phase 12 is CodeFlow Visualizer's final planned development phase. It combines
the practice-platform work, remaining feedback refinements, deployment controls,
observability, CI and release acceptance in one closure milestone.

## Integrated Practice Lab

Practice Lab is part of the existing execution workspace rather than a separate
product. Its first curated catalog contains Easy and Medium challenges across
JavaScript, Python, Java and SQL. Learners can filter challenges, read constraints,
edit starter code in Monaco and run public tests without an account.

Signed-in learners can submit solutions, keep submission history and track solved
problem progress. Judging reuses the real execution service and standardized
trace. Public test executions can be opened directly in the visualizer, so a
failed solution can be inspected event by event using the same variables,
call-stack, console, timeline and explanation tools.

Hidden tests remain server-side. Responses reveal only a hidden test label,
pass/fail verdict and a generic runtime message when necessary; they never expose
hidden input, expected output, actual output, source fixtures or traces.

## Production safety and delivery

Production API execution now performs a capability check against the execution
service before forwarding code. Both normal execution and Practice Lab judging
fail with `PRODUCTION_SANDBOX_NOT_READY` unless health confirms an isolated
production sandbox that accepts untrusted code. This complements the execution
service's existing fail-closed startup gate.

Production password recovery uses an authenticated HTTPS webhook delivery
contract. Development can still expose its local reset token, while production
startup requires the webhook and never includes the token in the forgot-password
API response.

The included control-plane deployment templates build the React web app, Express
API and MongoDB. The untrusted execution plane is deliberately external and must
be provided by an infrastructure sandbox enforcing network, filesystem, memory,
CPU, process and ephemeral-workspace isolation.

## Observability and operations

Every API response receives an `X-Request-Id`. Optional structured JSON logs
record only safe request metadata: service, request ID, method, path, status and
duration. A release-readiness command validates production mode, database,
distinct secrets, HTTPS origin, execution URL, password-reset delivery and
structured logging without printing secret values.

CI installs the exact pnpm lockfile and runs the complete trace, reconstruction,
execution, API, user, AI, practice, frontend, conformance and release suites,
then builds the production frontend.

## Final acceptance boundary

The product is complete at the application layer when every automated suite and
manual checklist item passes. Public hosting of code execution remains gated on
real sandbox infrastructure; configuration values alone do not attest isolation.
See `deployment.md` and `release-checklist.md` for the deployment and handoff
contracts.
