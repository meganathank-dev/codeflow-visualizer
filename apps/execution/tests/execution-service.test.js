"use strict";

const assert = require("node:assert/strict");

const {
  assertValidTrace
} = require("@codeflow/execution-trace");

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

function createJavaScriptFixture() {
  return [
    "const numbers = [2, 4, 6];",

    "const stack = [];",

    "let total = 0;",

    "",

    "for (let i = 0; i < numbers.length; i++) {",

    "  numbers[i] *= 2;",

    "  total += numbers[i];",

    "  stack.push(numbers[i]);",

    "}",

    "",

    "function summarize(value) {",

    "  return value;",

    "}",

    "",

    'console.log("Total:", summarize(total));'
  ].join("\n");
}

async function testHealth(
  baseUrl
) {
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
    health.body.security.dedicatedJavaScriptChildProcess,

    true
  );

  assert.equal(
    health.body.security.acceptsUntrustedCode,

    false
  );

  assert.deepEqual(
    health.body.executionEnabledLanguages,

    [
      "javascript"
    ]
  );
}

async function testLanguageCapabilities(
  baseUrl
) {
  const response = await requestJson(
    baseUrl,

    "/languages"
  );

  assert.equal(
    response.status,

    200
  );

  assert.equal(
    response.body.languages.length,

    4
  );

  const javascript = response.body.languages.find(
    (language) => (
      language.id === "javascript"
    )
  );

  const python = response.body.languages.find(
    (language) => (
      language.id === "python"
    )
  );

  const sql = response.body.languages.find(
    (language) => (
      language.id === "sql"
    )
  );

  assert.equal(
    javascript.executionEnabled,

    true
  );

  assert.equal(
    python.executionEnabled,

    false
  );

  assert.equal(
    sql.domain,

    "query"
  );
}

async function testRealJavaScriptExecution(
  baseUrl
) {
  const execution = await requestJson(
    baseUrl,

    "/execute",

    {
      method: "POST",

      body: JSON.stringify({
        language: "javascript",

        source: createJavaScriptFixture()
      })
    }
  );

  assert.equal(
    execution.status,

    200
  );

  assert.equal(
    execution.body.status,

    "ok"
  );

  assert.equal(
    execution.body.language,

    "javascript"
  );

  assert.equal(
    execution.body.executionStatus,

    "completed"
  );

  const trace = execution.body.trace;

  assertValidTrace(
    trace
  );

  assert.equal(
    trace.schemaVersion,

    "1.0.0"
  );

  assert.equal(
    trace.domain,

    "program"
  );

  assert.equal(
    trace.events[0].type,

    "PROGRAM_START"
  );

  assert.equal(
    trace.events.at(-1).type,

    "PROGRAM_END"
  );

  const requiredEvents = [
    "VARIABLE_DECLARE",

    "VARIABLE_UPDATE",

    "ARRAY_CREATE",

    "ARRAY_ACCESS",

    "ARRAY_UPDATE",

    "ARRAY_INSERT",

    "STACK_CREATE",

    "STACK_PUSH",

    "LOOP_START",

    "LOOP_CONDITION",

    "LOOP_ITERATION",

    "LOOP_END",

    "FUNCTION_CALL",

    "FUNCTION_ENTER",

    "FUNCTION_RETURN",

    "OUTPUT"
  ];

  for (const eventType of requiredEvents) {
    assert.equal(
      trace.events.some(
        (event) => (
          event.type === eventType
        )
      ),

      true,

      `Expected execution event was missing: ${eventType}`
    );
  }

  assert.equal(
    Array.isArray(
      execution.body.states
    ),

    true
  );

  assert.equal(
    execution.body.states.length,

    trace.eventCount
  );

  const finalState = execution.body.states.at(-1);

  assert.deepEqual(
    finalState.arrays.numbers,

    [
      4,

      8,

      12
    ]
  );

  assert.deepEqual(
    finalState.stacks.stack,

    [
      4,

      8,

      12
    ]
  );

  assert.equal(
    finalState.variables.total,

    24
  );

  assert.equal(
    finalState.variables.i,

    3
  );

  assert.equal(
    finalState.console.length,

    1
  );

  assert.equal(
    finalState.console[0].text,

    "Total: 24"
  );

  assert.equal(
    finalState.callStack.length,

    0
  );

  assert.equal(
    execution.body.summary.eventCount,

    trace.eventCount
  );

  return execution.body;
}

async function testSyntaxError(
  baseUrl
) {
  const execution = await requestJson(
    baseUrl,

    "/execute",

    {
      method: "POST",

      body: JSON.stringify({
        language: "javascript",

        source: "const = ;"
      })
    }
  );

  assert.equal(
    execution.status,

    200
  );

  assert.equal(
    execution.body.executionStatus,

    "failed"
  );

  assert.equal(
    execution.body.trace.status,

    "failed"
  );

  const finalState = execution.body.states.at(-1);

  assert.equal(
    finalState.errors.length,

    1
  );
}

async function testPolicyRejection(
  baseUrl
) {
  const execution = await requestJson(
    baseUrl,

    "/execute",

    {
      method: "POST",

      body: JSON.stringify({
        language: "javascript",

        source: "process.exit(1);"
      })
    }
  );

  assert.equal(
    execution.status,

    400
  );

  assert.equal(
    execution.body.error.code,

    "SOURCE_POLICY_VIOLATION"
  );
}

async function testPendingLanguages(
  baseUrl
) {
  const execution = await requestJson(
    baseUrl,

    "/execute",

    {
      method: "POST",

      body: JSON.stringify({
        language: "python",

        source: "print('Hello')"
      })
    }
  );

  assert.equal(
    execution.status,

    501
  );

  assert.equal(
    execution.body.error.code,

    "EXECUTION_NOT_IMPLEMENTED"
  );
}

async function testRequestValidation(
  baseUrl
) {
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

  const missingRoute = await requestJson(
    baseUrl,

    "/missing"
  );

  assert.equal(
    missingRoute.status,

    404
  );
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
    await testHealth(
      baseUrl
    );

    await testLanguageCapabilities(
      baseUrl
    );

    const execution = await testRealJavaScriptExecution(
      baseUrl
    );

    await testSyntaxError(
      baseUrl
    );

    await testPolicyRejection(
      baseUrl
    );

    await testPendingLanguages(
      baseUrl
    );

    await testRequestValidation(
      baseUrl
    );

    const finalState = execution.states.at(-1);

    console.log(
      "Execution service tests passed."
    );

    console.log(
      "Real JavaScript execution: passed"
    );

    console.log(
      `Production trace events: ${execution.trace.eventCount}`
    );

    console.log(
      `Final numbers: ${JSON.stringify(finalState.arrays.numbers)}`
    );

    console.log(
      `Final stack: ${JSON.stringify(finalState.stacks.stack)}`
    );

    console.log(
      `Final total: ${finalState.variables.total}`
    );

    console.log(
      `Final loop index: ${finalState.variables.i}`
    );

    console.log(
      "Syntax error handling: passed"
    );

    console.log(
      "Restricted source rejection: passed"
    );

    console.log(
      "Existing language boundaries: passed"
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