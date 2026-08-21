import assert from "node:assert/strict";

import {
  createExecutionPresentation,
  createIdleExecutionStep
} from "../src/utils/execution-presentation.js";

function createState(step, overrides = {}) {
  return {
    step,
    status: "running",
    source: { line: step + 1 },
    variables: {},
    arrays: {},
    stacks: {},
    queues: {},
    callStack: [],
    console: [],
    errors: [],
    controlFlow: {
      lastCondition: null,
      loops: {}
    },
    ...overrides
  };
}

function createResult(language = "javascript") {
  const events = [
    {
      id: "event-0",
      step: 0,
      type: "PROGRAM_START",
      source: { line: 1 },
      payload: {}
    },
    {
      id: "event-1",
      step: 1,
      type: "ARRAY_CREATE",
      source: { line: 1 },
      payload: { name: "numbers", values: [4, 8, 12] }
    },
    {
      id: "event-2",
      step: 2,
      type: "ARRAY_ACCESS",
      source: { line: 5 },
      payload: { name: "numbers", arrayName: "numbers", index: 1, value: 8 }
    },
    {
      id: "event-3",
      step: 3,
      type: "STACK_PUSH",
      source: { line: 6 },
      payload: { name: "stack", value: 8 }
    },
    {
      id: "event-4",
      step: 4,
      type: "FUNCTION_ENTER",
      source: { line: 8 },
      payload: { name: "double" }
    },
    {
      id: "event-5",
      step: 5,
      type: "LOOP_CONDITION",
      source: { line: 4 },
      payload: { loopId: "line:4", expression: "i < numbers.length", result: true }
    },
    {
      id: "event-6",
      step: 6,
      type: "OUTPUT",
      source: { line: 10 },
      payload: { text: "Total: 24" }
    }
  ];

  const states = [
    createState(0),
    createState(1, {
      variables: { numbers: [4, 8, 12] },
      arrays: { numbers: [4, 8, 12] }
    }),
    createState(2, {
      variables: { numbers: [4, 8, 12] },
      arrays: { numbers: [4, 8, 12] }
    }),
    createState(3, {
      variables: { numbers: [4, 8, 12], stack: [8] },
      arrays: { numbers: [4, 8, 12], stack: [8] },
      stacks: { stack: [8] }
    }),
    createState(4, {
      variables: { numbers: [4, 8, 12], stack: [8] },
      arrays: { numbers: [4, 8, 12], stack: [8] },
      stacks: { stack: [8] },
      callStack: [{ name: "double", source: { line: 8 } }]
    }),
    createState(5, {
      arrays: { numbers: [4, 8, 12] },
      controlFlow: {
        lastCondition: null,
        loops: {
          "line:4": {
            id: "line:4",
            active: true,
            iteration: 2,
            condition: { expression: "i < numbers.length", result: true }
          }
        }
      }
    }),
    createState(6, {
      status: "completed",
      variables: { total: 24 },
      console: [{ channel: "stdout", text: "Total: 24" }]
    })
  ];

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: {
      traceId: "presentation-test",
      status: "completed",
      events
    },
    states,
    summary: { eventCount: events.length }
  };
}

function runTests() {
  const presentation = createExecutionPresentation(createResult());

  assert.equal(presentation.language, "javascript");
  assert.equal(presentation.steps.length, 7);
  assert.equal(presentation.steps[2].line, 5);
  assert.equal(presentation.steps[2].array.name, "numbers");
  assert.equal(presentation.steps[2].array.activeIndex, 1);
  assert.deepEqual(presentation.steps[3].stack.values, [8]);
  assert.equal(presentation.steps[3].array.name, "numbers");
  assert.equal(presentation.steps[4].callStack[0].name, "double");
  assert.equal(presentation.steps[5].iteration, 2);
  assert.equal(presentation.steps[5].condition.result, true);
  assert.equal(presentation.steps[6].console[0].text, "Total: 24");
  assert.equal(presentation.steps[6].variables.total, 24);

  const pythonPresentation = createExecutionPresentation(createResult("python"));
  assert.equal(pythonPresentation.language, "python");
  assert.match(pythonPresentation.steps[0].description, /Python execution/);
  assert.deepEqual(pythonPresentation.steps[3].stack.values, [8]);
  assert.equal(pythonPresentation.steps[5].condition.result, true);

  const idle = createIdleExecutionStep();
  assert.equal(idle.status, "idle");
  assert.deepEqual(idle.variables, {});

  assert.throws(
    () => createExecutionPresentation(null),
    /must be an object/
  );

  const mismatchedResult = createResult();
  mismatchedResult.states.pop();

  assert.throws(
    () => createExecutionPresentation(mismatchedResult),
    /do not match/
  );

  const unsynchronizedResult = createResult();
  unsynchronizedResult.states[2].step = 99;

  assert.throws(
    () => createExecutionPresentation(unsynchronizedResult),
    /not synchronized/
  );

  console.log("Frontend execution presentation tests passed.");
  console.log(`Presented execution steps: ${presentation.steps.length}`);
  console.log("Array highlighting: passed");
  console.log("Stack synchronization: passed");
  console.log("Call-stack presentation: passed");
  console.log("Loop and condition presentation: passed");
  console.log("Trace-state synchronization: passed");
  console.log("Python presentation compatibility: passed");
}

runTests();
