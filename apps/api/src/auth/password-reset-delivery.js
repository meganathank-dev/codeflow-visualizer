"use strict";

const crypto = require("node:crypto");
const tls = require("node:tls");

const MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";
const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;
const SMTP_TIMEOUT_MS = 15_000;

function validateEmailAddress(value, label) {
  const email = String(value || "").trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new TypeError(`${label} must be a valid email address`);
  }
  return email;
}

function createResetUrl(resetPageUrl, token) {
  if (!resetPageUrl) {
    throw new TypeError("PASSWORD_RESET_PAGE_URL is required for email delivery");
  }
  const url = new URL(resetPageUrl);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new TypeError("PASSWORD_RESET_PAGE_URL must use HTTPS");
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createSmtpResponseReader(socket) {
  let buffer = "";
  let lines = [];
  const queued = [];
  const waiting = [];
  let terminalError = null;

  function settle(response) {
    const waiter = waiting.shift();
    if (waiter) waiter.resolve(response);
    else queued.push(response);
  }

  function fail(error) {
    terminalError = error;
    while (waiting.length) waiting.shift().reject(error);
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const completeLines = buffer.split("\r\n");
    buffer = completeLines.pop();

    for (const line of completeLines) {
      if (!line) continue;
      lines.push(line);
      const match = line.match(/^(\d{3}) ([\s\S]*)$/);
      if (!match) continue;
      settle({
        code: Number(match[1]),
        message: lines.join("\n")
      });
      lines = [];
    }
  });
  socket.once("error", fail);
  socket.once("end", () => fail(new Error("SMTP connection closed unexpectedly")));
  socket.setTimeout(SMTP_TIMEOUT_MS, () => {
    fail(new Error("SMTP connection timed out"));
    socket.destroy();
  });

  return function readResponse() {
    if (queued.length) return Promise.resolve(queued.shift());
    if (terminalError) return Promise.reject(terminalError);
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  };
}

function expectSmtpCode(response, allowedCodes, stage) {
  if (!allowedCodes.includes(response.code)) {
    throw new Error(`Password-reset email failed during ${stage} (SMTP ${response.code})`);
  }
}

function writeSmtpCommand(socket, command) {
  return new Promise((resolve, reject) => {
    socket.write(`${command}\r\n`, (error) => error ? reject(error) : resolve());
  });
}

async function sendSmtpMessage(options) {
  const socket = tls.connect({
    host: options.host,
    port: options.port,
    servername: options.host,
    rejectUnauthorized: true
  });
  const readResponse = createSmtpResponseReader(socket);

  try {
    await new Promise((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });

    expectSmtpCode(await readResponse(), [220], "connection");

    await writeSmtpCommand(socket, "EHLO codeflow-visualizer");
    expectSmtpCode(await readResponse(), [250], "greeting");

    await writeSmtpCommand(socket, "AUTH LOGIN");
    expectSmtpCode(await readResponse(), [334], "authentication");

    await writeSmtpCommand(socket, Buffer.from(options.username).toString("base64"));
    expectSmtpCode(await readResponse(), [334], "authentication");

    await writeSmtpCommand(socket, Buffer.from(options.password).toString("base64"));
    expectSmtpCode(await readResponse(), [235], "authentication");

    await writeSmtpCommand(socket, `MAIL FROM:<${options.fromAddress}>`);
    expectSmtpCode(await readResponse(), [250], "sender validation");

    await writeSmtpCommand(socket, `RCPT TO:<${options.toAddress}>`);
    expectSmtpCode(await readResponse(), [250, 251], "recipient validation");

    await writeSmtpCommand(socket, "DATA");
    expectSmtpCode(await readResponse(), [354], "message preparation");

    const dotStuffedMessage = options.message
      .replace(/\r?\n/g, "\r\n")
      .replace(/^\./gm, "..");

    await writeSmtpCommand(socket, `${dotStuffedMessage}\r\n.`);
    expectSmtpCode(await readResponse(), [250], "message delivery");

    await writeSmtpCommand(socket, "QUIT");
    await readResponse().catch(() => null);
  } finally {
    socket.destroy();
  }
}

