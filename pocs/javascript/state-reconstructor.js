"use strict";

const assert = require("node:assert/strict");

const {
  EVENT_TYPES,
  TraceRecorder,
} = require("./trace-recorder");

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return value;
}

function createInitialState() {
  return deepFreeze({
    step: -1,
    status: "idle",
    currentEvent: null,
    sourceLocation: null,

    variables: {},
    arrays: {},
    callStack: [],
    output: [],
    errors: [],

    execution: {
      currentLoop: null,
      currentCondition: null,
      currentBranch: null,
    },

    focus: {
      array: null,
    },
  });
}

function validateEvent(event, expectedSequence) {
  if (!event || typeof event !== "object") {
    throw new TypeError("Execution event must be an object.");
  }

  if (!Number.isInteger(event.sequence)) {
    throw new TypeError("Execution event sequence must be an integer.");
  }

  if (event.sequence !== expectedSequence) {
    throw new Error(
      `Expected event sequence ${expectedSequence}, received ${event.sequence}.`
    );
  }

  if (typeof event.type !== "string" || event.type.trim() === "") {
    throw new TypeError("Execution event type must be a non-empty string.");
  }
}

function applyEvent(previousState, event) {
  validateEvent(event, previousState.step + 1);

  const nextState = clone(previousState);
  const payload = event.payload ?? {};

  nextState.step = event.sequence;
  nextState.currentEvent = {
    eventId: event.eventId,
    type: event.type,
  };
  nextState.sourceLocation = clone(event.source);

  switch (event.type) {
    case EVENT_TYPES.PROGRAM_START: {
      nextState.status = "running";
      break;
    }

    case EVENT_TYPES.PROGRAM_END: {
      nextState.status = payload.status ?? "completed";
      nextState.focus.array = null;
      break;
    }

    case EVENT_TYPES.VARIABLE_DECLARE: {
      nextState.variables[payload.name] = {
        value: clone(payload.value),
        valueType: payload.valueType ?? typeof payload.value,
        declaredAtStep: event.sequence,
        updatedAtStep: event.sequence,
      };
      break;
    }

    case EVENT_TYPES.VARIABLE_UPDATE: {
      const existingVariable = nextState.variables[payload.name];

      if (!existingVariable) {
        throw new Error(
          `Cannot update undeclared variable "${payload.name}".`
        );
      }

      existingVariable.value = clone(payload.newValue);
      existingVariable.valueType =
        payload.valueType ?? existingVariable.valueType;
      existingVariable.updatedAtStep = event.sequence;
      break;
    }

    case EVENT_TYPES.ARRAY_CREATE: {
      nextState.arrays[payload.name] = {
        values: clone(payload.values),
        createdAtStep: event.sequence,
        updatedAtStep: event.sequence,
        lastOperation: "create",
      };

      nextState.focus.array = {
        name: payload.name,
        index: null,
        operation: "create",
      };
      break;
    }

    case EVENT_TYPES.ARRAY_ACCESS: {
      const existingArray = nextState.arrays[payload.arrayName];

      if (!existingArray) {
        throw new Error(
          `Cannot access unknown array "${payload.arrayName}".`
        );
      }

      nextState.focus.array = {
        name: payload.arrayName,
        index: payload.index,
        operation: "access",
        value: clone(payload.value),
      };

      existingArray.lastOperation = "access";
      break;
    }

    case EVENT_TYPES.ARRAY_UPDATE: {
      const existingArray = nextState.arrays[payload.arrayName];

      if (!existingArray) {
        throw new Error(
          `Cannot update unknown array "${payload.arrayName}".`
        );
      }

      if (Array.isArray(payload.values)) {
        existingArray.values = clone(payload.values);
      } else {
        existingArray.values[payload.index] = clone(payload.newValue);
      }

      existingArray.updatedAtStep = event.sequence;
      existingArray.lastOperation = "update";

      nextState.focus.array = {
        name: payload.arrayName,
        index: payload.index,
        operation: "update",
        previousValue: clone(payload.previousValue),
        newValue: clone(payload.newValue),
      };

      const matchingVariable =
        nextState.variables[payload.arrayName];

      if (matchingVariable) {
        matchingVariable.value = clone(existingArray.values);
        matchingVariable.updatedAtStep = event.sequence;
      }

      break;
    }

    case EVENT_TYPES.FUNCTION_ENTER: {
      nextState.callStack.push({
        functionName: payload.functionName,
        parameters: clone(payload.parameters ?? {}),
        enteredAtStep: event.sequence,
      });
      break;
    }

    case EVENT_TYPES.FUNCTION_RETURN: {
      if (nextState.callStack.length === 0) {
        throw new Error(
          `Cannot return from "${payload.functionName}" because the call stack is empty.`
        );
      }

      nextState.callStack.pop();
      break;
    }

    case EVENT_TYPES.LOOP_START: {
      nextState.execution.currentLoop = {
        loopType: payload.loopType,
        condition: payload.condition,
        iteration: 0,
        active: true,
      };
      break;
    }

    case EVENT_TYPES.LOOP_CONDITION: {
      nextState.execution.currentCondition = {
        expression: payload.expression,
        result: payload.result,
      };
      break;
    }

    case EVENT_TYPES.LOOP_ITERATION: {
      if (nextState.execution.currentLoop) {
        nextState.execution.currentLoop.iteration =
          payload.iteration;
      }
      break;
    }

    case EVENT_TYPES.LOOP_END: {
      if (nextState.execution.currentLoop) {
        nextState.execution.currentLoop.active = false;
        nextState.execution.currentLoop.iterations =
          payload.iterations;
        nextState.execution.currentLoop.endReason =
          payload.reason;
      }
      break;
    }

    case EVENT_TYPES.CONDITION_EVALUATE: {
      nextState.execution.currentCondition = {
        expression: payload.expression,
        result: payload.result,
      };
      break;
    }

    case EVENT_TYPES.BRANCH_ENTER: {
      nextState.execution.currentBranch = {
        branch: payload.branch,
        reason: payload.reason,
      };
      break;
    }

    case EVENT_TYPES.OUTPUT: {
      nextState.output.push({
        step: event.sequence,
        stream: payload.stream ?? "stdout",
        value: clone(payload.value),
      });
      break;
    }

    case EVENT_TYPES.ERROR: {
      nextState.status = "error";

      nextState.errors.push({
        step: event.sequence,
        message: payload.message ?? "Unknown execution error.",
      });

      break;
    }

    default: {
      break;
    }
  }

  return deepFreeze(nextState);
}

