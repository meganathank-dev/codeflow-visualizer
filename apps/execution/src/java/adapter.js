"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");

const {
  EVENT_TYPES,
  TraceRecorder,
  assertValidTrace
} = require("@codeflow/execution-trace");

const { StateReconstructor } = require("@codeflow/visualizer-core");

const DEFAULT_JAVA_EXECUTABLE = "java";
const DEFAULT_JAVAC_EXECUTABLE = "javac";
const DEFAULT_PROCESS_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_TRACE_EVENTS = 1_000;
const DEFAULT_MAX_RESULT_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_COMPILER_OUTPUT_BYTES = 128 * 1024;
const ITEM_SEPARATOR = "\u001f";

const ALLOWED_IMPORTS = new Set([
  "java.util.ArrayDeque",
  "java.util.ArrayList",
  "java.util.Arrays",
  "java.util.Deque",
  "java.util.HashMap",
  "java.util.LinkedHashMap",
  "java.util.LinkedList",
  "java.util.List",
  "java.util.Map",
  "java.util.Queue",
  "java.util.Stack"
]);

const FORBIDDEN_SOURCE_RULES = [
  { pattern: /\bpackage\s+[A-Za-z_$]/, message: "Java package declarations are not supported." },
  { pattern: /\bSystem\s*\.\s*exit\s*\(/, message: "System.exit() is not permitted." },
  { pattern: /\bRuntime\b/, message: "Runtime access is not permitted." },
  { pattern: /\bProcessBuilder\b/, message: "Process creation is not permitted." },
  { pattern: /\bThread\b/, message: "Thread creation is not supported." },
  { pattern: /\bClassLoader\b/, message: "Class-loader access is not permitted." },
  { pattern: /\bClass\s*\.\s*forName\s*\(/, message: "Reflection is not permitted." },
  { pattern: /\bjava\s*\.\s*(io|nio|net|lang\s*\.\s*reflect)\b/, message: "Filesystem, network, and reflection APIs are not permitted." },
  { pattern: /\b(native|synchronized)\b/, message: "Native and synchronized code are not supported." }
];

class JavaExecutionError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "JavaExecutionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function createProcessEnvironment() {
  const environment = {};

  for (const name of [
    "PATH",
    "Path",
    "JAVA_HOME",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "TEMP",
    "TMP"
  ]) {
    if (process.env[name]) {
      environment[name] = process.env[name];
    }
  }

  return environment;
}

function terminateProcessTree(child, useProcessGroup) {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn(
      "taskkill",
      ["/pid", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" }
    );

    killer.on("error", () => child.kill("SIGKILL"));
    return;
  }

  try {
    if (useProcessGroup) {
      process.kill(-child.pid, "SIGKILL");
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    child.kill("SIGKILL");
  }
}

function runProcess(command, argumentsList, options) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    let exceededOutputLimit = false;

    const useProcessGroup = options.killProcessTree && process.platform !== "win32";

    const child = spawn(command, argumentsList, {
      cwd: options.cwd,
      windowsHide: true,
      detached: useProcessGroup,
      stdio: ["ignore", "pipe", "pipe"],
      env: createProcessEnvironment()
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child, useProcessGroup);
    }, options.timeoutMs);

    function settle(callback, value) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    }

    function collect(chunk, chunks, currentBytes, setBytes) {
      const nextBytes = currentBytes + chunk.length;
      setBytes(nextBytes);

      if (nextBytes > options.maximumOutputBytes) {
        exceededOutputLimit = true;
        terminateProcessTree(child, useProcessGroup);
        return;
      }

      chunks.push(chunk);
    }

    child.stdout.on("data", (chunk) => {
      collect(chunk, stdoutChunks, stdoutBytes, (value) => {
        stdoutBytes = value;
      });
    });

    child.stderr.on("data", (chunk) => {
      collect(chunk, stderrChunks, stderrBytes, (value) => {
        stderrBytes = value;
      });
    });

    child.on("error", (error) => {
      settle(
        reject,
        new JavaExecutionError(
          `${command} could not start: ${error.message}`,
          500,
          "JAVA_RUNTIME_UNAVAILABLE"
        )
      );
    });

    child.on("close", (exitCode) => {
      if (timedOut) {
        settle(
          reject,
          new JavaExecutionError(
            "Java execution exceeded the process timeout.",
            408,
            "EXECUTION_TIMEOUT"
          )
        );
        return;
      }

      if (exceededOutputLimit) {
        settle(
          reject,
          new JavaExecutionError(
            "Java execution exceeded the maximum response size.",
            413,
            "TRACE_RESPONSE_TOO_LARGE"
          )
        );
        return;
      }

      settle(resolve, {
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8")
      });
    });
  });
}

