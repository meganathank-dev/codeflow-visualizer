import { readJsonResponse } from "./http-response.js";

let accessToken = null;

function authorizationHeaders() {
  return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

async function parseResponse(response, label) {
  if (response.status === 204) return null;
  const result = await readJsonResponse(response, label);
  if (!response.ok || result.status !== "ok") {
    throw new Error(result.error?.message || `${label} failed.`);
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
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    }, false);
    accessToken = result.accessToken;
    return result.user;
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
