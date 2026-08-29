"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");

const { createApiApp } = require("../src/app");
const { createMemoryUserRepository } = require("../src/user-platform/memory-repository");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createExecutionServer() {
  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        status: "ok",
        executionEnabledLanguages: ["javascript", "python", "java", "sql"],
        security: { dedicatedExecutionProcess: true }
      });
      return;
    }

    if (request.method === "POST" && request.url === "/execute") {
      for await (const chunk of request) void chunk;
      sendJson(response, 200, {
        status: "ok",
        executionStatus: "completed",
        trace: { events: [{ type: "OUTPUT" }, { type: "PROGRAM_END" }] },
        states: [{ console: [] }, { console: [{ text: "Total: 24" }] }],
        summary: { eventCount: 2, durationMs: 18 }
      });
      return;
    }

    sendJson(response, 404, { status: "error" });
  });
}

async function request(baseUrl, pathname, options = {}) {
  const headers = { accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")
  };
}

function json(method, body, accessToken, cookie) {
  return {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(cookie ? { cookie } : {})
    }
  };
}

async function runTests() {
  const executionServer = createExecutionServer();
  const executionAddress = await listen(executionServer);
  const repository = createMemoryUserRepository();
  const app = createApiApp({
    executionServiceUrl: `http://127.0.0.1:${executionAddress.port}`,
    userRepository: repository,
    accessTokenSecret: "test-access-token-secret-value-12345",
    refreshTokenSecret: "test-refresh-token-secret-value-12345",
    secureCookies: false
  });
  const apiServer = http.createServer(app);
  const apiAddress = await listen(apiServer);
  const baseUrl = `http://127.0.0.1:${apiAddress.port}`;

  try {
    const weakPassword = await request(baseUrl, "/api/auth/register", json("POST", {
      name: "Meganathan",
      email: "meganathan@example.com",
      password: "weak"
    }));
    assert.equal(weakPassword.status, 400);
    assert.equal(weakPassword.body.error.code, "WEAK_PASSWORD");

    const registration = await request(baseUrl, "/api/auth/register", json("POST", {
      name: "Meganathan K",
      email: "MEGANATHAN@example.com",
      password: "CodeFlow9Secure"
    }));
    assert.equal(registration.status, 201);
    assert.equal(registration.body.user.email, "meganathan@example.com");
    assert.equal(typeof registration.body.accessToken, "string");
    assert.match(registration.cookie, /codeflow_refresh=/);
    assert.match(registration.cookie, /HttpOnly/);
    assert.equal(Object.hasOwn(registration.body.user, "passwordHash"), false);

    const duplicate = await request(baseUrl, "/api/auth/register", json("POST", {
      name: "Duplicate User",
      email: "meganathan@example.com",
      password: "CodeFlow9Secure"
    }));
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "EMAIL_ALREADY_REGISTERED");

    const denied = await request(baseUrl, "/api/projects");
    assert.equal(denied.status, 401);
    assert.equal(denied.body.error.code, "AUTHENTICATION_REQUIRED");

    const invalidOptionalToken = await request(baseUrl, "/api/execute", json("POST", {
      language: "javascript",
      source: "console.log('not recorded');",
      inputs: []
    }, "invalid.token.value"));
    assert.equal(invalidOptionalToken.status, 401);
    assert.equal(invalidOptionalToken.body.error.code, "INVALID_ACCESS_TOKEN");

    let accessToken = registration.body.accessToken;
    const profile = await request(baseUrl, "/api/profile", json("PATCH", {
      name: "Meganathan K",
      bio: "Learning MERN by building verified execution tools."
    }, accessToken));
    assert.equal(profile.status, 200);
    assert.match(profile.body.user.bio, /verified execution/);

    const created = await request(baseUrl, "/api/projects", json("POST", {
      title: "Array total visualizer",
      description: "Adds values and visualizes stack updates.",
      language: "javascript",
      source: "const numbers = [4, 8, 12];"
    }, accessToken));
    assert.equal(created.status, 201);
    assert.equal(created.body.project.language, "javascript");
    const projectId = created.body.project.id;

    const updated = await request(baseUrl, `/api/projects/${projectId}`, json("PATCH", {
      title: "Array total and stack"
    }, accessToken));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.project.title, "Array total and stack");

    const duplicated = await request(baseUrl, `/api/projects/${projectId}/duplicate`, json("POST", {}, accessToken));
    assert.equal(duplicated.status, 201);
    assert.match(duplicated.body.project.title, /copy$/);

    const projects = await request(baseUrl, "/api/projects", json("GET", undefined, accessToken));
    assert.equal(projects.status, 200);
    assert.equal(projects.body.projects.length, 2);

    const secondRegistration = await request(baseUrl, "/api/auth/register", json("POST", {
      name: "Second User",
      email: "second@example.com",
      password: "Second9Secure"
    }));
    const isolated = await request(
      baseUrl,
      `/api/projects/${projectId}`,
      json("GET", undefined, secondRegistration.body.accessToken)
    );
    assert.equal(isolated.status, 404);

    const execution = await request(baseUrl, "/api/execute", json("POST", {
      language: "javascript",
      source: "console.log('Total:', 24);",
      inputs: []
    }, accessToken));
    assert.equal(execution.status, 200);

    const history = await request(baseUrl, "/api/history", json("GET", undefined, accessToken));
    assert.equal(history.status, 200);
    assert.equal(history.body.history.length, 1);
    assert.equal(history.body.history[0].eventCount, 2);
    assert.equal(history.body.history[0].outputPreview, "Total: 24");

    const dashboard = await request(baseUrl, "/api/dashboard", json("GET", undefined, accessToken));
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.dashboard.projectCount, 2);
    assert.equal(dashboard.body.dashboard.executionCount, 1);
    assert.equal(dashboard.body.dashboard.languages.javascript, 1);

    const refreshed = await request(
      baseUrl,
      "/api/auth/refresh",
      json("POST", {}, null, registration.cookie)
    );
    assert.equal(refreshed.status, 200);
    assert.notEqual(refreshed.body.accessToken, accessToken);
    assert.match(refreshed.cookie, /codeflow_refresh=/);
    accessToken = refreshed.body.accessToken;

    const logout = await request(baseUrl, "/api/auth/logout", json("POST", {}, null, refreshed.cookie));
    assert.equal(logout.status, 200);
    assert.match(logout.cookie, /Max-Age=0/);

    const staleRefresh = await request(baseUrl, "/api/auth/refresh", json("POST", {}, null, refreshed.cookie));
    assert.equal(staleRefresh.status, 401);

    await request(baseUrl, `/api/projects/${projectId}`, json("DELETE", undefined, accessToken));
    const remainingProjects = await request(baseUrl, "/api/projects", json("GET", undefined, accessToken));
    assert.equal(remainingProjects.body.projects.length, 1);

    await request(baseUrl, "/api/history", json("DELETE", undefined, accessToken));
    const emptyHistory = await request(baseUrl, "/api/history", json("GET", undefined, accessToken));
    assert.deepEqual(emptyHistory.body.history, []);

    console.log("MERN user platform API tests passed.");
    console.log("Registration, login, refresh rotation, and logout: passed");
    console.log("Profile validation and safe public user data: passed");
    console.log("Owner-scoped project CRUD and duplication: passed");
    console.log("Authenticated execution history and dashboard: passed");
  } finally {
    await close(apiServer);
    await close(executionServer);
  }
}

runTests().catch((error) => {
  console.error("MERN user platform API tests failed.");
  console.error(error);
  process.exitCode = 1;
});
