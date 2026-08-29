"use strict";

function createPasswordResetWebhookDelivery(options = {}) {
  const webhookUrl = options.webhookUrl;
  const webhookSecret = options.webhookSecret;
  const fetchImplementation = options.fetchImplementation || fetch;
  const resetPageUrl = options.resetPageUrl;

  if (!webhookUrl) return null;
  if (!/^https:\/\//i.test(webhookUrl)) throw new TypeError("PASSWORD_RESET_WEBHOOK_URL must use HTTPS");
  if (typeof webhookSecret !== "string" || webhookSecret.length < 24) {
    throw new TypeError("PASSWORD_RESET_WEBHOOK_SECRET must contain at least 24 characters");
  }

  return async function deliverPasswordReset({ user, token, expiresAt }) {
    const separator = resetPageUrl?.includes("?") ? "&" : "?";
    const response = await fetchImplementation(webhookUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${webhookSecret}`
      },
      body: JSON.stringify({
        event: "codeflow.password_reset.requested",
        recipient: { name: user.name, email: user.email },
        expiresAt,
        resetUrl: resetPageUrl
          ? `${resetPageUrl}${separator}token=${encodeURIComponent(token)}`
          : undefined,
        token: resetPageUrl ? undefined : token
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("Password-reset delivery provider rejected the request");
  };
}

module.exports = { createPasswordResetWebhookDelivery };
