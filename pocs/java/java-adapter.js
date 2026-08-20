"use strict";

const {
  TraceRecorder,
} = require("../javascript/trace-recorder");

const ITEM_SEPARATOR = "\u001f";

function decode(value) {
  return Buffer.from(
    value ?? "",
    "base64"
  ).toString("utf8");
}

function decodeValue(type, encodedValue) {
  const value = decode(encodedValue);

  switch (type) {
    case "null":
      return null;

    case "boolean":
      return value === "true";

    case "integer":
    case "number":
      return Number(value);

    case "string":
      return value;

    case "array:number":
      if (value === "") {
        return [];
      }

      return value
        .split(",")
        .map((item) => Number(item));

    case "array:string":
      if (value === "") {
        return [];
      }

      return value.split(ITEM_SEPARATOR);

    case "object":
    case "unknown":
      return {
        $type: type,
        display: value,
      };

    default:
      throw new Error(
        `Unsupported Java observation value type: ${type}`
      );
  }
}

function normalizeValueType(type) {
  if (
    type === "array:number" ||
    type === "array:string"
  ) {
    return "array";
  }

  return type;
}

function decodeLocals(encodedLocals) {
  const serializedLocals = decode(encodedLocals);
  const locals = {};

  if (serializedLocals === "") {
    return locals;
  }

  for (const serializedLocal of serializedLocals.split(";")) {
    const [
      encodedName,
      encodedType,
      encodedValue,
    ] = serializedLocal.split(",");

    const name = decode(encodedName);
    const rawType = decode(encodedType);

    locals[name] = {
      value: decodeValue(rawType, encodedValue),
      valueType: normalizeValueType(rawType),
    };
  }

  return locals;
}

function parsePositiveLine(value, fallback = 1) {
  const line = Number(value);

  if (Number.isInteger(line) && line > 0) {
    return line;
  }

  return fallback;
}

function valuesAreEqual(left, right) {
  return (
    left.valueType === right.valueType &&
    JSON.stringify(left.value) ===
      JSON.stringify(right.value)
  );
}

function findChangedIndex(previousValues, newValues) {
  const sharedLength = Math.min(
    previousValues.length,
    newValues.length
  );

  for (let index = 0; index < sharedLength; index += 1) {
    if (
      JSON.stringify(previousValues[index]) !==
      JSON.stringify(newValues[index])
    ) {
      return index;
    }
  }

  if (previousValues.length !== newValues.length) {
    return sharedLength;
  }

  return null;
}

function emitVariableDeclare(
  recorder,
  name,
  variable,
  line
) {
  if (variable.valueType === "array") {
    recorder.record("ARRAY_CREATE", {
      line,
      payload: {
        name,
        values: structuredClone(variable.value),
        length: variable.value.length,
      },
    });
  }

  recorder.record("VARIABLE_DECLARE", {
    line,
    payload: {
      name,
      value: structuredClone(variable.value),
      valueType: variable.valueType,
    },
  });
}

function emitVariableUpdate(
  recorder,
  name,
  previousVariable,
  currentVariable,
  line
) {
  if (
    previousVariable.valueType === "array" &&
    currentVariable.valueType === "array"
  ) {
    const changedIndex = findChangedIndex(
      previousVariable.value,
      currentVariable.value
    );

    if (changedIndex !== null) {
      recorder.record("ARRAY_UPDATE", {
        line,
        payload: {
          arrayName: name,
          index: changedIndex,
          previousValue:
            previousVariable.value[changedIndex] ??
            null,
          newValue:
            currentVariable.value[changedIndex] ??
            null,
          values: structuredClone(
            currentVariable.value
          ),
        },
      });
    }
  }

  recorder.record("VARIABLE_UPDATE", {
    line,
    payload: {
      name,
      previousValue: structuredClone(
        previousVariable.value
      ),
      newValue: structuredClone(
        currentVariable.value
      ),
      valueType: currentVariable.valueType,
    },
  });
}

function emitLocalChanges(
  recorder,
  previousLocals,
  currentLocals,
  line
) {
  for (
    const [name, currentVariable]
    of Object.entries(currentLocals)
  ) {
    const previousVariable =
      previousLocals[name];

    if (!previousVariable) {
      emitVariableDeclare(
        recorder,
        name,
        currentVariable,
        line
      );

      continue;
    }

    if (
      !valuesAreEqual(
        previousVariable,
        currentVariable
      )
    ) {
      emitVariableUpdate(
        recorder,
        name,
        previousVariable,
        currentVariable,
        line
      );
    }
  }
}