function stripCommentsAndStrings(source) {
  let result = "";
  let state = "code";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === "code") {
      if (character === "/" && nextCharacter === "/") {
        result += "  ";
        index += 1;
        state = "line-comment";
      } else if (character === "/" && nextCharacter === "*") {
        result += "  ";
        index += 1;
        state = "block-comment";
      } else if (character === '"') {
        result += " ";
        state = "string";
      } else if (character === "'") {
        result += " ";
        state = "character";
      } else {
        result += character;
      }

      continue;
    }

    if (state === "line-comment") {
      if (character === "\n") {
        result += "\n";
        state = "code";
      } else {
        result += " ";
      }

      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        result += "  ";
        index += 1;
        state = "code";
      } else {
        result += character === "\n" ? "\n" : " ";
      }

      continue;
    }

    if (character === "\\") {
      result += "  ";
      index += 1;
    } else if (
      (state === "string" && character === '"') ||
      (state === "character" && character === "'")
    ) {
      result += " ";
      state = "code";
    } else {
      result += character === "\n" ? "\n" : " ";
    }
  }

  return result;
}

function inspectJavaSource(source) {
  const inspectableSource = stripCommentsAndStrings(source);

  for (const rule of FORBIDDEN_SOURCE_RULES) {
    if (rule.pattern.test(inspectableSource)) {
      throw new JavaExecutionError(rule.message, 400, "SOURCE_POLICY_VIOLATION");
    }
  }

  const importPattern = /\bimport\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*;/g;

  for (const match of inspectableSource.matchAll(importPattern)) {
    if (!ALLOWED_IMPORTS.has(match[1])) {
      throw new JavaExecutionError(
        `Import "${match[1]}" is not permitted in local Java execution.`,
        400,
        "SOURCE_POLICY_VIOLATION"
      );
    }
  }

  const publicClasses = [
    ...inspectableSource.matchAll(
      /\bpublic\s+(?:(?:final|abstract|strictfp)\s+)*class\s+([A-Za-z_$][\w$]*)/g
    )
  ];

  if (publicClasses.length !== 1) {
    throw new JavaExecutionError(
      "Java source must contain exactly one public top-level class.",
      400,
      "INVALID_JAVA_ENTRY_POINT"
    );
  }

  if (!/\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(?:\[\s*\]|\.\.\.)\s+[A-Za-z_$][\w$]*\s*\)/.test(inspectableSource)) {
    throw new JavaExecutionError(
      "Java source must contain public static void main(String[] args).",
      400,
      "INVALID_JAVA_ENTRY_POINT"
    );
  }

  return {
    className: publicClasses[0][1],
    sourceLines: source.split(/\r?\n/)
  };
}

function decode(value) {
  return Buffer.from(value || "", "base64").toString("utf8");
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
      return value === "" ? [] : value.split(",").map(Number);
    case "array:string":
      return value === "" ? [] : value.split(ITEM_SEPARATOR);
    case "object":
    case "unknown":
      return { $type: type, display: value };
    default:
      throw new JavaExecutionError(
        `Unsupported Java observation value type: ${type}`,
        502,
        "INVALID_JAVA_TRACE"
      );
  }
}

function normalizeValueType(type) {
  return type.startsWith("array:") ? "array" : type;
}

function decodeLocals(encodedLocals) {
  const serializedLocals = decode(encodedLocals);
  const locals = {};

  if (!serializedLocals) {
    return locals;
  }

  for (const serializedLocal of serializedLocals.split(";")) {
    const [encodedName, encodedType, encodedValue] = serializedLocal.split(",");
    const name = decode(encodedName);
    const rawType = decode(encodedType);

    locals[name] = {
      value: decodeValue(rawType, encodedValue),
      valueType: normalizeValueType(rawType)
    };
  }

  return locals;
}

function valuesAreEqual(left, right) {
  return (
    left.valueType === right.valueType &&
    JSON.stringify(left.value) === JSON.stringify(right.value)
  );
}

function parsePositiveLine(value, fallback = 1) {
  const line = Number(value);
  return Number.isInteger(line) && line > 0 ? line : fallback;
}

function record(recorder, type, line, payload, scopeId = null) {
  recorder.record(type, payload, {
    source: { line },
    scopeId
  });
}

