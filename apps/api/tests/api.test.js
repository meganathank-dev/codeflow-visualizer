"use strict";

const assert = require("node:assert/strict");

const http = require("node:http");

const {
  createApiApp
} = require("../src/app");

function listen(server) {
  return new Promise(
    (
      resolve,

      reject
    ) => {
      server.once(
        "error",

        reject
      );

      server.listen(
        0,

        "127.0.0.1",

        () => {
          server.removeListener(
            "error",

            reject
          );

          resolve(
            server.address()
          );
        }
      );
    }
  );
}

function close(server) {
  return new Promise(
    (
      resolve,

      reject
    ) => {
      server.close((error) => {
        if (error) {
          reject(error);

          return;
        }

        resolve();
      });
    }
  );
}

function writeJson(
  response,

  statusCode,

  payload
) {
  response.writeHead(
    statusCode,

    {
      "content-type": "application/json; charset=utf-8"
    }
  );

  response.end(
    JSON.stringify(payload)
  );
}

function createMockExecutionServer() {
  return http.createServer(
    (
      request,

      response
    ) => {
      if (
        request.method === "GET" &&
        request.url === "/health"
      ) {
        writeJson(
          response,

          200,

          {
            status: "ok",

            service: "codeflow-execution",

            security: {
              dedicatedExecutionProcess: true,

              acceptsUntrustedCode: false,

              productionSandboxAvailable: false
            }
          }
        );

        return;
      }

      if (
        request.method === "GET" &&
        request.url === "/languages"
      ) {
        writeJson(
          response,

          200,

          {
            status: "ok",

            languages: [
              {
                id: "javascript",
                domain: "program"
              },

              {
                id: "python",
                domain: "program"
              },

              {
                id: "java",
                domain: "program"
              },

              {
                id: "sql",
                domain: "query"
              }
            ]
          }
        );

        return;
      }

      if (
        request.method === "POST" &&
        request.url === "/execute"
      ) {
        writeJson(
          response,

          501,

          {
            status: "error",

            error: {
              code: "EXECUTION_NOT_IMPLEMENTED",

              message: (
                "Execution has not been enabled."
              )
            }
          }
        );

        return;
      }

      writeJson(
        response,

        404,

        {
          status: "error"
        }
      );
    }
  );
}

async function requestJson(
  baseUrl,

  pathname,

  options = {}
) {
  const response = await fetch(
    `${baseUrl}${pathname}`,

    {
      ...options,

      headers: {
        "content-type": "application/json",

        ...options.headers
      }
    }
  );

  return {
    status: response.status,

    body: await response.json()
  };
}

async function runTests() {
  const executionServer = createMockExecutionServer();

  const executionAddress = await listen(
    executionServer
  );

  const executionServiceUrl = (
    `http://127.0.0.1:${executionAddress.port}`
  );

  const app = createApiApp({
    executionServiceUrl
  });

  const apiServer = http.createServer(
    app
  );

  const apiAddress = await listen(
    apiServer
  );

  const apiBaseUrl = (
    `http://127.0.0.1:${apiAddress.port}`
  );

  try {
    const health = await requestJson(
      apiBaseUrl,

      "/api/health"
    );

    assert.equal(
      health.status,

      200
    );

    assert.equal(
      health.body.status,

      "ok"
    );

    assert.equal(
      health.body.service,

      "codeflow-api"
    );

    assert.equal(
      health.body.executionService.connected,

      true
    );

    assert.equal(
      health.body.executionService.security.acceptsUntrustedCode,

      false
    );

    const languages = await requestJson(
      apiBaseUrl,

      "/api/languages"
    );

    assert.equal(
      languages.status,

      200
    );

    assert.equal(
      languages.body.languages.length,

      4
    );

    const sqlLanguage = languages.body.languages.find(
      (language) => language.id === "sql"
    );

    assert.equal(
      sqlLanguage.domain,

      "query"
    );

    const unsupportedLanguage = await requestJson(
      apiBaseUrl,

      "/api/execute",

      {
        method: "POST",

        body: JSON.stringify({
          language: "c",

          source: "int main() {}"
        })
      }
    );

    assert.equal(
      unsupportedLanguage.status,

      400
    );

    assert.equal(
      unsupportedLanguage.body.error.code,

      "UNSUPPORTED_LANGUAGE"
    );

    const missingSource = await requestJson(
      apiBaseUrl,

      "/api/execute",

      {
        method: "POST",

        body: JSON.stringify({
          language: "javascript",

          source: ""
        })
      }
    );

    assert.equal(
      missingSource.status,

      400
    );

    assert.equal(
      missingSource.body.error.code,

      "INVALID_SOURCE"
    );

    const executionAttempt = await requestJson(
      apiBaseUrl,

      "/api/execute",

      {
        method: "POST",

        body: JSON.stringify({
          language: "javascript",

          source: "console.log('Hello');"
        })
      }
    );

    assert.equal(
      executionAttempt.status,

      501
    );

    assert.equal(
      executionAttempt.body.error.code,

      "EXECUTION_NOT_IMPLEMENTED"
    );

    const missingRoute = await requestJson(
      apiBaseUrl,

      "/api/not-found"
    );

    assert.equal(
      missingRoute.status,

      404
    );

    console.log(
      "API tests passed."
    );

    console.log(
      "API health endpoint: passed"
    );

    console.log(
      "Execution service connection: passed"
    );

    console.log(
      `Supported languages: ${languages.body.languages.length}`
    );

    console.log(
      "Request validation: passed"
    );

    console.log(
      "Execution boundary separation: passed"
    );
  } finally {
    await close(
      apiServer
    );

    await close(
      executionServer
    );
  }
}

runTests().catch((error) => {
  console.error(
    "API tests failed."
  );

  console.error(
    error
  );

  process.exitCode = 1;
});