function reconstructState(events, targetStep = events.length - 1) {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array.");
  }

  if (
    !Number.isInteger(targetStep) ||
    targetStep < -1 ||
    targetStep >= events.length
  ) {
    throw new RangeError(
      `targetStep must be between -1 and ${events.length - 1}.`
    );
  }

  let state = createInitialState();

  for (let index = 0; index <= targetStep; index += 1) {
    state = applyEvent(state, events[index]);
  }

  return state;
}

function reconstructAllStates(events) {
  const states = [];
  let state = createInitialState();

  for (const event of events) {
    state = applyEvent(state, event);
    states.push(state);
  }

  return deepFreeze(states);
}

module.exports = {
  applyEvent,
  createInitialState,
  reconstructAllStates,
  reconstructState,
};

/*
 * Controlled smoke test.
 */
if (require.main === module) {
  const recorder = new TraceRecorder({
    traceId: "state-reconstruction-smoke-test",
    language: "javascript",
    sourceFile: "state-smoke-test.js",
  });

  recorder.start({
    line: 1,
  });

  recorder.record(EVENT_TYPES.ARRAY_CREATE, {
    line: 1,
    payload: {
      name: "numbers",
      values: [2, 4, 6],
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
      previousValue: 2,
      newValue: 4,
      values: [4, 4, 6],
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_UPDATE, {
    line: 4,
    payload: {
      name: "total",
      previousValue: 0,
      newValue: 24,
    },
  });

  recorder.record(EVENT_TYPES.OUTPUT, {
    line: 5,
    payload: {
      stream: "stdout",
      value: "Completed",
    },
  });

  recorder.end({
    line: 5,
    payload: {
      status: "completed",
    },
  });

  const trace = recorder.getTrace();
  const finalState = reconstructState(trace.events);
  const states = reconstructAllStates(trace.events);

  assert.equal(finalState.status, "completed");
  assert.equal(finalState.step, 6);
  assert.equal(finalState.variables.total.value, 24);
  assert.deepEqual(finalState.arrays.numbers.values, [4, 4, 6]);
  assert.equal(finalState.output.length, 1);
  assert.equal(states.length, 7);

  console.log("State reconstruction smoke test passed.");
  console.log(`Reconstructed step: ${finalState.step}`);
  console.log(
    `Array numbers: ${JSON.stringify(
      finalState.arrays.numbers.values
    )}`
  );
  console.log(
    `Variable total: ${finalState.variables.total.value}`
  );
  console.log(`Console entries: ${finalState.output.length}`);
}