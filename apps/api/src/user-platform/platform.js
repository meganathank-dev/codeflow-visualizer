"use strict";

const express = require("express");

const {
  createIdentifier,
  createToken,
  hashPassword,
  hashToken,
  readBearerToken,
  readCookie,
  verifyPassword,
  verifyToken
} = require("../auth/security");

const REFRESH_COOKIE = "codeflow_refresh";
const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_RESET_SECONDS = 15 * 60;
const LANGUAGES = Object.freeze(["javascript", "python", "java", "sql"]);

class UserPlatformError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_USER_REQUEST") {
    super(message);
    this.name = "UserPlatformError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UserPlatformError("Request body must be a JSON object", 400, "INVALID_REQUEST_BODY");
  }
  return value;
}

function cleanString(value, field, { minimum = 0, maximum = 100 } = {}) {
  if (typeof value !== "string") {
    throw new UserPlatformError(`${field} must be a string`, 400, "INVALID_FIELD");
  }
  const cleaned = value.trim();
  if (cleaned.length < minimum || cleaned.length > maximum) {
    throw new UserPlatformError(
      `${field} must contain between ${minimum} and ${maximum} characters`,
      400,
      "INVALID_FIELD"
    );
  }
  return cleaned;
}

function normalizeEmail(value) {
  const email = cleanString(value, "Email", { minimum: 5, maximum: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserPlatformError("Enter a valid email address", 400, "INVALID_EMAIL");
  }
  return email;
}

function validatePassword(value) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 128 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/\d/.test(value)
  ) {
    throw new UserPlatformError(
      "Password must be 8–128 characters and include uppercase, lowercase, and a number",
      400,
      "WEAK_PASSWORD"
    );
  }
  return value;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function projectInput(body, partial = false) {
  requireObject(body);
  const result = {};

  if (!partial || Object.hasOwn(body, "title")) {
    result.title = cleanString(body.title, "Project title", { minimum: 1, maximum: 100 });
  }
  if (!partial || Object.hasOwn(body, "description")) {
    result.description = cleanString(body.description || "", "Project description", { maximum: 500 });
  }
  if (!partial || Object.hasOwn(body, "language")) {
    if (!LANGUAGES.includes(body.language)) {
      throw new UserPlatformError("Project language is not supported", 400, "INVALID_LANGUAGE");
    }
    result.language = body.language;
  }
  if (!partial || Object.hasOwn(body, "source")) {
    if (typeof body.source !== "string" || !body.source.trim()) {
      throw new UserPlatformError("Project source cannot be empty", 400, "INVALID_SOURCE");
    }
    if (Buffer.byteLength(body.source, "utf8") > 32 * 1024) {
      throw new UserPlatformError("Project source exceeds 32 KB", 413, "SOURCE_TOO_LARGE");
    }
    result.source = body.source;
  }

  if (partial && Object.keys(result).length === 0) {
    throw new UserPlatformError("Provide at least one project field to update", 400, "EMPTY_UPDATE");
  }
  return result;
}

function resourceId(value) {
  if (typeof value !== "string" || !/^(?:[a-f\d]{24}|[a-f\d-]{36})$/i.test(value)) {
    throw new UserPlatformError("Resource identifier is invalid", 400, "INVALID_RESOURCE_ID");
  }
  return value;
}

