"use strict";

const {
  TraceRecorder,
} = require("../trace-recorder");

function toSerializable(value, depth = 0) {
  if (depth > 20) {
    return {
      $type: typeof value,
      display: "<maximum depth reached>",
    };
  }

  if (value === undefined) {
    return {
      $type: "undefined",
    };
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    return {
      $type: "number",
      display: String(value),
    };
  }

  if (typeof value === "bigint") {
    return {
      $type: "bigint",
      display: value.toString(),
    };
  }

  if (
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return {
      $type: typeof value,
      display: String(value),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      toSerializable(item, depth + 1)
    );
  }

  if (typeof value === "object") {
    const serializedObject = {};

    for (const [key, childValue] of Object.entries(value)) {
      serializedObject[key] = toSerializable(
        childValue,
        depth + 1
      );
    }

    return serializedObject;
  }

  return {
    $type: typeof value,
    display: String(value),
  };
}

function getValueType(value) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function formatOutputValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(toSerializable(value));
  } catch {
    return String(value);
  }
}

function createRuntime({
  traceId,
  sourceFile,
}) {
  const recorder = new TraceRecorder({
    traceId,
    language: "javascript",
    sourceFile,
  });

  const callStack = [];
  const loopIterations = new Map();
  let closed = false;

  function record(type, line, payload = {}) {
    return recorder.record(type, {
      line,
      payload,
    });
  }

  const runtime = {
    start() {
      recorder.start({
        line: 1,
        payload: {
          message:
            "Automatic JavaScript execution started.",
        },
      });
    },

    statement(line) {
      record("STATEMENT_EXECUTE", line, {
        statementKind: "javascript-statement",
      });
    },

    declare(name, value, line) {
      const serializedValue =
        toSerializable(value);

      if (Array.isArray(value)) {
        record("ARRAY_CREATE", line, {
          name,
          values: serializedValue,
          length: value.length,
        });
      }

      record("VARIABLE_DECLARE", line, {
        name,
        value: serializedValue,
        valueType: getValueType(value),
      });

      return value;
    },

    captureAssignment(
      name,
      readPreviousValue,
      executeAssignment,
      line,
      assignmentOperator
    ) {
      const previousValue =
        readPreviousValue();

      const newValue = executeAssignment();

      record("VARIABLE_UPDATE", line, {
        name,
        previousValue:
          toSerializable(previousValue),
        newValue: toSerializable(newValue),
        valueType: getValueType(newValue),
        operation: assignmentOperator,
      });

      return newValue;
    },

    captureArrayAssignment(
      arrayName,
      array,
      index,
      executeAssignment,
      line,
      assignmentOperator
    ) {
      const previousValue =
        toSerializable(array[index]);

      const result = executeAssignment();
      const newValue =
        toSerializable(array[index]);

      record("ARRAY_UPDATE", line, {
        arrayName,
        index: toSerializable(index),
        previousValue,
        newValue,
        values: toSerializable(array),
        operation: assignmentOperator,
      });

      return result;
    },

    arrayAccess(
      arrayName,
      array,
      index,
      line
    ) {
      const value = array[index];

      record("ARRAY_ACCESS", line, {
        arrayName,
        index: toSerializable(index),
        value: toSerializable(value),
      });

      return value;
    },

    call(functionName, line, invoke) {
      record("FUNCTION_CALL", line, {
        functionName,
      });

      return invoke();
    },

    functionEnter(
      functionName,
      parameters,
      line
    ) {
      const serializedParameters =
        toSerializable(parameters);

      callStack.push(functionName);

      record("FUNCTION_ENTER", line, {
        functionName,
        parameters: serializedParameters,
      });

      for (
        const [name, value]
        of Object.entries(parameters)
      ) {
        record("VARIABLE_DECLARE", line, {
          name,
          value: toSerializable(value),
          valueType: getValueType(value),
          scope: functionName,
        });
      }
    },

    functionReturn(
      functionName,
      returnValue,
      line
    ) {
      record("FUNCTION_RETURN", line, {
        functionName,
        returnValue:
          toSerializable(returnValue),
      });

      if (
        callStack.at(-1) === functionName
      ) {
        callStack.pop();
      }

      return returnValue;
    },

    condition(line, expression, result) {
      record("CONDITION_EVALUATE", line, {
        expression,
        result: Boolean(result),
      });

      return result;
    },

    branchEnter(line, branch) {
      record("BRANCH_ENTER", line, {
        branch,
        reason: `${branch} branch selected.`,
      });
    },

    loopStart(line, loopType) {
      loopIterations.set(line, 0);

      record("LOOP_START", line, {
        loopType,
      });
    },

    loopCondition(
      line,
      expression,
      result
    ) {
      record("LOOP_CONDITION", line, {
        expression,
        result: Boolean(result),
      });

      return result;
    },

    loopIteration(line) {
      const iteration =
        (loopIterations.get(line) ?? 0) + 1;

      loopIterations.set(line, iteration);

      record("LOOP_ITERATION", line, {
        iteration,
      });
    },

    loopEnd(line) {
      const iterations =
        loopIterations.get(line) ?? 0;

      record("LOOP_END", line, {
        iterations,
        reason: "condition-false",
      });

      loopIterations.delete(line);
    },

    output(line, ...values) {
      const renderedOutput = values
        .map(formatOutputValue)
        .join(" ");

      record("OUTPUT", line, {
        stream: "stdout",
        value: renderedOutput,
      });
    },

    error(error, line = 1) {
      record("ERROR", line, {
        errorType:
          error?.name ?? "JavaScriptError",
        message:
          error?.message ??
          "Unknown JavaScript error.",
      });
    },

    end(status = "completed") {
      if (closed) {
        return;
      }

      recorder.end({
        line: 1,
        payload: {
          status,
        },
      });

      closed = true;
    },

    getTrace() {
      return recorder.getTrace();
    },
  };

  return runtime;
}

module.exports = {
  createRuntime,
  toSerializable,
};