function emitVariableDeclare(recorder, name, variable, line, scopeId) {
  if (variable.valueType === "array") {
    record(recorder, EVENT_TYPES.ARRAY_CREATE, line, {
      name,
      arrayName: name,
      values: structuredClone(variable.value),
      length: variable.value.length
    }, scopeId);
  }

  record(recorder, EVENT_TYPES.VARIABLE_DECLARE, line, {
    name,
    value: structuredClone(variable.value),
    valueType: variable.valueType
  }, scopeId);

  if (name.toLowerCase().includes("stack")) {
    record(recorder, EVENT_TYPES.STACK_CREATE, line, {
      name,
      values: variable.valueType === "array"
        ? structuredClone(variable.value)
        : []
    }, scopeId);
  }

  if (name.toLowerCase().includes("queue")) {
    record(recorder, EVENT_TYPES.QUEUE_CREATE, line, {
      name,
      values: variable.valueType === "array"
        ? structuredClone(variable.value)
        : []
    }, scopeId);
  }

  if (
    variable.valueType === "object" &&
    /(?:^|\.)(?:HashMap|LinkedHashMap)$/.test(variable.value?.display || "")
  ) {
    record(recorder, EVENT_TYPES.HASHMAP_CREATE, line, {
      name,
      mapName: name,
      entries: [],
      size: 0
    }, scopeId);
  }

  if (/linked.?list/i.test(name)) {
    record(recorder, EVENT_TYPES.LINKED_LIST_CREATE, line, {
      name,
      listName: name,
      nodes: [],
      headId: null,
      tailId: null,
      length: 0
    }, scopeId);
  }
}

function emitVariableUpdate(
  recorder,
  name,
  previousVariable,
  currentVariable,
  line,
  scopeId
) {
  if (
    previousVariable.valueType === "array" &&
    currentVariable.valueType === "array"
  ) {
    const previousValues = previousVariable.value;
    const currentValues = currentVariable.value;
    const sharedLength = Math.min(previousValues.length, currentValues.length);

    for (let index = 0; index < sharedLength; index += 1) {
      if (JSON.stringify(previousValues[index]) !== JSON.stringify(currentValues[index])) {
        record(recorder, EVENT_TYPES.ARRAY_UPDATE, line, {
          name,
          arrayName: name,
          index,
          previousValue: structuredClone(previousValues[index]),
          value: structuredClone(currentValues[index]),
          newValue: structuredClone(currentValues[index]),
          values: structuredClone(currentValues)
        }, scopeId);
      }
    }
  }

  record(recorder, EVENT_TYPES.VARIABLE_UPDATE, line, {
    name,
    previousValue: structuredClone(previousVariable.value),
    value: structuredClone(currentVariable.value),
    newValue: structuredClone(currentVariable.value),
    valueType: currentVariable.valueType
  }, scopeId);
}

function emitLocalChanges(recorder, previousLocals, currentLocals, line, scopeId) {
  for (const [name, currentVariable] of Object.entries(currentLocals)) {
    const previousVariable = previousLocals[name];

    if (!previousVariable) {
      emitVariableDeclare(recorder, name, currentVariable, line, scopeId);
    } else if (!valuesAreEqual(previousVariable, currentVariable)) {
      emitVariableUpdate(
        recorder,
        name,
        previousVariable,
        currentVariable,
        line,
        scopeId
      );
    }
  }
}

function evaluateSimpleExpression(expression, locals) {
  const value = expression.trim();

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value === "true" || value === "false") {
    return value === "true";
  }

  const arrayAccess = value.match(/^([A-Za-z_$][\w$]*)\s*\[\s*([A-Za-z_$][\w$]*|\d+)\s*\]$/);

  if (arrayAccess) {
    const collection = locals[arrayAccess[1]]?.value;
    const rawIndex = arrayAccess[2];
    const index = /^\d+$/.test(rawIndex)
      ? Number(rawIndex)
      : locals[rawIndex]?.value;

    if (Array.isArray(collection) && Number.isInteger(index)) {
      return structuredClone(collection[index]);
    }
  }

  if (Object.hasOwn(locals, value)) {
    return structuredClone(locals[value].value);
  }

  return { $type: "expression", display: value };
}

