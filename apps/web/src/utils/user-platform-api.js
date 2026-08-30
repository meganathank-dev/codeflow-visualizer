import { readJsonResponse } from "./http-response.js";

let accessToken = null;
let apiWarmupPromise = null;

const TRANSIENT_AUTH_STATUSES = new Set([502, 503, 504]);

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function isTransientAuthError(error) {
  return error?.name === "TypeError" || TRANSIENT_AUTH_STATUSES.has(error?.status);
}

export async function warmUserPlatformApi({ force = false } = {}) {
  if (apiWarmupPromise && !force) return apiWarmupPromise;

  const request = (async () => {
    try {
      // Any HTTP response means the API process has answered. A 502 can still
      // describe the separate execution service while authentication is ready.
      await fetch("/api/health", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" }
      });
      return true;
    } catch {
      return false;
    }
  })();

  apiWarmupPromise = request;

  try {
    return await request;
  } finally {
    if (apiWarmupPromise === request) apiWarmupPromise = null;
  }
}

function authorizationHeaders() {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

async function parseResponse(response, label) {
  if (response.status === 204) return null;
  const result = await readJsonResponse(response, label);
  if (!response.ok || result.status !== "ok") {
    const error = new Error(result.error?.message || `${label} failed.`);
    error.status = response.status;
    error.code = result.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return result;
}

async function performFetch(pathname, options = {}) {
  return fetch(pathname, {
    ...options,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...authorizationHeaders(),
      ...options.headers
    }
  });
}

async function request(pathname, options = {}, retry = true) {
  const response = await performFetch(pathname, options);

  if (response.status === 401 && retry && accessToken && !pathname.startsWith("/api/auth/")) {
    const restored = await restoreUserSession();
    if (restored) return request(pathname, options, false);
  }

  return parseResponse(response, "User platform");
}

export async function fetchWithUserSession(pathname, options = {}) {
  let response = await performFetch(pathname, options);

  if (response.status === 401 && accessToken) {
    const restored = await restoreUserSession();
    if (restored) response = await performFetch(pathname, options);
  }

  return response;
}

export function getUserAuthorizationHeaders() {
  return authorizationHeaders();
}

export function clearUserSession() {
  accessToken = null;
}

export async function restoreUserSession() {
  try {
    const result = await request("/api/auth/refresh", {
      method: "POST",
      body: "{}"
    }, false);
    accessToken = result.accessToken;
    return result.user;
  } catch {
    accessToken = null;
    return null;
  }
}

export function normalizeProjectDraft(input = {}) {
  return {
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    language: input.language,
    source: String(input.source || "")
  };
}

export function formatPlatformDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export const userPlatformApi = {
  async register(input) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    }, false);
    accessToken = result.accessToken;
    return result.user;
  },

  async login(input) {
    const loginOnce = () => request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    }, false);

    // Join the proactive page-load wake-up before submitting credentials.
    await warmUserPlatformApi();

    let result;
    try {
      result = await loginOnce();
    } catch (error) {
      if (!isTransientAuthError(error)) throw error;

      // A gateway timeout during a Render cold start is safe to retry once for
      // login. Credential errors and all non-idempotent auth actions are not retried.
      await wait(750);
      await warmUserPlatformApi({ force: true });
      result = await loginOnce();
    }

    accessToken = result.accessToken;
    return result.user;
  },

  async forgotPassword(email) {
    return request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    }, false);
  },

  async resetPassword(token, password) {
    return request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    }, false);
  },

  async logout() {
    try {
      await request("/api/auth/logout", { method: "POST", body: "{}" }, false);
    } finally {
      clearUserSession();
    }
  },

  async updateProfile(input) {
    return (await request("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(input)
    })).user;
  },

  async dashboard() { return (await request("/api/dashboard")).dashboard; },
  async projects() { return (await request("/api/projects")).projects; },
  async history() { return (await request("/api/history")).history; },
  async createProject(input) {
    return (await request("/api/projects", {
      method: "POST",
      body: JSON.stringify(normalizeProjectDraft(input))
    })).project;
  },
  async updateProject(id, input) {
    return (await request(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    })).project;
  },
  async duplicateProject(id) {
    return (await request(`/api/projects/${id}/duplicate`, {
      method: "POST",
      body: "{}"
    })).project;
  },
  async deleteProject(id) {
    await request(`/api/projects/${id}`, { method: "DELETE" });
  },
  async clearHistory() {
    await request("/api/history", { method: "DELETE" });
  }
};
