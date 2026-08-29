"use strict";

const assert = require("node:assert/strict");
const { evaluateReleaseReadiness, validSecret } = require("./release-readiness");
const { createPasswordResetWebhookDelivery } = require("../apps/api/src/auth/password-reset-delivery");
const { REQUEST_ID_PATTERN } = require("../apps/api/src/observability/request-observability");

const productionEnvironment = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb+srv://database.example/codeflow",
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  WEB_ORIGIN: "https://codeflow.example",
  EXECUTION_SERVICE_URL: "http://isolated-execution:4100",
  PASSWORD_RESET_WEBHOOK_URL: "https://mailer.example/reset",
  PASSWORD_RESET_WEBHOOK_SECRET: "c".repeat(32),
  CODEFLOW_STRUCTURED_LOGS: "true"
};

assert.equal(evaluateReleaseReadiness(productionEnvironment).ready, true);
assert.equal(evaluateReleaseReadiness({ ...productionEnvironment, WEB_ORIGIN: "http://codeflow.example" }).ready, false);
assert.equal(evaluateReleaseReadiness({ ...productionEnvironment, ACCESS_TOKEN_SECRET: "replace-me" }).ready, false);
assert.equal(validSecret("your-api-key"), false);
assert.equal(REQUEST_ID_PATTERN.test("request-12345678"), true);
assert.throws(
  () => createPasswordResetWebhookDelivery({ webhookUrl: "http://mailer.example", webhookSecret: "c".repeat(32) }),
  /HTTPS/
);

async function runTests() {
  let deliveryRequest;
  const delivery = createPasswordResetWebhookDelivery({
    webhookUrl: "https://mailer.example/reset",
    webhookSecret: "c".repeat(32),
    resetPageUrl: "https://codeflow.example/reset",
    fetchImplementation: async (url, options) => {
      deliveryRequest = { url, options };
      return { ok: true };
    }
  });
  await delivery({
    user: { name: "Learner", email: "learner@example.com" },
    token: "safe-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  assert.equal(deliveryRequest.url, "https://mailer.example/reset");
  assert.match(JSON.parse(deliveryRequest.options.body).resetUrl, /token=safe-token/);

  console.log("Final Phase 12 release-readiness tests passed.");
  console.log("Production configuration gate: passed");
  console.log("Request observability contract: passed");
  console.log("Password-reset webhook delivery contract: passed");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
