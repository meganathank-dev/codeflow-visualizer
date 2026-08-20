"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const {
  buildJavaTrace,
} = require("../java-adapter");

const {
  reconstructAllStates,
} = require("../../javascript/state-reconstructor");

const {
  TimelineController,
} = require("../../javascript/timeline-controller");

const {
  validateTrace,
} = require("../../javascript/trace-validator");

function runCommand(command, argumentsList) {
  const result = spawnSync(
    command,
    argumentsList,
    {
      encoding: "utf8",
      timeout: 20000,
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
        `Command failed: ${command}`,
        `Exit code: ${result.status}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join("\n")
    );
  }

  return result.stdout;
}

function createJavaTrace() {
  const javaDirectory = path.resolve(
    __dirname,
    ".."
  );

  const buildDirectory = path.join(
    javaDirectory,
    "build"
  );

  const debuggerSource = path.join(
    javaDirectory,
    "src",
    "CodeFlowJavaDebugger.java"
  );

  const fixtureSource = path.join(
    javaDirectory,
    "fixtures",
    "BasicFlow.java"
  );

  fs.mkdirSync(buildDirectory, {
    recursive: true,
  });

  runCommand("javac", [
    "--add-modules",
    "jdk.jdi",
    "-g",
    "-d",
    buildDirectory,
    debuggerSource,
    fixtureSource,
  ]);

  const rawObservations = runCommand("java", [
    "--add-modules",
    "jdk.jdi",
    "-cp",
    buildDirectory,
    "CodeFlowJavaDebugger",
    buildDirectory,
    "BasicFlow",
  ]);

  return buildJavaTrace(rawObservations, {
    traceId: "java-basic-flow-001",
    sourceFile: "fixtures/BasicFlow.java",
  });
}

function runTests() {
  const trace = createJavaTrace();

  assert.equal(validateTrace(trace), true);
  assert.equal(trace.language, "java");

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

  assert.equal(
    trace.events.some(
      (event) =>
        event.type === "STATEMENT_EXECUTE"
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === "FUNCTION_ENTER"
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === "FUNCTION_RETURN"
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === "ARRAY_UPDATE"
    ),
    true
  );

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

  controller.destroy();

  console.log("Java adapter tests passed.");
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
  console.error("Java adapter tests failed.");
  console.error(error);
  process.exitCode = 1;
}