function createCookie(token, maximumAgeSeconds, secure) {
  const parts = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/auth",
    `Max-Age=${maximumAgeSeconds}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function createUserPlatform(options) {
  const repository = options.repository;
  const accessSecret = options.accessTokenSecret;
  const refreshSecret = options.refreshTokenSecret;
  const secureCookies = options.secureCookies === true;
  const exposePasswordResetToken = options.exposePasswordResetToken === true;
  const passwordResetDelivery = options.passwordResetDelivery || (async ({ user, token }) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`CodeFlow development password reset for ${user.email}: ${token}`);
    }
  });

  if (!repository) throw new TypeError("userRepository is required");
  if (typeof accessSecret !== "string" || accessSecret.length < 24) {
    throw new TypeError("accessTokenSecret must contain at least 24 characters");
  }
  if (typeof refreshSecret !== "string" || refreshSecret.length < 24) {
    throw new TypeError("refreshTokenSecret must contain at least 24 characters");
  }

  async function issueSession(user) {
    const sessionId = createIdentifier();
    const accessToken = createToken(
      { sub: user.id, type: "access", jti: sessionId },
      accessSecret,
      ACCESS_TOKEN_SECONDS
    );
    const refreshToken = createToken(
      { sub: user.id, type: "refresh", jti: sessionId },
      refreshSecret,
      REFRESH_TOKEN_SECONDS
    );
    await repository.saveSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_SECONDS * 1000).toISOString()
    });
    return { accessToken, refreshToken };
  }

  async function identify(request, required) {
    const token = readBearerToken(request);
    if (!token) {
      if (required) throw new UserPlatformError("Sign in to continue", 401, "AUTHENTICATION_REQUIRED");
      return null;
    }

    try {
      const payload = verifyToken(token, accessSecret, "access");
      const user = await repository.findUserById(payload.sub);
      if (!user) throw new Error("User does not exist");
      return user;
    } catch {
      throw new UserPlatformError("Access token is invalid or expired", 401, "INVALID_ACCESS_TOKEN");
    }
  }

  async function requireAuth(request, response, next) {
    try {
      request.authUser = await identify(request, true);
      next();
    } catch (error) {
      next(error);
    }
  }

  async function optionalAuth(request, response, next) {
    try {
      request.authUser = await identify(request, false);
      next();
    } catch (error) {
      next(error);
    }
  }

  async function recordExecution(user, input, result) {
    if (!user) return;
    const consoleItems = result.states?.at?.(-1)?.console || [];
    const outputPreview = consoleItems
      .map((item) => item.text)
      .filter(Boolean)
      .join("\n")
      .slice(0, 300);

    await repository.createHistory(user.id, {
      language: input.language,
      source: input.source,
      status: result.executionStatus || result.status || "unknown",
      eventCount: result.summary?.eventCount ?? result.trace?.events?.length ?? 0,
      durationMs: result.summary?.durationMs ?? null,
      outputPreview
    });
  }

  const router = express.Router();

  router.post("/auth/register", async (request, response, next) => {
    try {
      const body = requireObject(request.body);
      const name = cleanString(body.name, "Name", { minimum: 2, maximum: 80 });
      const email = normalizeEmail(body.email);
      const password = validatePassword(body.password);
      if (await repository.findUserByEmail(email)) {
        throw new UserPlatformError("An account already exists for this email", 409, "EMAIL_ALREADY_REGISTERED");
      }
      const user = await repository.createUser({ name, email, passwordHash: await hashPassword(password) });
      const session = await issueSession(user);
      response.setHeader("set-cookie", createCookie(session.refreshToken, REFRESH_TOKEN_SECONDS, secureCookies));
      response.status(201).json({ status: "ok", user: publicUser(user), accessToken: session.accessToken });
    } catch (error) { next(error); }
  });

  router.post("/auth/login", async (request, response, next) => {
    try {
      const body = requireObject(request.body);
      const email = normalizeEmail(body.email);
      const password = typeof body.password === "string" ? body.password : "";
      const user = await repository.findUserByEmail(email);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw new UserPlatformError("Email or password is incorrect", 401, "INVALID_CREDENTIALS");
      }
      const session = await issueSession(user);
      response.setHeader("set-cookie", createCookie(session.refreshToken, REFRESH_TOKEN_SECONDS, secureCookies));
      response.json({ status: "ok", user: publicUser(user), accessToken: session.accessToken });
    } catch (error) { next(error); }
  });

  router.post("/auth/forgot-password", async (request, response, next) => {
    try {
      const body = requireObject(request.body);
      const email = normalizeEmail(body.email);
      const user = await repository.findUserByEmail(email);
      let developmentResetToken;

      if (user) {
        await repository.deletePasswordResetsForUser(user.id);
        const resetId = createIdentifier();
        const resetToken = `${resetId}.${createIdentifier().replaceAll("-", "")}`;
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_SECONDS * 1000).toISOString();
        await repository.savePasswordReset({
          id: resetId,
          userId: user.id,
          tokenHash: hashToken(resetToken),
          expiresAt
        });
        await passwordResetDelivery({ user: publicUser(user), token: resetToken, expiresAt });
        if (exposePasswordResetToken) developmentResetToken = resetToken;
      }

      response.status(202).json({
        status: "ok",
        message: "If an account exists for that email, a password-reset instruction has been created.",
        ...(developmentResetToken ? { developmentResetToken } : {})
      });
    } catch (error) { next(error); }
  });

  router.post("/auth/reset-password", async (request, response, next) => {
    try {
      const body = requireObject(request.body);
      const token = cleanString(body.token, "Reset token", { minimum: 20, maximum: 200 });
      const password = validatePassword(body.password);
      const resetId = token.split(".")[0];
      const reset = await repository.findPasswordReset(resetId);

      if (
        !reset ||
        reset.tokenHash !== hashToken(token) ||
        new Date(reset.expiresAt).getTime() <= Date.now()
      ) {
        if (reset) await repository.deletePasswordReset(reset.id);
        throw new UserPlatformError("Reset link is invalid or expired", 400, "INVALID_PASSWORD_RESET");
      }

      const user = await repository.updateUser(reset.userId, { passwordHash: await hashPassword(password) });
      if (!user) throw new UserPlatformError("Account no longer exists", 404, "ACCOUNT_NOT_FOUND");
      await repository.deletePasswordResetsForUser(user.id);
      await repository.deleteSessionsForUser(user.id);
      response.setHeader("set-cookie", createCookie("", 0, secureCookies));
      response.json({ status: "ok", message: "Password updated. Sign in with the new password." });
    } catch (error) { next(error); }
  });

  router.post("/auth/refresh", async (request, response, next) => {
    try {
      const refreshToken = readCookie(request, REFRESH_COOKIE);
      if (!refreshToken) throw new UserPlatformError("No active session was found", 401, "SESSION_REQUIRED");
      let payload;
      try { payload = verifyToken(refreshToken, refreshSecret, "refresh"); }
      catch { throw new UserPlatformError("Session is invalid or expired", 401, "INVALID_SESSION"); }
      const session = await repository.findSession(payload.jti);
      if (!session || session.userId !== payload.sub || session.tokenHash !== hashToken(refreshToken)) {
        throw new UserPlatformError("Session is no longer active", 401, "INVALID_SESSION");
      }
      await repository.deleteSession(payload.jti);
      const user = await repository.findUserById(payload.sub);
      if (!user) throw new UserPlatformError("Account no longer exists", 401, "INVALID_SESSION");
      const replacement = await issueSession(user);
      response.setHeader("set-cookie", createCookie(replacement.refreshToken, REFRESH_TOKEN_SECONDS, secureCookies));
      response.json({ status: "ok", user: publicUser(user), accessToken: replacement.accessToken });
    } catch (error) { next(error); }
  });

  router.post("/auth/logout", async (request, response, next) => {
    try {
      const refreshToken = readCookie(request, REFRESH_COOKIE);
      if (refreshToken) {
        try {
          const payload = verifyToken(refreshToken, refreshSecret, "refresh");
          await repository.deleteSession(payload.jti);
        } catch { /* Expired and malformed sessions are already unusable. */ }
      }
      response.setHeader("set-cookie", createCookie("", 0, secureCookies));
      response.json({ status: "ok" });
    } catch (error) { next(error); }
  });

  router.get("/auth/me", requireAuth, (request, response) => {
    response.json({ status: "ok", user: publicUser(request.authUser) });
  });

  router.patch("/profile", requireAuth, async (request, response, next) => {
    try {
      const body = requireObject(request.body);
      const updates = {};
      if (Object.hasOwn(body, "name")) updates.name = cleanString(body.name, "Name", { minimum: 2, maximum: 80 });
      if (Object.hasOwn(body, "bio")) updates.bio = cleanString(body.bio || "", "Bio", { maximum: 240 });
      if (Object.keys(updates).length === 0) throw new UserPlatformError("No profile changes were provided", 400, "EMPTY_UPDATE");
      const user = await repository.updateUser(request.authUser.id, updates);
      response.json({ status: "ok", user: publicUser(user) });
    } catch (error) { next(error); }
  });

  router.get("/projects", requireAuth, async (request, response, next) => {
    try { response.json({ status: "ok", projects: await repository.listProjects(request.authUser.id) }); }
    catch (error) { next(error); }
  });

  router.post("/projects", requireAuth, async (request, response, next) => {
    try {
      const project = await repository.createProject(request.authUser.id, projectInput(request.body));
      response.status(201).json({ status: "ok", project });
    } catch (error) { next(error); }
  });

  router.get("/projects/:projectId", requireAuth, async (request, response, next) => {
    try {
      const project = await repository.findProject(request.authUser.id, resourceId(request.params.projectId));
      if (!project) throw new UserPlatformError("Project was not found", 404, "PROJECT_NOT_FOUND");
      response.json({ status: "ok", project });
    } catch (error) { next(error); }
  });

  router.patch("/projects/:projectId", requireAuth, async (request, response, next) => {
    try {
      const project = await repository.updateProject(
        request.authUser.id,
        resourceId(request.params.projectId),
        projectInput(request.body, true)
      );
      if (!project) throw new UserPlatformError("Project was not found", 404, "PROJECT_NOT_FOUND");
      response.json({ status: "ok", project });
    } catch (error) { next(error); }
  });

  router.post("/projects/:projectId/duplicate", requireAuth, async (request, response, next) => {
    try {
      const existing = await repository.findProject(request.authUser.id, resourceId(request.params.projectId));
      if (!existing) throw new UserPlatformError("Project was not found", 404, "PROJECT_NOT_FOUND");
      const project = await repository.createProject(request.authUser.id, {
        title: `${existing.title} copy`.slice(0, 100),
        description: existing.description,
        language: existing.language,
        source: existing.source
      });
      response.status(201).json({ status: "ok", project });
    } catch (error) { next(error); }
  });

  router.delete("/projects/:projectId", requireAuth, async (request, response, next) => {
    try {
      const deleted = await repository.deleteProject(request.authUser.id, resourceId(request.params.projectId));
      if (!deleted) throw new UserPlatformError("Project was not found", 404, "PROJECT_NOT_FOUND");
      response.status(204).end();
    } catch (error) { next(error); }
  });

  router.get("/history", requireAuth, async (request, response, next) => {
    try {
      const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 25));
      response.json({ status: "ok", history: await repository.listHistory(request.authUser.id, limit) });
    } catch (error) { next(error); }
  });

  router.delete("/history", requireAuth, async (request, response, next) => {
    try {
      await repository.clearHistory(request.authUser.id);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  router.get("/dashboard", requireAuth, async (request, response, next) => {
    try {
      response.json({ status: "ok", dashboard: await repository.getDashboard(request.authUser.id) });
    } catch (error) { next(error); }
  });

  return { router, optionalAuth, requireAuth, recordExecution, repository };
}

module.exports = {
  ACCESS_TOKEN_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_SECONDS,
  PASSWORD_RESET_SECONDS,
  UserPlatformError,
  createUserPlatform,
  publicUser
};
