"use strict";

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

const TOKEN_ISSUER = "codeflow-api";
const TOKEN_AUDIENCE = "codeflow-web";

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);

  return `scrypt:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, saltValue, expectedValue] = String(storedHash).split(":");

  if (algorithm !== "scrypt" || !saltValue || !expectedValue) {
    return false;
  }

  const expected = Buffer.from(expectedValue, "base64url");
  const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createToken(payload, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson({
    ...payload,
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + expiresInSeconds
  });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret, expectedType) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actualSignature = Buffer.from(parts[2], "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error("Invalid token signature");
  }

  const payload = decodeJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);

  if (
    payload.iss !== TOKEN_ISSUER ||
    payload.aud !== TOKEN_AUDIENCE ||
    payload.exp <= now ||
    payload.type !== expectedType ||
    typeof payload.sub !== "string"
  ) {
    throw new Error("Token is invalid or expired");
  }

  return payload;
}

function createIdentifier() {
  return crypto.randomUUID();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readBearerToken(request) {
  const value = request.headers.authorization;

  if (typeof value !== "string" || !value.startsWith("Bearer ")) {
    return null;
  }

  return value.slice("Bearer ".length).trim() || null;
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

module.exports = {
  createIdentifier,
  createToken,
  hashPassword,
  hashToken,
  readBearerToken,
  readCookie,
  verifyPassword,
  verifyToken
};