function buildPasswordResetMessage({ fromAddress, fromName, user, resetUrl, expiresAt }) {
  const safeName = escapeHtml(user.name || "CodeFlow user");
  const safeUrl = escapeHtml(resetUrl);
  const expiry = new Date(expiresAt).toUTCString();
  const boundary = `codeflow-${crypto.randomBytes(12).toString("hex")}`;
  const messageId = `<${crypto.randomUUID()}@codeflow-visualizer>`;

  const text = [
    `Hello ${user.name || "CodeFlow user"},`,
    "",
    "We received a request to reset your CodeFlow Visualizer password.",
    `Open this secure link: ${resetUrl}`,
    "",
    `This one-time link expires at ${expiry}.`,
    "If you did not request this change, you can safely ignore this email."
  ].join("\r\n");

  const html = [
    `<p>Hello ${safeName},</p>`,
    "<p>We received a request to reset your CodeFlow Visualizer password.</p>",
    `<p><a href="${safeUrl}">Reset your password</a></p>`,
    `<p>This one-time link expires at ${escapeHtml(expiry)}.</p>`,
    "<p>If you did not request this change, you can safely ignore this email.</p>"
  ].join("");

  return [
    `From: ${fromName} <${fromAddress}>`,
    `To: ${user.email}`,
    "Subject: Reset your CodeFlow Visualizer password",
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`
  ].join("\r\n");
}

function createPasswordResetMailjetDelivery(options = {}) {
  const apiKey = String(options.apiKey || "").trim();
  const secretKey = String(options.secretKey || "").trim();
  if (!apiKey && !secretKey) return null;
  if (!apiKey || !secretKey) {
    throw new TypeError("Both PASSWORD_RESET_MAILJET_API_KEY and PASSWORD_RESET_MAILJET_SECRET_KEY are required");
  }

  const fromAddress = validateEmailAddress(options.fromAddress, "PASSWORD_RESET_FROM_ADDRESS");
  const fromName = String(options.fromName || "CodeFlow Visualizer").replace(/[\r\n]/g, " ").trim();
  const fetchImplementation = options.fetchImplementation || fetch;

  return async function deliverPasswordReset({ user, token, expiresAt }) {
    const toAddress = validateEmailAddress(user.email, "Password-reset recipient");
    const resetUrl = createResetUrl(options.resetPageUrl, token);
    const recipientName = String(user.name || "CodeFlow user");
    const expiry = new Date(expiresAt).toUTCString();
    const text = [
      `Hello ${recipientName},`,
      "",
      "We received a request to reset your CodeFlow Visualizer password.",
      `Open this secure link: ${resetUrl}`,
      "",
      `This one-time link expires at ${expiry}.`,
      "If you did not request this change, you can safely ignore this email."
    ].join("\n");
    const html = [
      `<p>Hello ${escapeHtml(recipientName)},</p>`,
      "<p>We received a request to reset your CodeFlow Visualizer password.</p>",
      `<p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>`,
      `<p>This one-time link expires at ${escapeHtml(expiry)}.</p>`,
      "<p>If you did not request this change, you can safely ignore this email.</p>"
    ].join("");

    const response = await fetchImplementation(MAILJET_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: fromAddress, Name: fromName },
          To: [{ Email: toAddress, Name: recipientName }],
          Subject: "Reset your CodeFlow Visualizer password",
          TextPart: text,
          HTMLPart: html
        }]
      }),
      signal: AbortSignal.timeout(15_000)
    });

    const result = await response.json().catch(() => null);
    const message = result?.Messages?.[0];
    if (!response.ok || message?.Status !== "success") {
      const providerError = message?.Errors?.[0]?.ErrorMessage;
      throw new Error(providerError || "Mailjet rejected the password-reset email");
    }
  };
}

function createPasswordResetSmtpDelivery(options = {}) {
  const username = String(options.username || "").trim();
  const password = String(options.password || "").replaceAll(" ", "");
  if (!username && !password) return null;
  if (!username || !password) {
    throw new TypeError("Both PASSWORD_RESET_SMTP_USER and PASSWORD_RESET_SMTP_APP_PASSWORD are required");
  }

  const fromAddress = validateEmailAddress(options.fromAddress || username, "PASSWORD_RESET_FROM_ADDRESS");
  const fromName = String(options.fromName || "CodeFlow Visualizer").replace(/[\r\n]/g, " ").trim();
  const host = String(options.host || DEFAULT_SMTP_HOST).trim();
  const port = Number(options.port || DEFAULT_SMTP_PORT);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError("Password-reset SMTP host or port is invalid");
  }

  return async function deliverPasswordReset({ user, token, expiresAt }) {
    const toAddress = validateEmailAddress(user.email, "Password-reset recipient");
    const resetUrl = createResetUrl(options.resetPageUrl, token);
    const message = buildPasswordResetMessage({
      fromAddress,
      fromName,
      user: { ...user, email: toAddress },
      resetUrl,
      expiresAt
    });

    await (options.sendMailImplementation || sendSmtpMessage)({
      host,
      port,
      username,
      password,
      fromAddress,
      toAddress,
      message
    });
  };
}

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
    const resetUrl = resetPageUrl ? createResetUrl(resetPageUrl, token) : undefined;
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
        resetUrl,
        token: resetUrl ? undefined : token
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("Password-reset delivery provider rejected the request");
  };
}

module.exports = {
  createPasswordResetMailjetDelivery,
  createPasswordResetSmtpDelivery,
  createPasswordResetWebhookDelivery
};
