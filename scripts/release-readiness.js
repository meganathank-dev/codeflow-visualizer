"use strict";

const PLACEHOLDER = /(?:replace|change-me|your-api-key|example|placeholder)/i;

function validSecret(value, minimum = 32) {
  return typeof value === "string" && value.length >= minimum && !PLACEHOLDER.test(value);
}

function evaluateReleaseReadiness(environment = process.env) {
  const checks = [
    { id: "production-mode", ok: environment.NODE_ENV === "production", message: "NODE_ENV must be production." },
    { id: "mongodb", ok: /^mongodb(?:\+srv)?:\/\//.test(environment.MONGODB_URI || ""), message: "MONGODB_URI must be configured." },
    { id: "access-secret", ok: validSecret(environment.ACCESS_TOKEN_SECRET), message: "ACCESS_TOKEN_SECRET must be a non-placeholder value of 32+ characters." },
    { id: "refresh-secret", ok: validSecret(environment.REFRESH_TOKEN_SECRET), message: "REFRESH_TOKEN_SECRET must be a non-placeholder value of 32+ characters." },
    { id: "separate-secrets", ok: Boolean(environment.ACCESS_TOKEN_SECRET) && environment.ACCESS_TOKEN_SECRET !== environment.REFRESH_TOKEN_SECRET, message: "Access and refresh secrets must be different." },
    { id: "https-origin", ok: /^https:\/\//.test(environment.WEB_ORIGIN || ""), message: "WEB_ORIGIN must be an HTTPS origin." },
    { id: "execution-service", ok: /^https?:\/\//.test(environment.EXECUTION_SERVICE_URL || ""), message: "EXECUTION_SERVICE_URL must target the isolated execution service." },
    { id: "password-reset-webhook", ok: /^https:\/\//.test(environment.PASSWORD_RESET_WEBHOOK_URL || ""), message: "An HTTPS password-reset delivery webhook is required." },
    { id: "password-reset-secret", ok: validSecret(environment.PASSWORD_RESET_WEBHOOK_SECRET, 24), message: "PASSWORD_RESET_WEBHOOK_SECRET must contain 24+ non-placeholder characters." },
    { id: "structured-logs", ok: environment.CODEFLOW_STRUCTURED_LOGS === "true", message: "CODEFLOW_STRUCTURED_LOGS must be true." }
  ];
  const failures = checks.filter((check) => !check.ok);
  return { ready: failures.length === 0, checks, failures };
}

if (require.main === module) {
  const result = evaluateReleaseReadiness();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ready) process.exitCode = 1;
}

module.exports = { evaluateReleaseReadiness, validSecret };
