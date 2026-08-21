"use strict";

const assert = require("node:assert/strict");

const {
  createExecutionServer
} = require("../src/server");

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
  const server = createExecutionServer();

  const address = await listen(
    server
  );

  const baseUrl = (
    `http://127.0.0.1:${address.port}`
  );

  try {
    const health = await requestJson(
      baseUrl,

      "/health"
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

      "codeflow-execution"
    );

    assert.equal(
      health.body.security.dedicatedExecutionProcess,

      true
    );

    assert.equal(
      health.body.security.acceptsUntrustedCode,

      false
    );

    assert.equal(
      health.body.security.productionSandboxAvailable,

      false
    );

    const languages = await requestJson(
      baseUrl,

      "/languages"
    );

    assert.equal(
      languages.status,

      200
    );

    assert.deepEqual(
      languages.body.languages.map(
        (language) => language.id
      ),

      [
        "javascript",

        "python",

        "java",

        "sql"
      ]
    );

    const sqlLanguage = languages.body.languages.find(
      (language) => language.id === "sql"
    );

    assert.equal(
      sqlLanguage.domain,

      "query"
    );

    assert.equal(
      sqlLanguage.visualizationMode,

      "logical-query"
    );

    const unsupportedLanguage = await requestJson(
      baseUrl,

      "/execute",

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
      baseUrl,

      "/execute",

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
      baseUrl,

      "/execute",

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
      baseUrl,

      "/missing"
    );

    assert.equal(
      missingRoute.status,

      404
    );

    console.log(
      "Execution service tests passed."
    );

    console.log(
      "Service health endpoint: passed"
    );

    console.log(
      `Supported languages: ${languages.body.languages.length}`
    );

    console.log(
      "SQL query domain: passed"
    );

    console.log(
      "Request validation: passed"
    );

    console.log(
      "Unsafe execution prevention: passed"
    );
  } finally {
    await close(
      server
    );
  }
}

runTests().catch((error) => {
  console.error(
    "Execution service tests failed."
  );

  console.error(
    error
  );

  process.exitCode = 1;
});