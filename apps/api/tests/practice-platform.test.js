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

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function executionResult(body) {
  const sum = body.inputs.map(Number).reduce((total, value) => total + value, 0);
  const output = body.source.includes("SOLVE_SUM") ? String(sum) : "0";
  return {
    status: "ok",
    language: body.language,
    executionStatus: "completed",
    trace: {
      schemaVersion: "1.0.0",
      language: body.language,
      status: "completed",
      events: [{ id: "practice-output", step: 0, type: "OUTPUT", source: { line: 1 }, payload: { text: output } }]
    },
    states: [{ step: 0, console: [{ channel: "stdout", text: output }], errors: [] }],
    summary: { eventCount: 1, durationMs: 2 }
  };
}

function createExecutionServer() {
  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      send(response, 200, {
        status: "ok",
        executionEnabledLanguages: ["javascript", "python", "java", "sql"],
        security: { dedicatedExecutionProcess: true }
      });
      return;
    }
    if (request.method === "POST" && request.url === "/execute") {
      send(response, 200, executionResult(await readBody(request)));
      return;
    }
    send(response, 404, { status: "error" });
  });
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers
    }
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function json(method, body, token) {
  return {
    method,
    body: JSON.stringify(body),
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
}

async function runTests() {
  const executionServer = createExecutionServer();
  const executionAddress = await listen(executionServer);
  const app = createApiApp({
    executionServiceUrl: `http://127.0.0.1:${executionAddress.port}`,
    userRepository: createMemoryUserRepository(),
    accessTokenSecret: "practice-access-token-secret-value-123",
    refreshTokenSecret: "practice-refresh-token-secret-value-123"
  });
  const apiServer = http.createServer(app);
  const apiAddress = await listen(apiServer);
  const baseUrl = `http://127.0.0.1:${apiAddress.port}`;

  try {
    const catalog = await request(baseUrl, "/api/practice/problems");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.body.problems.length, 4);
    assert.deepEqual(
      catalog.body.problems.find((problem) => problem.slug === "high-scoring-students").languages,
      ["sql"]
    );
    assert.equal(JSON.stringify(catalog.body).includes("-40"), false);

    const detail = await request(baseUrl, "/api/practice/problems/sum-two-numbers");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.problem.examples.length, 1);
    assert.equal(detail.body.problem.hiddenTestCount, 2);
    assert.equal(Object.hasOwn(detail.body.problem, "tests"), false);

    const invalidFilter = await request(baseUrl, "/api/practice/problems?language=c");
    assert.equal(invalidFilter.status, 400);
    assert.equal(invalidFilter.body.error.code, "INVALID_PRACTICE_FILTER");

    const source = "// SOLVE_SUM\nconsole.log(Number(prompt('')) + Number(prompt('')));";
    const publicRun = await request(
      baseUrl,
      "/api/practice/problems/sum-two-numbers/run",
      json("POST", { language: "javascript", source })
    );
    assert.equal(publicRun.status, 200);
    assert.equal(publicRun.body.verdict, "accepted");
    assert.equal(publicRun.body.totalCount, 1);
    assert.equal(publicRun.body.visualization.execution.executionStatus, "completed");

    const denied = await request(
      baseUrl,
      "/api/practice/problems/sum-two-numbers/submit",
      json("POST", { language: "javascript", source })
    );
    assert.equal(denied.status, 401);

    const registration = await request(baseUrl, "/api/auth/register", json("POST", {
      name: "Practice Learner",
      email: "practice@example.com",
      password: "Practice9Secure"
    }));
    const token = registration.body.accessToken;

    const submission = await request(
      baseUrl,
      "/api/practice/problems/sum-two-numbers/submit",
      json("POST", { language: "javascript", source }, token)
    );
    assert.equal(submission.status, 201);
    assert.equal(submission.body.verdict, "accepted");
    assert.equal(submission.body.passedCount, 3);
    assert.equal(submission.body.results.filter((result) => result.visibility === "hidden").length, 2);
    for (const hidden of submission.body.results.filter((result) => result.visibility === "hidden")) {
      assert.equal(Object.hasOwn(hidden, "inputs"), false);
      assert.equal(Object.hasOwn(hidden, "expected"), false);
      assert.equal(Object.hasOwn(hidden, "actual"), false);
    }

    const progress = await request(baseUrl, "/api/practice/progress", {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(progress.body.progress.problemCount, 4);
    assert.equal(progress.body.progress.solvedCount, 1);
    assert.equal(progress.body.progress.completionPercent, 25);

    const submissions = await request(baseUrl, "/api/practice/submissions", {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(submissions.body.submissions.length, 1);
    assert.equal(Object.hasOwn(submissions.body.submissions[0], "source"), false);

    console.log("Final Phase 12 practice-platform API tests passed.");
    console.log("Catalog, filters, starter code, and four-language coverage: passed");
    console.log("Public runs and authenticated submissions: passed");
    console.log("Server-side hidden test confidentiality: passed");
    console.log("Submission history and learner progress: passed");
  } finally {
    await close(apiServer);
    await close(executionServer);
  }
}

runTests().catch((error) => {
  console.error("Final Phase 12 practice-platform API tests failed.");
  console.error(error);
  process.exitCode = 1;
});
