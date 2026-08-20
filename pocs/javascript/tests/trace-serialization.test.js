"use strict";

const assert = require("node:assert/strict");

const {
  EVENT_TYPES,
  TraceRecorder,
} = require("../trace-recorder");

const {
  reconstructAllStates,
} = require("../state-reconstructor");

const {
  TimelineController,
} = require("../timeline-controller");

const {
  deserializeTrace,
  serializeTrace,
} = require("../trace-serializer");

const {
  validateTrace,
} = require("../trace-validator");

function createSerializableTrace() {
  const recorder = new TraceRecorder({
    traceId: "serialization-test-001",
    language: "javascript",
    sourceFile: "serialization-test.js",
  });

  recorder.start({
    line: 1,
    payload: {
      message: "Serialization test started.",
    },
  });

  recorder.record(EVENT_TYPES.ARRAY_CREATE, {
    line: 1,
    payload: {
      name: "numbers",
      values: [3, 6],
      length: 2,
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 1,
    payload: {
      name: "numbers",
      value: [3, 6],
      valueType: "array",
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 2,
    payload: {
      name: "total",
      value: 0,
      valueType: "number",
    },
  });

  recorder.record(EVENT_TYPES.ARRAY_UPDATE, {
    line: 3,
    payload: {
      arrayName: "numbers",
      index: 0,
      previousValue: 3,
      newValue: 6,
      values: [6, 6],
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_UPDATE, {
    line: 4,
    payload: {
      name: "total",
      previousValue: 0,
      newValue: 12,
      valueType: "number",
    },
  });

  recorder.record(EVENT_TYPES.OUTPUT, {
    line: 5,
    payload: {
      stream: "stdout",
      value: "total=12",
    },
  });

  recorder.end({
    line: 5,
    payload: {
      status: "completed",
    },
  });

  return recorder.getTrace();
}

function runTests() {
  const originalTrace = createSerializableTrace();

  assert.equal(validateTrace(originalTrace), true);

  const serializedTrace =
    serializeTrace(originalTrace);

  assert.equal(
    typeof serializedTrace,
    "string"
  );

  const restoredTrace =
    deserializeTrace(serializedTrace);

  assert.deepEqual(restoredTrace, originalTrace);
  assert.equal(restoredTrace.eventCount, 8);
  assert.equal(Object.isFrozen(restoredTrace), true);
  assert.equal(
    Object.isFrozen(restoredTrace.events),
    true
  );

  const replayStates = reconstructAllStates(
    restoredTrace.events
  );

  const controller = new TimelineController({
    states: replayStates,
    speed: 1,
    baseDelayMs: 10,
  });

  const updateState = controller.seek(5);

  assert.equal(updateState.currentStep, 5);
  assert.equal(
    updateState.state.variables.total.value,
    12
  );

  const finalSnapshot = controller.last();

  assert.equal(finalSnapshot.currentStep, 7);
  assert.equal(finalSnapshot.state.status, "completed");
  assert.deepEqual(
    finalSnapshot.state.arrays.numbers.values,
    [6, 6]
  );
  assert.deepEqual(
    finalSnapshot.state.variables.numbers.value,
    [6, 6]
  );
  assert.equal(finalSnapshot.state.output.length, 1);
  assert.equal(
    finalSnapshot.state.output[0].value,
    "total=12"
  );

  const corruptedEnvelope = JSON.parse(
    serializedTrace
  );

  corruptedEnvelope.trace.events[6].payload.value =
    "tampered-output";

  assert.throws(
    () =>
      deserializeTrace(
        JSON.stringify(corruptedEnvelope)
      ),
    /checksum validation failed/i
  );

  const invalidSequenceTrace =
    structuredClone(originalTrace);

  invalidSequenceTrace.events[2].sequence = 99;

  assert.throws(
    () => validateTrace(invalidSequenceTrace),
    /expected sequence 2, received 99/i
  );

  assert.throws(
    () =>
      serializeTrace(originalTrace, {
        maxBytes: 25,
      }),
    /exceeds the maximum/i
  );

  controller.destroy();

  console.log("Trace serialization tests passed.");
  console.log(
    `Round-trip events: ${restoredTrace.eventCount}`
  );
  console.log(
    `Replayed final step: ${finalSnapshot.currentStep}`
  );
  console.log(
    `Replayed total: ${
      finalSnapshot.state.variables.total.value
    }`
  );
  console.log("Checksum validation: passed");
}

try {
  runTests();
} catch (error) {
  console.error(
    "Trace serialization tests failed."
  );
  console.error(error);
  process.exitCode = 1;
}