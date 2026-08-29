# Final release checklist

## Automated acceptance

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] CI passes on Node 22, Python 3.12 and Java 21
- [ ] `pnpm release:check` passes with production environment values

## Learning workflow

- [ ] Run, pause, resume, reset and replay each supported language
- [ ] Complete sequential program input in JavaScript, Python and Java
- [ ] Open Practice Lab and filter by difficulty and language
- [ ] Run a public practice test without signing in
- [ ] Submit while signed in and verify saved progress/history
- [ ] Confirm hidden cases expose no input, expected output, actual output or trace
- [ ] Load a public practice trace into the visualizer
- [ ] Verify Compact and Presentation modes at desktop and mobile widths
- [ ] Verify keyboard access for language, speed and practice dropdowns

## Production safety

- [ ] HTTPS and approved `WEB_ORIGIN` are enforced
- [ ] MongoDB backup/restore is tested
- [ ] Access, refresh and webhook secrets are different and stored securely
- [ ] Password-reset delivery is tested end to end
- [ ] Execution health confirms all six isolation capabilities
- [ ] A production execution is rejected when sandbox attestation is removed
- [ ] Rate-limit, 4xx, 5xx, latency and execution-timeout alerts are configured
- [ ] Request IDs are visible across proxy, API and execution logs
- [ ] Rollback images and owner are recorded
