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

function createTestStates() {
  const recorder = new TraceRecorder({
    traceId: "timeline-controller-test",
    language: "javascript",
    sourceFile: "timeline-test.js",
  });

  recorder.start({
    line: 1,
    payload: {
      message: "Timeline test started.",
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 1,
    payload: {
      name: "counter",
      value: 0,
      valueType: "number",
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_UPDATE, {
    line: 2,
    payload: {
      name: "counter",
      previousValue: 0,
      newValue: 2,
      valueType: "number",
    },
  });

  recorder.record(EVENT_TYPES.OUTPUT, {
    line: 3,
    payload: {
      stream: "stdout",
      value: "counter=2",
    },
  });

  recorder.end({
    line: 3,
    payload: {
      status: "completed",
    },
  });

  const trace = recorder.getTrace();

  return reconstructAllStates(trace.events);
}

function waitForPlaybackCompletion(controller) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          "Timeline playback did not finish within the timeout."
        )
      );
    }, 1000);

    const unsubscribe = controller.subscribe(
      (snapshot) => {
        if (
          snapshot.isAtEnd &&
          snapshot.isPlaying === false
        ) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(snapshot);
        }
      },
      false
    );

    controller.play();
  });
}

async function runTests() {
  const states = createTestStates();

  const controller = new TimelineController({
    states,
    speed: 1,
    baseDelayMs: 10,
  });

  let snapshot = controller.getSnapshot();

  assert.equal(snapshot.currentStep, -1);
  assert.equal(snapshot.totalSteps, 5);
  assert.equal(snapshot.isAtBeginning, true);
  assert.equal(snapshot.isPlaying, false);

  snapshot = controller.next();
  assert.equal(snapshot.currentStep, 0);

  snapshot = controller.next();
  assert.equal(snapshot.currentStep, 1);
  assert.equal(snapshot.state.variables.counter.value, 0);

  snapshot = controller.previous();
  assert.equal(snapshot.currentStep, 0);

  snapshot = controller.last();
  assert.equal(snapshot.currentStep, 4);
  assert.equal(snapshot.isAtEnd, true);
  assert.equal(snapshot.state.status, "completed");

  snapshot = controller.first();
  assert.equal(snapshot.currentStep, 0);
  assert.equal(snapshot.isAtFirstEvent, true);

  snapshot = controller.reset();
  assert.equal(snapshot.currentStep, -1);
  assert.equal(snapshot.isAtBeginning, true);

  snapshot = controller.seek(2);
  assert.equal(snapshot.currentStep, 2);
  assert.equal(snapshot.state.variables.counter.value, 2);

  assert.throws(
    () => controller.seek(99),
    RangeError
  );

  snapshot = controller.reset();
  controller.play();

  assert.equal(
    controller.getSnapshot().isPlaying,
    true
  );

  controller.pause();

  assert.equal(
    controller.getSnapshot().isPlaying,
    false
  );

  controller.setSpeed(2);
  controller.reset();

  const finalSnapshot =
    await waitForPlaybackCompletion(controller);

  assert.equal(finalSnapshot.currentStep, 4);
  assert.equal(finalSnapshot.isAtEnd, true);
  assert.equal(finalSnapshot.isPlaying, false);
  assert.equal(finalSnapshot.speed, 2);
  assert.equal(
    finalSnapshot.state.variables.counter.value,
    2
  );
  assert.equal(finalSnapshot.state.output.length, 1);
  assert.equal(
    finalSnapshot.state.output[0].value,
    "counter=2"
  );

  controller.destroy();

  console.log("Timeline controller tests passed.");
  console.log(
    `Total trace steps: ${finalSnapshot.totalSteps}`
  );
  console.log(
    `Final timeline step: ${finalSnapshot.currentStep}`
  );
  console.log(
    `Final counter value: ${
      finalSnapshot.state.variables.counter.value
    }`
  );
  console.log(
    `Playback speed: ${finalSnapshot.speed}x`
  );
}

runTests().catch((error) => {
  console.error("Timeline controller tests failed.");
  console.error(error);
  process.exitCode = 1;
});