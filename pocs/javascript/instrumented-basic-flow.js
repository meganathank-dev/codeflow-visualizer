"use strict";

const assert = require("node:assert/strict");

const {
  EVENT_TYPES,
  TraceRecorder,
} = require("./trace-recorder");

const SOURCE_FILE = "fixtures/basic-flow.js";

const recorder = new TraceRecorder({
  traceId: "javascript-basic-flow-001",
  language: "javascript",
  sourceFile: SOURCE_FILE,
});

function doubleValue(value) {
  recorder.record(EVENT_TYPES.FUNCTION_ENTER, {
    line: 1,
    payload: {
      functionName: "doubleValue",
      parameters: {
        value,
      },
    },
  });

  const result = value * 2;

  recorder.record(EVENT_TYPES.EXPRESSION_RESULT, {
    line: 2,
    payload: {
      expression: "value * 2",
      operands: [value, 2],
      operator: "*",
      result,
    },
  });

  recorder.record(EVENT_TYPES.FUNCTION_RETURN, {
    line: 2,
    payload: {
      functionName: "doubleValue",
      returnValue: result,
    },
  });

  return result;
}

recorder.start({
  line: 1,
  payload: {
    message: "JavaScript controlled execution started.",
  },
});

recorder.record(EVENT_TYPES.STATEMENT_EXECUTE, {
  line: 1,
  payload: {
    statement: "function doubleValue(value)",
    statementKind: "function-declaration",
  },
});

const numbers = [2, 4, 6];

recorder.record(EVENT_TYPES.ARRAY_CREATE, {
  line: 5,
  payload: {
    name: "numbers",
    values: [...numbers],
    length: numbers.length,
  },
});

recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
  line: 5,
  payload: {
    name: "numbers",
    value: [...numbers],
    valueType: "array",
  },
  stateDelta: {
    variables: {
      set: [
        {
          name: "numbers",
          value: [...numbers],
          valueType: "array",
        },
      ],
    },
  },
});

let total = 0;

recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
  line: 6,
  payload: {
    name: "total",
    value: total,
    valueType: "number",
  },
  stateDelta: {
    variables: {
      set: [
        {
          name: "total",
          value: total,
          valueType: "number",
        },
      ],
    },
  },
});

let index = 0;

recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
  line: 8,
  payload: {
    name: "index",
    value: index,
    valueType: "number",
  },
  stateDelta: {
    variables: {
      set: [
        {
          name: "index",
          value: index,
          valueType: "number",
        },
      ],
    },
  },
});

recorder.record(EVENT_TYPES.LOOP_START, {
  line: 8,
  payload: {
    loopType: "for",
    condition: "index < numbers.length",
  },
});

while (true) {
  const loopCondition = index < numbers.length;

  recorder.record(EVENT_TYPES.LOOP_CONDITION, {
    line: 8,
    payload: {
      expression: "index < numbers.length",
      index,
      arrayLength: numbers.length,
      result: loopCondition,
    },
  });

  if (!loopCondition) {
    break;
  }

  recorder.record(EVENT_TYPES.LOOP_ITERATION, {
    line: 8,
    payload: {
      iteration: index + 1,
      index,
    },
  });

  const currentValue = numbers[index];

  recorder.record(EVENT_TYPES.ARRAY_ACCESS, {
    line: 9,
    payload: {
      arrayName: "numbers",
      index,
      value: currentValue,
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 9,
    payload: {
      name: "currentValue",
      value: currentValue,
      valueType: "number",
    },
  });

  recorder.record(EVENT_TYPES.FUNCTION_CALL, {
    line: 10,
    payload: {
      functionName: "doubleValue",
      arguments: [currentValue],
    },
  });

  const doubledValue = doubleValue(currentValue);

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 10,
    payload: {
      name: "doubledValue",
      value: doubledValue,
      valueType: "number",
    },
  });

  const previousArrayValue = numbers[index];
  numbers[index] = doubledValue;

  recorder.record(EVENT_TYPES.ARRAY_UPDATE, {
    line: 12,
    payload: {
      arrayName: "numbers",
      index,
      previousValue: previousArrayValue,
      newValue: doubledValue,
      values: [...numbers],
    },
    stateDelta: {
      arrays: {
        update: [
          {
            name: "numbers",
            index,
            previousValue: previousArrayValue,
            newValue: doubledValue,
          },
        ],
      },
    },
  });

  const previousTotal = total;
  total += doubledValue;

  recorder.record(EVENT_TYPES.VARIABLE_UPDATE, {
    line: 13,
    payload: {
      name: "total",
      previousValue: previousTotal,
      newValue: total,
      operation: "+=",
      operand: doubledValue,
    },
    stateDelta: {
      variables: {
        set: [
          {
            name: "total",
            value: total,
            valueType: "number",
          },
        ],
      },
    },
  });

  const previousIndex = index;
  index += 1;

  recorder.record(EVENT_TYPES.VARIABLE_UPDATE, {
    line: 8,
    payload: {
      name: "index",
      previousValue: previousIndex,
      newValue: index,
      operation: "+=",
      operand: 1,
    },
    stateDelta: {
      variables: {
        set: [
          {
            name: "index",
            value: index,
            valueType: "number",
          },
        ],
      },
    },
  });
}

recorder.record(EVENT_TYPES.LOOP_END, {
  line: 14,
  payload: {
    iterations: index,
    reason: "condition-false",
  },
});

const branchCondition = total > 20;

recorder.record(EVENT_TYPES.CONDITION_EVALUATE, {
  line: 16,
  payload: {
    expression: "total > 20",
    leftOperand: total,
    operator: ">",
    rightOperand: 20,
    result: branchCondition,
  },
});

if (branchCondition) {
  recorder.record(EVENT_TYPES.BRANCH_ENTER, {
    line: 16,
    payload: {
      branch: "if",
      reason: "Condition evaluated to true.",
    },
  });

  const message = "Total is greater than 20.";
  console.log(message);

  recorder.record(EVENT_TYPES.OUTPUT, {
    line: 17,
    payload: {
      stream: "stdout",
      value: message,
    },
  });
} else {
  recorder.record(EVENT_TYPES.BRANCH_ENTER, {
    line: 18,
    payload: {
      branch: "else",
      reason: "Condition evaluated to false.",
    },
  });

  const message = "Total is 20 or less.";
  console.log(message);

  recorder.record(EVENT_TYPES.OUTPUT, {
    line: 19,
    payload: {
      stream: "stdout",
      value: message,
    },
  });
}

const finalOutput = JSON.stringify({
  numbers,
  total,
});

console.log(finalOutput);

recorder.record(EVENT_TYPES.OUTPUT, {
  line: 22,
  payload: {
    stream: "stdout",
    value: finalOutput,
  },
});

recorder.end({
  line: 22,
  payload: {
    status: "completed",
  },
});

const trace = recorder.getTrace();

assert.deepEqual(numbers, [4, 8, 12]);
assert.equal(total, 24);
assert.equal(trace.eventCount, 50);
assert.equal(trace.events[0].type, EVENT_TYPES.PROGRAM_START);
assert.equal(
  trace.events[trace.events.length - 1].type,
  EVENT_TYPES.PROGRAM_END
);

console.log("Trace validation passed.");
console.log(`Trace events: ${trace.eventCount}`);