function processCollectionStatement(
  recorder,
  sourceLine,
  line,
  locals,
  scopeId,
  logicalQueues,
  logicalLinkedLists,
  logicalHashMaps
) {
  const match = sourceLine.match(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(push|add|addFirst|addLast|offer|pop|poll|remove|removeFirst|removeLast|get|getFirst|getLast|peek|element|put|putIfAbsent|containsKey)\s*\((.*?)\)\s*;/
  );

  if (!match) {
    return;
  }

  const [, name, method, expression] = match;
  const lowerName = name.toLowerCase();

  if (
    logicalHashMaps.has(name) ||
    /(?:^|\.)(?:HashMap|LinkedHashMap)$/.test(locals[name]?.value?.display || "")
  ) {
    const entries = logicalHashMaps.get(name) || [];
    const argumentsList = expression.trim() === ""
      ? []
      : expression.split(",").map((item) => item.trim());
    const key = evaluateSimpleExpression(argumentsList[0] || "", locals);
    const index = entries.findIndex((entry) => (
      JSON.stringify(entry.key) === JSON.stringify(key)
    ));
    const previous = index >= 0 ? entries[index] : null;

    if (method === "put" || (method === "putIfAbsent" && !previous)) {
      const value = evaluateSimpleExpression(argumentsList[1] || "", locals);
      const previousValue = previous ? structuredClone(previous.value) : null;

      if (previous) {
        previous.value = structuredClone(value);
      } else {
        entries.push({ key: structuredClone(key), value: structuredClone(value) });
      }

      logicalHashMaps.set(name, entries);

      record(recorder, EVENT_TYPES.HASHMAP_SET, line, {
        name,
        mapName: name,
        key,
        value,
        previousValue,
        updated: Boolean(previous),
        entries: structuredClone(entries),
        size: entries.length
      }, scopeId);
    } else if (method === "get") {
      record(recorder, EVENT_TYPES.HASHMAP_GET, line, {
        name,
        mapName: name,
        key,
        value: previous ? structuredClone(previous.value) : null,
        entries: structuredClone(entries),
        size: entries.length
      }, scopeId);
    } else if (method === "containsKey") {
      record(recorder, EVENT_TYPES.HASHMAP_HAS, line, {
        name,
        mapName: name,
        key,
        result: Boolean(previous),
        entries: structuredClone(entries),
        size: entries.length
      }, scopeId);
    } else if (method === "remove" && previous) {
      entries.splice(index, 1);
      logicalHashMaps.set(name, entries);

      record(recorder, EVENT_TYPES.HASHMAP_DELETE, line, {
        name,
        mapName: name,
        key,
        value: previous.value,
        entries: structuredClone(entries),
        size: entries.length
      }, scopeId);
    }

    return;
  }

  if (/linked.?list/i.test(name)) {
    const list = logicalLinkedLists.get(name) || { nodes: [], nextNodeNumber: 0 };
    const before = structuredClone(list.nodes);
    const argumentsList = expression.trim() === ""
      ? []
      : expression.split(",").map((item) => item.trim());
    let inserted = null;
    let removed = null;
    let visited = null;
    let index = null;

    if (["add", "addFirst", "addLast", "offer", "push"].includes(method)) {
      const indexedInsert = method === "add" && argumentsList.length === 2;
      index = method === "addFirst" || method === "push"
        ? 0
        : indexedInsert
          ? Number(evaluateSimpleExpression(argumentsList[0], locals))
          : list.nodes.length;
      const value = evaluateSimpleExpression(
        indexedInsert ? argumentsList[1] : argumentsList[0],
        locals
      );

      inserted = { id: `node:${++list.nextNodeNumber}`, value, nextId: null };
      list.nodes.splice(index, 0, inserted);
    } else if (["remove", "removeFirst", "removeLast", "poll", "pop"].includes(method)) {
      index = method === "removeLast"
        ? list.nodes.length - 1
        : method === "remove" && argumentsList.length > 0
          ? Number(evaluateSimpleExpression(argumentsList[0], locals))
          : 0;
      removed = list.nodes.splice(index, 1)[0] || null;
    } else if (["get", "getFirst", "getLast", "peek", "element"].includes(method)) {
      index = method === "getLast"
        ? list.nodes.length - 1
        : method === "get"
          ? Number(evaluateSimpleExpression(argumentsList[0], locals))
          : 0;
      visited = list.nodes[index] || null;
    }

    list.nodes.forEach((node, position) => {
      node.nextId = list.nodes[position + 1]?.id || null;
    });
    logicalLinkedLists.set(name, list);

    const payload = {
      name,
      listName: name,
      nodes: structuredClone(list.nodes),
      headId: list.nodes[0]?.id || null,
      tailId: list.nodes.at(-1)?.id || null,
      length: list.nodes.length
    };

    if (inserted) {
      record(recorder, EVENT_TYPES.NODE_CREATE, line, {
        ...payload,
        nodeId: inserted.id,
        value: inserted.value,
        nextId: inserted.nextId
      }, scopeId);

      record(recorder, EVENT_TYPES.REFERENCE_UPDATE, line, {
        ...payload,
        reference: index === 0 ? "head" : "next",
        fromNodeId: index === 0 ? null : list.nodes[index - 1].id,
        previousTargetId: index === 0 ? before[0]?.id || null : before[index - 1]?.nextId || null,
        targetNodeId: inserted.id
      }, scopeId);

      record(recorder, EVENT_TYPES.NODE_INSERT, line, {
        ...payload,
        nodeId: inserted.id,
        value: inserted.value,
        index
      }, scopeId);
    } else if (removed) {
      record(recorder, EVENT_TYPES.REFERENCE_UPDATE, line, {
        ...payload,
        reference: index === 0 ? "head" : "next",
        fromNodeId: index === 0 ? null : before[index - 1].id,
        previousTargetId: removed.id,
        targetNodeId: list.nodes[index]?.id || null
      }, scopeId);

      record(recorder, EVENT_TYPES.NODE_DELETE, line, {
        ...payload,
        nodeId: removed.id,
        value: removed.value,
        index
      }, scopeId);
    } else if (visited) {
      record(recorder, EVENT_TYPES.NODE_VISIT, line, {
        ...payload,
        nodeId: visited.id,
        value: visited.value,
        index
      }, scopeId);
    }

    return;
  }

  if (lowerName.includes("stack")) {
    if (["push", "add", "offer", "addLast"].includes(method)) {
      record(recorder, EVENT_TYPES.STACK_PUSH, line, {
        name,
        value: evaluateSimpleExpression(expression, locals)
      }, scopeId);
    } else if (["pop", "poll", "remove", "removeFirst"].includes(method)) {
      record(recorder, EVENT_TYPES.STACK_POP, line, { name }, scopeId);
    }
  }

  if (lowerName.includes("queue")) {
    const values = logicalQueues.get(name) || [];

    if (["add", "offer", "addLast"].includes(method)) {
      const value = evaluateSimpleExpression(expression, locals);
      values.push(structuredClone(value));
      logicalQueues.set(name, values);

      record(recorder, EVENT_TYPES.QUEUE_ENQUEUE, line, {
        name,
        value,
        values: structuredClone(values)
      }, scopeId);
    } else if (["poll", "remove", "removeFirst"].includes(method)) {
      const value = values.shift();
      logicalQueues.set(name, values);

      record(recorder, EVENT_TYPES.QUEUE_DEQUEUE, line, {
        name,
        value,
        values: structuredClone(values)
      }, scopeId);
    } else if (["peek", "element"].includes(method)) {
      record(recorder, EVENT_TYPES.QUEUE_PEEK, line, {
        name,
        value: structuredClone(values[0]),
        values: structuredClone(values)
      }, scopeId);
    }
  }
}

