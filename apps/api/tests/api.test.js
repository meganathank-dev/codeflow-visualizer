"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");

const { DEFAULT_REQUEST_TIMEOUT_MS, createApiApp } = require("../src/app");

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
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });

  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function createMockExecutionServer() {
  return http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, {
        status: "ok",
        service: "codeflow-execution",
        executionEnabledLanguages: ["javascript", "python", "java"],
        security: {
          dedicatedExecutionProcess: true,
          acceptsUntrustedCode: false,
          productionSandboxAvailable: false
        }
      });

      return;
    }

    if (request.method === "GET" && request.url === "/languages") {
      writeJson(response, 200, {
        status: "ok",
        languages: [
          { id: "javascript", domain: "program", executionEnabled: true },
          { id: "python", domain: "program", executionEnabled: true },
          { id: "java", domain: "program", executionEnabled: true },
          { id: "sql", domain: "query", executionEnabled: false }
        ]
      });

      return;
    }

    if (request.method === "POST" && request.url === "/execute") {
      const body = await readRequestBody(request);

      if (!["javascript", "python", "java"].includes(body.language)) {
        writeJson(response, 501, {
          status: "error",
          error: {
            code: "EXECUTION_NOT_IMPLEMENTED",
            message: `${body.language} execution has not been integrated yet.`
          }
        });

        return;
      }

      writeJson(response, 200, {
        status: "ok",
        language: body.language,
        executionStatus: "completed",
        trace: {
          schemaVersion: "1.0.0",
          language: body.language,
          events: [
            {
              id: "mock-event-0",
              step: 0,
              type: "OUTPUT",
              source: { line: 1 },
              payload: { text: "Hello" }
            }
          ]
        },
        states: [
          {
            step: 0,
            variables: {},
            console: [{ channel: "stdout", text: "Hello" }]
          }
        ],
        summary: { eventCount: 1 }
      });

      return;
    }

    writeJson(response, 404, { status: "error" });
  });
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });

  return { status: response.status, body: await response.json() };
}

async function runTests() {
  const executionServer = createMockExecutionServer();
  const executionAddress = await listen(executionServer);

  const app = createApiApp({
    executionServiceUrl: `http://127.0.0.1:${executionAddress.port}`
  });

  const apiServer = http.createServer(app);
  const apiAddress = await listen(apiServer);
  const apiBaseUrl = `http://127.0.0.1:${apiAddress.port}`;

  try {
    assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 30_000);

    const health = await requestJson(apiBaseUrl, "/api/health");

    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");
    assert.equal(health.body.service, "codeflow-api");
    assert.equal(health.body.executionService.connected, true);
    assert.deepEqual(
      health.body.executionService.enabledLanguages,
      ["javascript", "python", "java"]
    );
    assert.equal(health.body.executionService.security.acceptsUntrustedCode, false);

    const languages = await requestJson(apiBaseUrl, "/api/languages");

    assert.equal(languages.status, 200);
    assert.equal(languages.body.languages.length, 4);
    assert.equal(
      languages.body.languages.find((language) => language.id === "sql").domain,
      "query"
    );

    const unsupportedLanguage = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({ language: "c", source: "int main() {}" })
    });

    assert.equal(unsupportedLanguage.status, 400);
    assert.equal(unsupportedLanguage.body.error.code, "UNSUPPORTED_LANGUAGE");

    const missingSource = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({ language: "javascript", source: "" })
    });

    assert.equal(missingSource.status, 400);
    assert.equal(missingSource.body.error.code, "INVALID_SOURCE");

    const javascriptExecution = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({
        language: "javascript",
        source: 'console.log("Hello");'
      })
    });

    assert.equal(javascriptExecution.status, 200);
    assert.equal(javascriptExecution.body.status, "ok");
    assert.equal(javascriptExecution.body.language, "javascript");
    assert.equal(javascriptExecution.body.trace.events[0].type, "OUTPUT");
    assert.equal(javascriptExecution.body.states[0].console[0].text, "Hello");

    const pythonExecution = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({ language: "python", source: 'print("Hello")' })
    });

    assert.equal(pythonExecution.status, 200);
    assert.equal(pythonExecution.body.status, "ok");
    assert.equal(pythonExecution.body.language, "python");
    assert.equal(pythonExecution.body.trace.language, "python");
    assert.equal(pythonExecution.body.trace.events[0].type, "OUTPUT");
    assert.equal(pythonExecution.body.states[0].console[0].text, "Hello");

    const javaExecution = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({
        language: "java",
        source: "public class Main { public static void main(String[] args) { System.out.println(\"Hello\"); } }"
      })
    });

    assert.equal(javaExecution.status, 200);
    assert.equal(javaExecution.body.status, "ok");
    assert.equal(javaExecution.body.language, "java");
    assert.equal(javaExecution.body.trace.language, "java");
    assert.equal(javaExecution.body.trace.events[0].type, "OUTPUT");
    assert.equal(javaExecution.body.states[0].console[0].text, "Hello");

    const sqlExecution = await requestJson(apiBaseUrl, "/api/execute", {
      method: "POST",
      body: JSON.stringify({
        language: "sql",
        source: "SELECT name FROM students;"
      })
    });

    assert.equal(sqlExecution.status, 501);
    assert.equal(sqlExecution.body.error.code, "EXECUTION_NOT_IMPLEMENTED");

    const missingRoute = await requestJson(apiBaseUrl, "/api/not-found");
    assert.equal(missingRoute.status, 404);

    console.log("API tests passed.");
    console.log("API health endpoint: passed");
    console.log("Execution service connection: passed");
    console.log(`Supported languages: ${languages.body.languages.length}`);
    console.log("Real JavaScript trace forwarding: passed");
    console.log("Real Python trace forwarding: passed");
    console.log("Real Java trace forwarding: passed");
    console.log("Execution-state forwarding: passed");
    console.log("Unavailable language boundaries: passed");
    console.log("Request validation: passed");
    console.log("Execution boundary separation: passed");
  } finally {
    await close(apiServer);
    await close(executionServer);
  }
}

runTests().catch((error) => {
  console.error("API tests failed.");
  console.error(error);
  process.exitCode = 1;
});
