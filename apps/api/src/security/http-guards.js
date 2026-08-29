"use strict";

function createApiSecurityHeaders() {
  return function apiSecurityHeaders(request, response, next) {
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("cross-origin-resource-policy", "same-site");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    next();
  };
}

function normalizeOrigins(values = []) {
  return new Set(
    values
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  );
}

function createOriginGuard({ allowedOrigins = [], enforce = false } = {}) {
  const normalizedOrigins = normalizeOrigins(allowedOrigins);

  return function originGuard(request, response, next) {
    const origin = request.get("origin");

    if (!origin) {
      next();
      return;
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");
    if (!normalizedOrigins.has(normalizedOrigin)) {
      if (!enforce) {
        next();
        return;
      }

      const error = new Error("Request origin is not permitted");
      error.statusCode = 403;
      error.code = "ORIGIN_NOT_ALLOWED";
      next(error);
      return;
    }

    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("access-control-allow-headers", "content-type, authorization");
    response.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.append("vary", "Origin");

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
  };
}

function createRateLimiter({
  windowMs,
  maximumRequests,
  code = "RATE_LIMIT_EXCEEDED",
  message = "Too many requests. Wait briefly and try again.",
  clock = Date.now
}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new TypeError("windowMs must be positive");
  if (!Number.isInteger(maximumRequests) || maximumRequests < 1) {
    throw new TypeError("maximumRequests must be positive");
  }

  const clients = new Map();

  return function rateLimiter(request, response, next) {
    const now = clock();
    const key = request.ip || request.socket?.remoteAddress || "unknown";
    let entry = clients.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(maximumRequests - entry.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1_000), 1);

    response.setHeader("ratelimit-limit", String(maximumRequests));
    response.setHeader("ratelimit-remaining", String(remaining));
    response.setHeader("ratelimit-reset", String(retryAfterSeconds));

    if (entry.count > maximumRequests) {
      response.setHeader("retry-after", String(retryAfterSeconds));
      const error = new Error(message);
      error.statusCode = 429;
      error.code = code;
      next(error);
      return;
    }

    if (clients.size > 2_000) {
      for (const [clientKey, clientEntry] of clients) {
        if (clientEntry.resetAt <= now) clients.delete(clientKey);
      }
    }

    next();
  };
}

module.exports = {
  createApiSecurityHeaders,
  createOriginGuard,
  createRateLimiter,
  normalizeOrigins
};