function findClosingBrace(sourceLines, startIndex) {
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = startIndex; index < sourceLines.length; index += 1) {
    for (const character of stripCommentsAndStrings(sourceLines[index])) {
      if (character === "{") {
        depth += 1;
        sawOpeningBrace = true;
      } else if (character === "}") {
        depth -= 1;

        if (sawOpeningBrace && depth === 0) {
          return index + 1;
        }
      }
    }
  }

  return startIndex + 1;
}

function analyzeControlFlow(sourceLines) {
  const loops = new Map();
  const conditions = new Map();

  sourceLines.forEach((sourceLine, index) => {
    const inspectable = stripCommentsAndStrings(sourceLine).trim();
    const line = index + 1;

    const loopMatch = inspectable.match(/^(for|while)\s*\((.*)\)\s*\{/);

    if (loopMatch) {
      loops.set(line, {
        line,
        type: loopMatch[1],
        expression: loopMatch[2].trim(),
        endLine: findClosingBrace(sourceLines, index)
      });
    }

    const conditionMatch = inspectable.match(/^if\s*\((.*)\)\s*\{/);

    if (conditionMatch) {
      conditions.set(line, {
        line,
        expression: conditionMatch[1].trim(),
        endLine: findClosingBrace(sourceLines, index)
      });
    }
  });

  return { loops, conditions };
}

function createControlFlowTracker(sourceLines) {
  const analysis = analyzeControlFlow(sourceLines);
  const loopStates = new Map();

  return {
    observeLine(recorder, previousLine, currentLine, scopeId) {
      const currentLoop = analysis.loops.get(currentLine);

      if (currentLoop && !loopStates.has(currentLine)) {
        loopStates.set(currentLine, {
          iteration: 0,
          active: true,
          scopeId
        });

        record(recorder, EVENT_TYPES.LOOP_START, currentLine, {
          loopId: `line:${currentLine}`,
          loopType: currentLoop.type
        }, scopeId);
      }

      const previousLoop = analysis.loops.get(previousLine);

      if (previousLoop) {
        const loopState = loopStates.get(previousLine) || {
          iteration: 0,
          active: true,
          scopeId
        };
        const entersBody = currentLine > previousLoop.line && currentLine < previousLoop.endLine;

        record(recorder, EVENT_TYPES.LOOP_CONDITION, previousLine, {
          loopId: `line:${previousLine}`,
          expression: previousLoop.expression,
          result: entersBody
        }, scopeId);

        if (entersBody) {
          loopState.iteration += 1;
          loopStates.set(previousLine, loopState);

          record(recorder, EVENT_TYPES.LOOP_ITERATION, previousLine, {
            loopId: `line:${previousLine}`,
            iteration: loopState.iteration
          }, scopeId);
        } else if (loopState.active) {
          loopState.active = false;

          record(recorder, EVENT_TYPES.LOOP_END, previousLine, {
            loopId: `line:${previousLine}`,
            iterations: loopState.iteration
          }, scopeId);
        }
      }

      const previousCondition = analysis.conditions.get(previousLine);

      if (previousCondition) {
        const enteredIfBranch = (
          currentLine > previousCondition.line &&
          currentLine < previousCondition.endLine
        );

        record(recorder, EVENT_TYPES.CONDITION_EVALUATE, previousLine, {
          expression: previousCondition.expression,
          result: enteredIfBranch
        }, scopeId);

        record(recorder, EVENT_TYPES.BRANCH_ENTER, previousLine, {
          branch: enteredIfBranch ? "if" : "else",
          reason: enteredIfBranch
            ? "The Java execution entered the if branch."
            : "The Java execution skipped the if branch."
        }, scopeId);
      }
    },

    close(recorder, line, scopeId) {
      for (const [loopLine, loopState] of loopStates) {
        if (loopState.active && loopState.scopeId === scopeId) {
          const loop = analysis.loops.get(loopLine);

          record(recorder, EVENT_TYPES.LOOP_CONDITION, loopLine, {
            loopId: `line:${loopLine}`,
            expression: loop.expression,
            result: false
          }, scopeId);

          record(recorder, EVENT_TYPES.LOOP_END, loopLine, {
            loopId: `line:${loopLine}`,
            iterations: loopState.iteration
          }, scopeId);

          loopState.active = false;
        }
      }
    }
  };
}

function createFailedTrace(traceId, line, name, message) {
  const recorder = new TraceRecorder({
    language: "java",
    traceId,
    maxEvents: DEFAULT_MAX_TRACE_EVENTS,
    metadata: {
      adapter: "java-jdi",
      sourceFile: "Main.java",
      executionMode: "local-trusted-child-process"
    }
  });

  recorder.start(
    { sourceFile: "Main.java", message: "Java compilation started." },
    { source: { line: 1 } }
  );

  recorder.fail(
    { name, errorType: name, message },
    { source: { line } }
  );

  return recorder.toJSON();
}

function parseCompilerFailure(stderr, sourceFileName) {
  const escapedFileName = sourceFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stderr.match(
    new RegExp(`${escapedFileName}:(\\d+):\\s*error:\\s*([^\\r\\n]+)`, "i")
  );

  return {
    line: match ? Number(match[1]) : 1,
    message: match
      ? match[2].trim()
      : stderr.trim().split(/\r?\n/)[0] || "Java compilation failed."
  };
}

function buildJavaTrace(rawObservations, options) {
  if (typeof rawObservations !== "string" || rawObservations.trim() === "") {
    throw new JavaExecutionError(
      "Java debugger returned an empty observation stream.",
      502,
      "INVALID_JAVA_TRACE"
    );
  }

  const recorder = new TraceRecorder({
    language: "java",
    traceId: options.traceId,
    maxEvents: options.maximumTraceEvents,
    metadata: {
      adapter: "java-jdi",
      sourceFile: `${options.className}.java`,
      executionMode: "local-trusted-child-process"
    }
  });

  recorder.start(
    { sourceFile: `${options.className}.java`, message: "Java execution started." },
    { source: { line: 1 } }
  );

  const frameStates = new Map();
  const logicalQueues = new Map();
  const logicalLinkedLists = new Map();
  const logicalHashMaps = new Map();
  const controlFlow = createControlFlowTracker(options.sourceLines);
  const observations = rawObservations.trim().split(/\r?\n/).filter(Boolean);

  let lastObservedLine = 1;
  let sawStart = false;
  let sawEnd = false;
  let endStatus = "completed";

  for (const observation of observations) {
    const fields = observation.split("\t");
    const observationType = fields[0];

    if (observationType === "START") {
      sawStart = true;
      continue;
    }

    if (observationType === "METHOD_ENTER") {
      const frameId = fields[1];
      const methodLine = parsePositiveLine(fields[2], lastObservedLine);
      const callerLine = parsePositiveLine(fields[3], methodLine);
      const functionName = decode(fields[4]);
      const locals = decodeLocals(fields[5]);
      const scopeId = functionName === "main" ? null : frameId;

      if (functionName !== "main") {
        record(recorder, EVENT_TYPES.FUNCTION_CALL, callerLine, {
          name: functionName,
          functionName,
          arguments: Object.values(locals).map((variable) => structuredClone(variable.value))
        }, frameStates.get(fields[1])?.scopeId || null);
      }

      record(recorder, EVENT_TYPES.FUNCTION_ENTER, methodLine, {
        name: functionName,
        functionName,
        frameId,
        parameters: Object.fromEntries(
          Object.entries(locals).map(([name, variable]) => [
            name,
            structuredClone(variable.value)
          ])
        )
      }, scopeId);

      for (const [name, variable] of Object.entries(locals)) {
        emitVariableDeclare(recorder, name, variable, methodLine, scopeId);
      }

      frameStates.set(frameId, {
        functionName,
        locals,
        lastLine: methodLine,
        scopeId
      });

      lastObservedLine = methodLine;
      continue;
    }

    if (observationType === "LINE") {
      const frameId = fields[1];
      const line = parsePositiveLine(fields[2], lastObservedLine);
      const functionName = decode(fields[3]);
      const locals = decodeLocals(fields[4]);

      const frameState = frameStates.get(frameId) || {
        functionName,
        locals: {},
        lastLine: line,
        scopeId: frameId
      };

      emitLocalChanges(
        recorder,
        frameState.locals,
        locals,
        frameState.lastLine,
        frameState.scopeId
      );

      processCollectionStatement(
        recorder,
        options.sourceLines[frameState.lastLine - 1] || "",
        frameState.lastLine,
        frameState.locals,
        frameState.scopeId,
        logicalQueues,
        logicalLinkedLists,
        logicalHashMaps
      );

      controlFlow.observeLine(
        recorder,
        frameState.lastLine,
        line,
        frameState.scopeId
      );

      record(recorder, EVENT_TYPES.STATEMENT_EXECUTE, line, {
        functionName,
        statementKind: "java-line"
      }, frameState.scopeId);

      frameState.functionName = functionName;
      frameState.locals = locals;
      frameState.lastLine = line;
      frameStates.set(frameId, frameState);
      lastObservedLine = line;
      continue;
    }

    if (observationType === "METHOD_EXIT") {
      const frameId = fields[1];
      const line = parsePositiveLine(fields[2], lastObservedLine);
      const functionName = decode(fields[3]);
      const returnType = decode(fields[4]);
      const returnValue = decodeValue(returnType, fields[5]);
      const locals = decodeLocals(fields[6]);
      const frameState = frameStates.get(frameId);

      if (frameState) {
        emitLocalChanges(
          recorder,
          frameState.locals,
          locals,
          frameState.lastLine,
          frameState.scopeId
        );

        processCollectionStatement(
          recorder,
          options.sourceLines[frameState.lastLine - 1] || "",
          frameState.lastLine,
          frameState.locals,
          frameState.scopeId,
          logicalQueues,
          logicalLinkedLists,
          logicalHashMaps
        );

        controlFlow.close(recorder, frameState.lastLine, frameState.scopeId);
      }

      record(recorder, EVENT_TYPES.FUNCTION_RETURN, line, {
        name: functionName,
        functionName,
        value: returnValue,
        returnValue
      }, frameId);

      frameStates.delete(frameId);
      lastObservedLine = line;
      continue;
    }

    if (observationType === "OUTPUT") {
      record(recorder, EVENT_TYPES.OUTPUT, lastObservedLine, {
        channel: decode(fields[1]),
        text: decode(fields[2])
      });
      continue;
    }

    if (observationType === "ERROR") {
      const line = parsePositiveLine(fields[1], lastObservedLine);

      recorder.fail({
        name: decode(fields[2]),
        errorType: decode(fields[2]),
        message: decode(fields[3])
      }, { source: { line } });

      lastObservedLine = line;
      break;
    }

    if (observationType === "TRACER_FAILURE") {
      throw new JavaExecutionError(
        `${decode(fields[1])}: ${decode(fields[2])}`,
        502,
        "JAVA_DEBUGGER_FAILURE"
      );
    }

    if (observationType === "END") {
      endStatus = fields[1] || "completed";
      sawEnd = true;
      continue;
    }

    throw new JavaExecutionError(
      `Unknown Java observation type: ${observationType}`,
      502,
      "INVALID_JAVA_TRACE"
    );
  }

  if (!sawStart) {
    throw new JavaExecutionError(
      "Java observation stream is missing START.",
      502,
      "INVALID_JAVA_TRACE"
    );
  }

  if (recorder.status !== "failed") {
    if (!sawEnd) {
      throw new JavaExecutionError(
        "Java observation stream is missing END.",
        502,
        "INVALID_JAVA_TRACE"
      );
    }

    if (endStatus === "completed") {
      recorder.finish(
        { status: "completed", message: "Java execution completed." },
        { source: { line: lastObservedLine } }
      );
    } else {
      recorder.fail(
        { name: "JavaRuntimeError", errorType: "JavaRuntimeError", message: "Java execution terminated unsuccessfully." },
        { source: { line: lastObservedLine } }
      );
    }
  }

  const trace = recorder.toJSON();
  assertValidTrace(trace);
  return trace;
}

function createExecutionResponse(trace, startedAt) {
  const reconstructor = new StateReconstructor(trace, { checkpointInterval: 10 });
  const states = reconstructor.reconstructAll();
  const finalState = states.at(-1);

  return {
    status: "ok",
    language: "java",
    executionStatus: trace.status,
    trace,
    states,
    summary: {
      eventCount: trace.eventCount,
      executionTimeMs: Date.now() - startedAt,
      outputCount: finalState?.console?.length ?? 0,
      errorCount: finalState?.errors?.length ?? 0,
      finalStep: finalState?.step ?? -1
    },
    security: {
      mode: "local-trusted-development",
      dedicatedChildProcess: true,
      productionSandboxAvailable: false
    }
  };
}

async function executeJava(source, options = {}) {
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new JavaExecutionError(
      "Java source must be a non-empty string.",
      400,
      "INVALID_SOURCE"
    );
  }

  const startedAt = Date.now();
  const sourceInfo = inspectJavaSource(source);
  const traceId = options.traceId || `java:${randomUUID()}`;
  const configuration = {
    javaExecutable: options.javaExecutable || process.env.CODEFLOW_JAVA_EXECUTABLE || DEFAULT_JAVA_EXECUTABLE,
    javacExecutable: options.javacExecutable || process.env.CODEFLOW_JAVAC_EXECUTABLE || DEFAULT_JAVAC_EXECUTABLE,
    processTimeoutMs: options.processTimeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS,
    maximumTraceEvents: options.maximumTraceEvents ?? DEFAULT_MAX_TRACE_EVENTS,
    maximumResultBytes: options.maximumResultBytes ?? DEFAULT_MAX_RESULT_BYTES,
    maximumCompilerOutputBytes: options.maximumCompilerOutputBytes ?? DEFAULT_MAX_COMPILER_OUTPUT_BYTES
  };

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-java-"));
  const sourceFileName = `${sourceInfo.className}.java`;
  const sourcePath = path.join(workspace, sourceFileName);
  const debuggerSourcePath = path.join(__dirname, "CodeFlowJavaDebugger.java");

  try {
    await fs.writeFile(sourcePath, source, "utf8");

    const compilation = await runProcess(
      configuration.javacExecutable,
      [
        "--add-modules",
        "jdk.jdi",
        "-encoding",
        "UTF-8",
        "-g",
        "-d",
        workspace,
        debuggerSourcePath,
        sourcePath
      ],
      {
        cwd: workspace,
        timeoutMs: configuration.processTimeoutMs,
        maximumOutputBytes: configuration.maximumCompilerOutputBytes,
        killProcessTree: false
      }
    );

    if (compilation.exitCode !== 0) {
      const compilerFailure = parseCompilerFailure(compilation.stderr, sourceFileName);
      const trace = createFailedTrace(
        traceId,
        compilerFailure.line,
        "CompilationError",
        compilerFailure.message
      );

      return createExecutionResponse(trace, startedAt);
    }

    const execution = await runProcess(
      configuration.javaExecutable,
      [
        "--add-modules",
        "jdk.jdi",
        "-cp",
        workspace,
        "CodeFlowJavaDebugger",
        workspace,
        sourceInfo.className
      ],
      {
        cwd: workspace,
        timeoutMs: configuration.processTimeoutMs,
        maximumOutputBytes: configuration.maximumResultBytes,
        killProcessTree: true
      }
    );

    if (execution.exitCode !== 0 && !execution.stdout.trim()) {
      throw new JavaExecutionError(
        execution.stderr.trim() || "Java debugger exited unsuccessfully.",
        500,
        "JAVA_DEBUGGER_FAILURE"
      );
    }

    const trace = buildJavaTrace(execution.stdout, {
      traceId,
      className: sourceInfo.className,
      sourceLines: sourceInfo.sourceLines,
      maximumTraceEvents: configuration.maximumTraceEvents
    });

    return createExecutionResponse(trace, startedAt);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

module.exports = {
  DEFAULT_JAVA_EXECUTABLE,
  DEFAULT_JAVAC_EXECUTABLE,
  DEFAULT_PROCESS_TIMEOUT_MS,
  DEFAULT_MAX_TRACE_EVENTS,
  DEFAULT_MAX_RESULT_BYTES,
  DEFAULT_MAX_COMPILER_OUTPUT_BYTES,
  JavaExecutionError,
  inspectJavaSource,
  buildJavaTrace,
  executeJava
};
