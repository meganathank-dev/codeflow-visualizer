"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const {
  reconstructAllStates,
} = require("../../javascript/state-reconstructor");

const {
  TimelineController,
} = require("../../javascript/timeline-controller");

const {
  validateTrace,
} = require("../../javascript/trace-validator");

function executePythonAdapter() {
  const pythonDirectory = path.resolve(
    __dirname,
    ".."
  );

  const tracerPath = path.join(
    pythonDirectory,
    "python-tracer.py"
  );

  const fixturePath = path.join(
    pythonDirectory,
    "fixtures",
    "basic-flow.py"
  );

  const result = spawnSync(
    "python",
    [tracerPath, fixturePath],
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
        "Python adapter process failed.",
        `Exit code: ${result.status}`,
        `stderr: ${result.stderr}`,
      ].join("\n")
    );
  }

  if (result.stdout.trim() === "") {
    throw new Error(
      "Python adapter returned an empty trace."
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      [
        "Python adapter returned invalid JSON.",
        error.message,
        `stdout: ${result.stdout}`,
      ].join("\n")
    );
  }
}

function runTests() {
  const trace = executePythonAdapter();

  assert.equal(validateTrace(trace), true);
  assert.equal(trace.language, "python");
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

  const states = reconstructAllStates(
    trace.events
  );

  const controller = new TimelineController({
    states,
    speed: 1,
    baseDelayMs: 10,
  });

  const firstArrayUpdate = trace.events.find(
    (event) => event.type === "ARRAY_UPDATE"
  );

  assert.ok(firstArrayUpdate);

  const beforeArrayUpdate = controller.seek(
    firstArrayUpdate.sequence - 1
  );

  const afterArrayUpdate = controller.seek(
    firstArrayUpdate.sequence
  );

  assert.notDeepEqual(
    beforeArrayUpdate.state.arrays.numbers.values,
    afterArrayUpdate.state.arrays.numbers.values
  );

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

  console.log("Python adapter tests passed.");
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
  console.error("Python adapter tests failed.");
  console.error(error);
  process.exitCode = 1;
}