function buildJavaTrace(
  rawObservations,
  {
    traceId = "java-basic-flow-001",
    sourceFile = "fixtures/BasicFlow.java",
  } = {}
) {
  if (
    typeof rawObservations !== "string" ||
    rawObservations.trim() === ""
  ) {
    throw new TypeError(
      "rawObservations must be a non-empty string."
    );
  }

  const recorder = new TraceRecorder({
    traceId,
    language: "java",
    sourceFile,
  });

  const observations = rawObservations
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const frameStates = new Map();

  let lastObservedLine = 1;
  let executionStatus = "completed";
  let sawStart = false;
  let sawEnd = false;

  recorder.start({
    line: 1,
    payload: {
      message: "Controlled Java execution started.",
    },
  });

  for (const observation of observations) {
    const fields = observation.split("\t");
    const observationType = fields[0];

    if (observationType === "START") {
      sawStart = true;
      continue;
    }

    if (observationType === "METHOD_ENTER") {
      const frameId = fields[1];
      const methodLine = parsePositiveLine(
        fields[2],
        lastObservedLine
      );
      const callerLine = parsePositiveLine(
        fields[3],
        methodLine
      );
      const functionName = decode(fields[4]);
      const locals = decodeLocals(fields[5]);

      lastObservedLine = methodLine;

      if (functionName !== "main") {
        recorder.record("FUNCTION_CALL", {
          line: callerLine,
          payload: {
            functionName,
            arguments: Object.values(locals).map(
              (variable) =>
                structuredClone(variable.value)
            ),
          },
        });
      }

      recorder.record("FUNCTION_ENTER", {
        line: methodLine,
        payload: {
          functionName,
          parameters: Object.fromEntries(
            Object.entries(locals).map(
              ([name, variable]) => [
                name,
                structuredClone(variable.value),
              ]
            )
          ),
        },
      });

      for (
        const [name, variable]
        of Object.entries(locals)
      ) {
        emitVariableDeclare(
          recorder,
          name,
          variable,
          methodLine
        );
      }

      frameStates.set(frameId, {
        functionName,
        locals,
        lastLine: methodLine,
      });

      continue;
    }

    if (observationType === "LINE") {
      const frameId = fields[1];
      const line = parsePositiveLine(
        fields[2],
        lastObservedLine
      );
      const functionName = decode(fields[3]);
      const locals = decodeLocals(fields[4]);

      let frameState = frameStates.get(frameId);

      if (!frameState) {
        frameState = {
          functionName,
          locals: {},
          lastLine: line,
        };

        frameStates.set(frameId, frameState);
      }

      emitLocalChanges(
        recorder,
        frameState.locals,
        locals,
        frameState.lastLine
      );

      recorder.record("STATEMENT_EXECUTE", {
        line,
        payload: {
          functionName,
          statementKind: "java-line",
        },
      });

      frameState.locals = locals;
      frameState.lastLine = line;
      lastObservedLine = line;

      continue;
    }

    if (observationType === "METHOD_EXIT") {
      const frameId = fields[1];
      const line = parsePositiveLine(
        fields[2],
        lastObservedLine
      );
      const functionName = decode(fields[3]);
      const returnType = decode(fields[4]);
      const returnValue = decodeValue(
        returnType,
        fields[5]
      );
      const locals = decodeLocals(fields[6]);

      const frameState = frameStates.get(frameId);

      if (frameState) {
        emitLocalChanges(
          recorder,
          frameState.locals,
          locals,
          frameState.lastLine
        );
      }

      recorder.record("FUNCTION_RETURN", {
        line,
        payload: {
          functionName,
          returnValue,
        },
      });

      frameStates.delete(frameId);
      lastObservedLine = line;

      continue;
    }

    if (observationType === "OUTPUT") {
      const stream = decode(fields[1]);
      const value = decode(fields[2]);

      recorder.record("OUTPUT", {
        line: lastObservedLine,
        payload: {
          stream,
          value,
        },
      });

      continue;
    }

    if (observationType === "ERROR") {
      const line = parsePositiveLine(
        fields[1],
        lastObservedLine
      );

      recorder.record("ERROR", {
        line,
        payload: {
          errorType: decode(fields[2]),
          message: decode(fields[3]),
        },
      });

      executionStatus = "error";
      lastObservedLine = line;

      continue;
    }

    if (observationType === "TRACER_FAILURE") {
      throw new Error(
        `${decode(fields[1])}: ${decode(fields[2])}`
      );
    }

    if (observationType === "END") {
      executionStatus = fields[1] ?? "completed";
      sawEnd = true;
      continue;
    }

    throw new Error(
      `Unknown Java observation type: ${observationType}`
    );
  }

  if (!sawStart) {
    throw new Error(
      "Java observation stream is missing START."
    );
  }

  if (!sawEnd) {
    throw new Error(
      "Java observation stream is missing END."
    );
  }

  recorder.end({
    line: lastObservedLine,
    payload: {
      status: executionStatus,
    },
  });

  return recorder.getTrace();
}

module.exports = {
  buildJavaTrace,
};