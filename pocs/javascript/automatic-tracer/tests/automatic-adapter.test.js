"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const {
  instrumentSource,
} = require("../instrumenter");

const {
  reconstructAllStates,
} = require("../../state-reconstructor");

const {
  TimelineController,
} = require("../../timeline-controller");

const {
  validateTrace,
} = require("../../trace-validator");

function executeAutomaticAdapter() {
  const automaticTracerDirectory =
    path.resolve(__dirname, "..");

  const javascriptDirectory =
    path.resolve(
      automaticTracerDirectory,
      ".."
    );

  const fixturePath = path.join(
    javascriptDirectory,
    "fixtures",
    "basic-flow.js"
  );

  const runnerPath = path.join(
    automaticTracerDirectory,
    "runner-child.js"
  );

  const sourceCode = fs.readFileSync(
    fixturePath,
    "utf8"
  );

  const instrumentedCode =
    instrumentSource(sourceCode);

  assert.equal(
    instrumentedCode.includes(
      "__trace.declare"
    ),
    true
  );

  assert.equal(
    instrumentedCode.includes(
      "__trace.loopCondition"
    ),
    true
  );

  assert.equal(
    instrumentedCode.includes(
      "__trace.captureArrayAssignment"
    ),
    true
  );

  const result = spawnSync(
    process.execPath,
    [runnerPath, fixturePath],
    {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        "Automatic JavaScript adapter failed.",
        `Exit code: ${result.status}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join("\n")
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      [
        "Automatic adapter returned invalid JSON.",
        error.message,
        `stdout: ${result.stdout}`,
      ].join("\n")
    );
  }
}

function runTests() {
  const trace = executeAutomaticAdapter();

  assert.equal(validateTrace(trace), true);

  assert.equal(
    trace.language,
    "javascript"
  );

  assert.equal(
    trace.domain,
    "PROGRAM_EXECUTION"
  );

  assert.equal(
    trace.events[0].type,
    "PROGRAM_START"
  );

  assert.equal(
    trace.events.at(-1).type,
    "PROGRAM_END"
  );

  const requiredEventTypes = [
    "STATEMENT_EXECUTE",
    "VARIABLE_DECLARE",
    "VARIABLE_UPDATE",
    "ARRAY_CREATE",
    "ARRAY_ACCESS",
    "ARRAY_UPDATE",
    "FUNCTION_CALL",
    "FUNCTION_ENTER",
    "FUNCTION_RETURN",
    "LOOP_START",
    "LOOP_CONDITION",
    "LOOP_ITERATION",
    "LOOP_END",
    "CONDITION_EVALUATE",
    "BRANCH_ENTER",
    "OUTPUT",
  ];

  for (const eventType of requiredEventTypes) {
    assert.equal(
      trace.events.some(
        (event) =>
          event.type === eventType
      ),
      true,
      `Missing automatic event: ${eventType}`
    );
  }

  assert.equal(
    trace.events.some(
      (event) => event.type === "ERROR"
    ),
    false
  );

  const states = reconstructAllStates(
    trace.events
  );

  const controller = new TimelineController({
    states,
    speed: 1,
    baseDelayMs: 10,
  });

  const finalSnapshot = controller.last();

  assert.equal(
    finalSnapshot.state.status,
    "completed"
  );

  assert.deepEqual(
    finalSnapshot.state.arrays.numbers.values,
    [4, 8, 12]
  );

  assert.deepEqual(
    finalSnapshot.state.variables.numbers.value,
    [4, 8, 12]
  );

  assert.equal(
    finalSnapshot.state.variables.total.value,
    24
  );

  assert.equal(
    finalSnapshot.state.variables.index.value,
    3
  );

  assert.equal(
    finalSnapshot.state.output.length,
    2
  );

  assert.equal(
    finalSnapshot.state.output[0].value,
    "Total is greater than 20."
  );

  assert.equal(
    finalSnapshot.state.output[1].value,
    '{"numbers":[4,8,12],"total":24}'
  );

  assert.equal(
    finalSnapshot.state.callStack.length,
    0
  );

  const firstArrayUpdate =
    trace.events.find(
      (event) =>
        event.type === "ARRAY_UPDATE"
    );

  assert.ok(firstArrayUpdate);

  const beforeUpdate = controller.seek(
    firstArrayUpdate.sequence - 1
  );

  const afterUpdate = controller.seek(
    firstArrayUpdate.sequence
  );

  assert.notDeepEqual(
    beforeUpdate.state.arrays.numbers.values,
    afterUpdate.state.arrays.numbers.values
  );

  controller.destroy();

  console.log(
    "Automatic JavaScript adapter tests passed."
  );
  console.log(`Language: ${trace.language}`);
  console.log(`Trace events: ${trace.eventCount}`);
  console.log(
    `Final numbers: ${JSON.stringify(
      finalSnapshot.state.arrays.numbers.values
    )}`
  );
  console.log(
    `Final total: ${
      finalSnapshot.state.variables.total.value
    }`
  );
  console.log(
    `Final index: ${
      finalSnapshot.state.variables.index.value
    }`
  );
  console.log(
    `Console entries: ${
      finalSnapshot.state.output.length
    }`
  );
  console.log(
    `Call stack frames: ${
      finalSnapshot.state.callStack.length
    }`
  );
}

try {
  runTests();
} catch (error) {
  console.error(
    "Automatic JavaScript adapter tests failed."
  );
  console.error(error);
  process.exitCode = 1;
}