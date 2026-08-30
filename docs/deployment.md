# Production deployment

CodeFlow has two deployment boundaries: the web/API control plane and the
untrusted-code execution plane. The included Compose file deploys only the
control plane. It intentionally does not turn the local development runner into
a public sandbox.

## Required execution boundary

`EXECUTION_SERVICE_URL` must point to a separately isolated runner whose health
response confirms `productionSandboxAvailable` and `acceptsUntrustedCode`.
CodeFlow's API checks those capabilities before every production execution and
returns `PRODUCTION_SANDBOX_NOT_READY` when they are absent.

The runner must independently enforce network and filesystem isolation, memory,
CPU and process limits, and an ephemeral workspace. The local service fails
closed when started with `NODE_ENV=production` without these capabilities.

For a limited portfolio demonstration, the execution service can instead run
with `EXECUTION_RESTRICTED_DEMO=true` and a 32+ character
`EXECUTION_SERVICE_SECRET`. Configure the same secret on the API and set
`EXECUTION_ALLOW_RESTRICTED_DEMO=true`. This authenticates the runner and keeps
the public API rate limits in the request path, but it is not a substitute for
the independently isolated production sandbox described above.

## Control-plane deployment

1. Copy `deploy/production.env.example` to `deploy/production.env`.
2. Replace every placeholder and configure the isolated execution URL.
3. Configure an HTTPS password-reset webhook and reset page URL.
4. Run `pnpm release:check` with the same environment.
5. Run `docker compose -f deploy/docker-compose.control-plane.yml up --build`.
6. Terminate TLS at the hosting load balancer or reverse proxy and expose only
   the web service publicly.

The API emits an `X-Request-Id` response header. With
`CODEFLOW_STRUCTURED_LOGS=true`, it also writes one JSON request record containing
the request ID, method, path, status and duration. Never log source code, tokens,
passwords, hidden tests, or program input.

## Password-reset webhook contract

CodeFlow sends a signed Bearer request containing the event name, recipient,
expiry and reset URL. The provider must authenticate the webhook, deliver the
message, and return a successful HTTP status. Production startup refuses to run
without this delivery configuration.

## Rollback

Keep the previous immutable web/API image tags and a database backup. Roll back
the control-plane images together. Practice submissions and user projects use
additive collections, so Phase 12 does not require a destructive migration.
