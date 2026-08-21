"use strict";

const assert = require("node:assert/strict");

const {
  assertValidTrace
} = require("@codeflow/execution-trace");

const {
  createExecutionServer
} = require("../src/server");

function listen(
  server
) {
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

function close(
  server
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      server.close(
        (error) => {
          if (error) {
            reject(
              error
            );

            return;
          }

          resolve();
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

function execute(
  baseUrl,
  language,
  source
) {
  return requestJson(
    baseUrl,

    "/execute",

    {
      method: "POST",

      body: JSON.stringify({
        language,

        source
      })
    }
  );
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

function createPythonFixture() {
  return [
    "def double(value):",

    "    return value * 2",

    "",

    "numbers = [2, 4, 6]",

    "stack = []",

    "total = 0",

    "",

    "for index in range(len(numbers)):",

    "    numbers[index] = double(numbers[index])",

    "    total += numbers[index]",

    "    stack.append(numbers[index])",

    "",

    "if total > 20:",

    '    print("Total:", total)'
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
    health.body.security.dedicatedPythonChildProcess,

    true
  );

  assert.equal(
    health.body.security.acceptsUntrustedCode,

    false
  );

  assert.deepEqual(
    health.body.executionEnabledLanguages,

    [
      "javascript",

      "python"
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

  const getLanguage = (
    languageId
  ) => response.body.languages.find(
    (language) => (
      language.id === languageId
    )
  );

  assert.equal(
    getLanguage(
      "javascript"
    ).executionEnabled,

    true
  );

  assert.equal(
    getLanguage(
      "python"
    ).executionEnabled,

    true
  );

  assert.equal(
    getLanguage(
      "java"
    ).executionEnabled,

    false
  );

  assert.equal(
    getLanguage(
      "sql"
    ).executionEnabled,

    false
  );

  assert.equal(
    getLanguage(
      "sql"
    ).domain,

    "query"
  );
}

function assertRequiredEvents(
  trace,
  eventTypes
) {
  for (const eventType of eventTypes) {
    assert.equal(
      trace.events.some(
        (event) => (
          event.type === eventType
        )
      ),

      true,

      (
        "Expected execution event was missing: "
        + eventType
      )
    );
  }
}

function assertCompletedProgram(
  response,
  language
) {
  assert.equal(
    response.status,

    200
  );

  assert.equal(
    response.body.status,

    "ok"
  );

  assert.equal(
    response.body.language,

    language
  );

  assert.equal(
    response.body.executionStatus,

    "completed"
  );

  const trace = response.body.trace;

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
    trace.language,

    language
  );

  assert.equal(
    trace.events[0].type,

    "PROGRAM_START"
  );

  assert.equal(
    trace.events.at(-1).type,

    "PROGRAM_END"
  );

  assert.equal(
    response.body.states.length,

    trace.eventCount
  );

  assert.equal(
    response.body.summary.eventCount,

    trace.eventCount
  );

  assert.equal(
    response.body.security.dedicatedChildProcess,

    true
  );

  return response.body;
}

async function testRealJavaScriptExecution(
  baseUrl
) {
  const response = await execute(
    baseUrl,

    "javascript",

    createJavaScriptFixture()
  );

  const execution = assertCompletedProgram(
    response,

    "javascript"
  );

  assertRequiredEvents(
    execution.trace,

    [
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
    ]
  );

  const finalState = execution.states.at(-1);

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

  return execution;
}

async function testRealPythonExecution(
  baseUrl
) {
  const response = await execute(
    baseUrl,

    "python",

    createPythonFixture()
  );

  const execution = assertCompletedProgram(
    response,

    "python"
  );

  assertRequiredEvents(
    execution.trace,

    [
      "STATEMENT_EXECUTE",

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

      "CONDITION_EVALUATE",

      "BRANCH_ENTER",

      "FUNCTION_CALL",

      "FUNCTION_ENTER",

      "FUNCTION_RETURN",

      "OUTPUT"
    ]
  );

  const finalState = execution.states.at(-1);

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
    finalState.variables.index,

    2
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

  return execution;
}

async function testPythonEnumerate(
  baseUrl
) {
  const source = [
    "numbers = [4, 8, 12]",

    "stack = []",

    "total = 0",

    "",

    "for index, number in enumerate(numbers):",

    "    total += number",

    "    stack.append(number)",

    "",

    'print("Total:", total)'
  ].join("\n");

  const response = await execute(
    baseUrl,

    "python",

    source
  );

  const execution = assertCompletedProgram(
    response,

    "python"
  );

  const finalState = execution.states.at(-1);

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
    finalState.variables.index,

    2
  );

  assert.equal(
    finalState.variables.number,

    12
  );

  assert.equal(
    finalState.variables.total,

    24
  );
}

async function testSyntaxErrors(
  baseUrl
) {
  for (const [
    language,

    source
  ] of [
    [
      "javascript",

      "const = ;"
    ],

    [
      "python",

      "def broken(:"
    ]
  ]) {
    const execution = await execute(
      baseUrl,

      language,

      source
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

    assert.equal(
      (
        execution.body.states
          .at(-1)
          .errors
          .length
      ),

      1
    );
  }
}

async function testPolicyRejection(
  baseUrl
) {
  for (const [
    language,

    source
  ] of [
    [
      "javascript",

      "process.exit(1);"
    ],

    [
      "python",

      "import os\nprint(os.getcwd())"
    ]
  ]) {
    const execution = await execute(
      baseUrl,

      language,

      source
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
}

async function testPendingLanguages(
  baseUrl
) {
  for (const [
    language,

    source
  ] of [
    [
      "java",

      "class Main {}"
    ],

    [
      "sql",

      "SELECT 1"
    ]
  ]) {
    const execution = await execute(
      baseUrl,

      language,

      source
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
}

async function testRequestValidation(
  baseUrl
) {
  const unsupportedLanguage = await execute(
    baseUrl,

    "c",

    "int main() {}"
  );

  assert.equal(
    unsupportedLanguage.status,

    400
  );

  assert.equal(
    unsupportedLanguage.body.error.code,

    "UNSUPPORTED_LANGUAGE"
  );

  const missingSource = await execute(
    baseUrl,

    "javascript",

    ""
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

    const javascript = (
      await testRealJavaScriptExecution(
        baseUrl
      )
    );

    const python = (
      await testRealPythonExecution(
        baseUrl
      )
    );

    await testPythonEnumerate(
      baseUrl
    );

    await testSyntaxErrors(
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

    const finalPythonState = (
      python.states.at(-1)
    );

    console.log(
      "Execution service tests passed."
    );

    console.log(
      "Real JavaScript execution: passed"
    );

    console.log(
      (
        "JavaScript trace events: "
        + javascript.trace.eventCount
      )
    );

    console.log(
      "Real Python execution: passed"
    );

    console.log(
      (
        "Python trace events: "
        + python.trace.eventCount
      )
    );

    console.log(
      (
        "Python final numbers: "
        + JSON.stringify(
          finalPythonState.arrays.numbers
        )
      )
    );

    console.log(
      (
        "Python final stack: "
        + JSON.stringify(
          finalPythonState.stacks.stack
        )
      )
    );

    console.log(
      (
        "Python final total: "
        + finalPythonState.variables.total
      )
    );

    console.log(
      (
        "Python final loop index: "
        + finalPythonState.variables.index
      )
    );

    console.log(
      "Python enumerate support: passed"
    );

    console.log(
      "Shared execution trace compatibility: passed"
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

runTests().catch(
  (error) => {
    console.error(
      "Execution service tests failed."
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);