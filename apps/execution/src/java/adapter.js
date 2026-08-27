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
  "java.util.PriorityQueue",
  "java.util.Stack",
  "java.util.TreeSet"
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

  if (
    variable.valueType === "object" &&
    /(?:^|\.)TreeSet$/.test(variable.value?.display || "")
  ) {
    record(recorder, EVENT_TYPES.TREE_CREATE, line, {
      name,
      treeName: name,
      nodes: [],
      rootId: null
    }, scopeId);
  }

  if (
    variable.valueType === "object" &&
    /(?:^|\.)PriorityQueue$/.test(variable.value?.display || "")
  ) {
    record(recorder, EVENT_TYPES.HEAP_CREATE, line, {
      name,
      heapName: name,
      heapType: "min",
      values: []
    }, scopeId);
  }

  if (
    variable.valueType === "object" &&
    /(?:^|\.)Graph$/.test(variable.value?.display || "")
  ) {
    record(recorder, EVENT_TYPES.GRAPH_CREATE, line, {
      name,
      graphName: name,
      directed: false,
      nodes: [],
      edges: []
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

function compareTreeValues(left, right) {
  if (typeof left === "number" && typeof right === "number") {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  const leftText = String(left);
  const rightText = String(right);
  return leftText === rightText ? 0 : leftText < rightText ? -1 : 1;
}

function insertLogicalTree(tree, value) {
  const node = {
    id: `tree-node:${++tree.nextNodeNumber}`,
    value: structuredClone(value),
    leftId: null,
    rightId: null,
    parentId: null
  };
  const path = [];

  if (!tree.rootId) {
    tree.rootId = node.id;
    tree.nodes.push(node);
    path.push(node.id);
    return { inserted: true, insertedNodeId: node.id, path };
  }

  let current = tree.nodes.find((item) => item.id === tree.rootId);

  while (current) {
    path.push(current.id);
    const comparison = compareTreeValues(value, current.value);

    if (comparison === 0) {
      tree.nextNodeNumber -= 1;
      return { inserted: false, insertedNodeId: null, path };
    }

    const property = comparison < 0 ? "leftId" : "rightId";

    if (!current[property]) {
      node.parentId = current.id;
      current[property] = node.id;
      tree.nodes.push(node);
      path.push(node.id);
      return { inserted: true, insertedNodeId: node.id, path };
    }

    current = tree.nodes.find((item) => item.id === current[property]);
  }

  return { inserted: false, insertedNodeId: null, path };
}

function searchLogicalTree(tree, target) {
  const path = [];
  let current = tree.nodes.find((item) => item.id === tree.rootId);

  while (current) {
    path.push(current.id);
    const comparison = compareTreeValues(target, current.value);

    if (comparison === 0) {
      return { found: true, foundNodeId: current.id, path };
    }

    current = tree.nodes.find((item) => (
      item.id === (comparison < 0 ? current.leftId : current.rightId)
    ));
  }

  return { found: false, foundNodeId: null, path };
}

function traverseLogicalTree(tree) {
  const order = [];
  const visitedIds = [];

  function visit(nodeId) {
    if (!nodeId) {
      return;
    }

    const node = tree.nodes.find((item) => item.id === nodeId);

    if (!node) {
      return;
    }

    visit(node.leftId);
    visitedIds.push(node.id);
    order.push(structuredClone(node.value));
    visit(node.rightId);
  }

  visit(tree.rootId);
  return { order, visitedIds };
}

function insertLogicalHeap(values, value) {
  values.push(structuredClone(value));
  let index = values.length - 1;
  const steps = [{ kind: "insert", index, values: structuredClone(values) }];

  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);

    if (compareTreeValues(values[parentIndex], values[index]) <= 0) {
      break;
    }

    [values[parentIndex], values[index]] = [values[index], values[parentIndex]];
    steps.push({
      kind: "swap",
      fromIndex: index,
      toIndex: parentIndex,
      values: structuredClone(values)
    });
    index = parentIndex;
  }

  return steps;
}

function extractLogicalHeap(values) {
  if (values.length === 0) {
    return { value: null, steps: [{ kind: "extract", values: [] }] };
  }

  const value = values[0];
  const last = values.pop();

  if (values.length > 0) {
    values[0] = last;
  }

  const steps = [{ kind: "extract", index: 0, values: structuredClone(values) }];
  let index = 0;

  while (index < values.length) {
    const leftIndex = index * 2 + 1;
    const rightIndex = index * 2 + 2;
    let smallestIndex = index;

    if (
      leftIndex < values.length &&
      compareTreeValues(values[leftIndex], values[smallestIndex]) < 0
    ) {
      smallestIndex = leftIndex;
    }

    if (
      rightIndex < values.length &&
      compareTreeValues(values[rightIndex], values[smallestIndex]) < 0
    ) {
      smallestIndex = rightIndex;
    }

    if (smallestIndex === index) {
      break;
    }

    [values[index], values[smallestIndex]] = [values[smallestIndex], values[index]];
    steps.push({
      kind: "swap",
      fromIndex: index,
      toIndex: smallestIndex,
      values: structuredClone(values)
    });
    index = smallestIndex;
  }

  return { value: structuredClone(value), steps };
}

function recordLogicalHeapSteps(recorder, line, scopeId, name, eventType, value, steps, reason) {
  const [firstStep, ...swapSteps] = steps;
  const basePayload = {
    name,
    heapName: name,
    heapType: "min"
  };

  record(recorder, eventType, line, {
    ...basePayload,
    value: structuredClone(value),
    index: firstStep?.index ?? 0,
    values: structuredClone(firstStep?.values || []),
    activeIndices: firstStep?.values?.length ? [firstStep.index ?? 0] : []
  }, scopeId);

  for (const step of swapSteps) {
    record(recorder, EVENT_TYPES.HEAP_SWAP, line, {
      ...basePayload,
      fromIndex: step.fromIndex,
      toIndex: step.toIndex,
      values: structuredClone(step.values),
      reason
    }, scopeId);
  }
}

function addLogicalGraphNode(graph, value) {
  const existing = graph.nodes.find((node) => node.value === value);

  if (existing) {
    return { node: existing, inserted: false };
  }

  const node = { id: `graph-node:${graph.nodes.length + 1}`, value };
  graph.nodes.push(node);
  graph.adjacency.set(value, []);
  return { node, inserted: true };
}

function addLogicalGraphEdge(graph, source, target) {
  const sourceNode = addLogicalGraphNode(graph, source).node;
  const targetNode = addLogicalGraphNode(graph, target).node;
  const existing = graph.edges.find((edge) => (
    (edge.sourceId === sourceNode.id && edge.targetId === targetNode.id) ||
    (edge.sourceId === targetNode.id && edge.targetId === sourceNode.id)
  ));

  if (existing) {
    return { edge: existing, inserted: false };
  }

  const edge = {
    id: `graph-edge:${graph.edges.length + 1}`,
    sourceId: sourceNode.id,
    targetId: targetNode.id
  };
  graph.edges.push(edge);
  graph.adjacency.get(source).push(target);

  if (source !== target) {
    graph.adjacency.get(target).push(source);
  }

  return { edge, inserted: true };
}

function traverseLogicalGraph(graph, start, traversalType) {
  const pending = [{ value: start, from: null }];
  const queued = new Set([start]);
  const visited = new Set();
  const steps = [];
  const order = [];

  while (pending.length > 0) {
    const current = traversalType === "dfs" ? pending.pop() : pending.shift();

    if (visited.has(current.value)) {
      continue;
    }

    const node = graph.nodes.find((item) => item.value === current.value);

    if (!node) {
      continue;
    }

    if (current.from !== null) {
      const previous = graph.nodes.find((item) => item.value === current.from);
      const edge = graph.edges.find((item) => (
        (item.sourceId === previous.id && item.targetId === node.id) ||
        (item.sourceId === node.id && item.targetId === previous.id)
      ));

      if (edge) {
        steps.push({
          kind: "edge",
          edgeId: edge.id,
          sourceId: previous.id,
          targetId: node.id
        });
      }
    }

    visited.add(current.value);
    order.push(node.value);
    steps.push({
      kind: "visit",
      nodeId: node.id,
      value: node.value,
      visitedIds: order.map((value) => graph.nodes.find((item) => item.value === value).id)
    });

    const neighbors = graph.adjacency.get(current.value) || [];
    const candidates = traversalType === "dfs" ? [...neighbors].reverse() : neighbors;

    for (const neighbor of candidates) {
      if (!visited.has(neighbor) && !queued.has(neighbor)) {
        pending.push({ value: neighbor, from: current.value });
        queued.add(neighbor);
      }
    }
  }

  return { steps, order, visitedIds: steps.filter((step) => step.kind === "visit").map((step) => step.nodeId) };
}

function recordSearchAlgorithm(
  recorder,
  algorithm,
  arrayName,
  values,
  target,
  line,
  scopeId,
  logicalSearches
) {
  logicalSearches.nextId += 1;

  const searchId = `search:${logicalSearches.nextId}`;
  const comparedIndices = [];
  const eliminatedIndices = [];
  let low = 0;
  let high = values.length - 1;
  let foundIndex = -1;

  function payload(extra = {}) {
    return {
      searchId,
      algorithm,
      arrayName,
      values: structuredClone(values),
      target,
      low,
      high,
      middle: algorithm === "binary" && low <= high
        ? low + Math.floor((high - low) / 2)
        : null,
      comparedIndices: [...comparedIndices],
      eliminatedIndices: [...eliminatedIndices],
      comparisonCount: comparedIndices.length,
      ...extra
    };
  }

  record(recorder, EVENT_TYPES.SEARCH_START, line, payload(), scopeId);

  while (low <= high) {
    const index = algorithm === "binary"
      ? low + Math.floor((high - low) / 2)
      : low;
    const value = values[index];

    comparedIndices.push(index);

    record(recorder, EVENT_TYPES.SEARCH_COMPARE, line, payload({
      index,
      value,
      matched: value === target,
      middle: algorithm === "binary" ? index : null
    }), scopeId);

    if (value === target) {
      foundIndex = index;
      record(recorder, EVENT_TYPES.SEARCH_FOUND, line, payload({
        index,
        value,
        found: true,
        foundIndex
      }), scopeId);
      break;
    }

    if (algorithm === "binary") {
      if (value < target) {
        for (let eliminated = low; eliminated <= index; eliminated++) {
          eliminatedIndices.push(eliminated);
        }
        low = index + 1;
      } else {
        for (let eliminated = index; eliminated <= high; eliminated++) {
          eliminatedIndices.push(eliminated);
        }
        high = index - 1;
      }
    } else {
      eliminatedIndices.push(index);
      low = index + 1;
    }

    record(recorder, EVENT_TYPES.SEARCH_RANGE_UPDATE, line, payload({
      previousIndex: index
    }), scopeId);
  }

  if (foundIndex < 0) {
    record(recorder, EVENT_TYPES.SEARCH_NOT_FOUND, line, payload({
      found: false,
      foundIndex: -1
    }), scopeId);
  }

  record(recorder, EVENT_TYPES.SEARCH_END, line, payload({
    found: foundIndex >= 0,
    foundIndex
  }), scopeId);
}

function recordSortAlgorithm(recorder, algorithm, arrayName, originalValues, line, scopeId, logicalSorts) {
  logicalSorts.nextId += 1;

  const sortId = `sort:${logicalSorts.nextId}`;
  const values = structuredClone(originalValues);
  const initialValues = structuredClone(originalValues);
  const sorted = new Set();
  let comparisonCount = 0;
  let swapCount = 0;
  let writeCount = 0;
  let pass = 0;

  function emit(type, extra = {}) {
    record(recorder, type, line, {
      sortId,
      algorithm,
      arrayName,
      values: structuredClone(values),
      initialValues,
      comparisonCount,
      swapCount,
      writeCount,
      pass,
      sortedIndices: [...sorted].sort((left, right) => left - right),
      compareIndices: [],
      swapIndices: [],
      activeIndex: null,
      minIndex: null,
      keyIndex: null,
      rangeStart: 0,
      rangeEnd: values.length - 1,
      middle: null,
      depth: 0,
      pivotIndex: null,
      pivotValue: null,
      leftRange: null,
      rightRange: null,
      partitionIndex: null,
      phase: "start",
      ...extra
    }, scopeId);
  }

  function compare(left, right, extra = {}) {
    comparisonCount += 1;
    emit(EVENT_TYPES.SORT_COMPARE, {
      compareIndices: [left, right],
      activeIndex: right,
      leftValue: values[left],
      rightValue: values[right],
      ...extra
    });
  }

  function swap(left, right, extra = {}) {
    [values[left], values[right]] = [values[right], values[left]];
    swapCount += 1;
    emit(EVENT_TYPES.SORT_SWAP, {
      compareIndices: [left, right],
      swapIndices: [left, right],
      activeIndex: right,
      ...extra
    });
  }

  emit(EVENT_TYPES.SORT_START);

  if (algorithm === "bubble") {
    for (let boundary = values.length - 1; boundary > 0; boundary -= 1) {
      pass += 1;
      let changed = false;

      for (let index = 0; index < boundary; index += 1) {
        compare(index, index + 1);

        if (values[index] > values[index + 1]) {
          swap(index, index + 1);
          changed = true;
        }
      }

      sorted.add(boundary);
      emit(EVENT_TYPES.SORT_MARK_SORTED, { activeIndex: boundary });
      emit(EVENT_TYPES.SORT_PASS, { boundary, changed });

      if (!changed) {
        break;
      }
    }
  } else if (algorithm === "selection") {
    for (let start = 0; start < values.length - 1; start += 1) {
      pass += 1;
      let minimum = start;

      for (let index = start + 1; index < values.length; index += 1) {
        compare(minimum, index, { minIndex: minimum });

        if (values[index] < values[minimum]) {
          minimum = index;
          emit(EVENT_TYPES.SORT_COMPARE, {
            compareIndices: [start, index],
            activeIndex: index,
            minIndex: minimum,
            candidateChanged: true
          });
        }
      }

      if (minimum !== start) {
        swap(start, minimum, { minIndex: minimum });
      }

      sorted.add(start);
      emit(EVENT_TYPES.SORT_MARK_SORTED, { activeIndex: start });
      emit(EVENT_TYPES.SORT_PASS, { boundary: start, minIndex: minimum });
    }
  } else if (algorithm === "insertion") {
    if (values.length > 0) {
      sorted.add(0);
    }

    for (let index = 1; index < values.length; index += 1) {
      pass += 1;
      const key = values[index];
      let cursor = index - 1;

      while (cursor >= 0) {
        comparisonCount += 1;
        emit(EVENT_TYPES.SORT_COMPARE, {
          compareIndices: [cursor, cursor + 1],
          activeIndex: cursor,
          keyIndex: cursor + 1,
          key,
          leftValue: values[cursor],
          rightValue: key
        });

        if (values[cursor] <= key) {
          break;
        }

        values[cursor + 1] = values[cursor];
        writeCount += 1;
        emit(EVENT_TYPES.SORT_WRITE, {
          compareIndices: [cursor, cursor + 1],
          activeIndex: cursor + 1,
          keyIndex: cursor + 1,
          writeIndex: cursor + 1,
          value: values[cursor],
          key,
          action: "shift"
        });
        cursor -= 1;
      }

      values[cursor + 1] = key;
      writeCount += 1;
      emit(EVENT_TYPES.SORT_WRITE, {
        activeIndex: cursor + 1,
        keyIndex: cursor + 1,
        writeIndex: cursor + 1,
        value: key,
        key,
        action: "insert"
      });

      for (let sortedIndex = 0; sortedIndex <= index; sortedIndex += 1) {
        sorted.add(sortedIndex);
      }

      emit(EVENT_TYPES.SORT_MARK_SORTED, { activeIndex: index, keyIndex: cursor + 1 });
      emit(EVENT_TYPES.SORT_PASS, { boundary: index });
    }
  } else if (algorithm === "merge") {
    function mergeRange(start, end, depth) {
      if (start >= end) {
        return;
      }

      const middle = Math.floor((start + end) / 2);
      const splitContext = {
        rangeStart: start,
        rangeEnd: end,
        middle,
        depth,
        leftRange: [start, middle],
        rightRange: [middle + 1, end],
        phase: "split"
      };
      emit(EVENT_TYPES.SORT_SPLIT, splitContext);
      mergeRange(start, middle, depth + 1);
      mergeRange(middle + 1, end, depth + 1);

      const left = values.slice(start, middle + 1);
      const right = values.slice(middle + 1, end + 1);
      let leftIndex = 0;
      let rightIndex = 0;
      let cursor = start;
      const mergeContext = { ...splitContext, phase: "merge" };

      while (leftIndex < left.length && rightIndex < right.length) {
        comparisonCount += 1;
        emit(EVENT_TYPES.SORT_COMPARE, {
          ...mergeContext,
          compareIndices: [start + leftIndex, middle + 1 + rightIndex],
          activeIndex: cursor,
          leftValue: left[leftIndex],
          rightValue: right[rightIndex]
        });

        const nextValue = left[leftIndex] <= right[rightIndex]
          ? left[leftIndex++]
          : right[rightIndex++];
        values[cursor] = nextValue;
        writeCount += 1;
        emit(EVENT_TYPES.SORT_WRITE, {
          ...mergeContext,
          activeIndex: cursor,
          writeIndex: cursor,
          value: nextValue,
          action: "merge"
        });
        cursor += 1;
      }

      while (leftIndex < left.length) {
        values[cursor] = left[leftIndex];
        writeCount += 1;
        emit(EVENT_TYPES.SORT_WRITE, {
          ...mergeContext,
          activeIndex: cursor,
          writeIndex: cursor,
          value: left[leftIndex],
          action: "merge"
        });
        leftIndex += 1;
        cursor += 1;
      }

      while (rightIndex < right.length) {
        values[cursor] = right[rightIndex];
        writeCount += 1;
        emit(EVENT_TYPES.SORT_WRITE, {
          ...mergeContext,
          activeIndex: cursor,
          writeIndex: cursor,
          value: right[rightIndex],
          action: "merge"
        });
        rightIndex += 1;
        cursor += 1;
      }

      pass += 1;
      emit(EVENT_TYPES.SORT_MERGE, { ...mergeContext, activeIndex: end });
      emit(EVENT_TYPES.SORT_PASS, { ...mergeContext, boundary: end });
    }

    mergeRange(0, values.length - 1, 0);
  } else if (algorithm === "quick") {
    function quickRange(start, end, depth) {
      if (start > end) {
        return;
      }

      if (start === end) {
        sorted.add(start);
        emit(EVENT_TYPES.SORT_MARK_SORTED, {
          rangeStart: start,
          rangeEnd: end,
          depth,
          activeIndex: start,
          phase: "base"
        });
        return;
      }

      const pivotValue = values[end];
      const context = {
        rangeStart: start,
        rangeEnd: end,
        depth,
        pivotIndex: end,
        pivotValue,
        phase: "partition"
      };
      emit(EVENT_TYPES.SORT_PIVOT, { ...context, activeIndex: end });

      let boundary = start;
      for (let index = start; index < end; index += 1) {
        compare(index, end, { ...context, activeIndex: index });
        if (values[index] < pivotValue) {
          if (index !== boundary) {
            swap(index, boundary, { ...context, activeIndex: boundary });
          }
          boundary += 1;
        }
      }

      if (boundary !== end) {
        swap(boundary, end, {
          ...context,
          pivotIndex: boundary,
          activeIndex: boundary
        });
      }

      sorted.add(boundary);
      const partitionContext = {
        ...context,
        pivotIndex: boundary,
        partitionIndex: boundary,
        phase: "partitioned",
        leftRange: boundary > start ? [start, boundary - 1] : null,
        rightRange: boundary < end ? [boundary + 1, end] : null
      };
      emit(EVENT_TYPES.SORT_PARTITION, partitionContext);
      emit(EVENT_TYPES.SORT_MARK_SORTED, {
        ...partitionContext,
        activeIndex: boundary
      });
      pass += 1;
      emit(EVENT_TYPES.SORT_PASS, { ...partitionContext, boundary });

      quickRange(start, boundary - 1, depth + 1);
      quickRange(boundary + 1, end, depth + 1);
    }

    quickRange(0, values.length - 1, 0);
  }

  for (let index = 0; index < values.length; index += 1) {
    sorted.add(index);
  }

  emit(EVENT_TYPES.SORT_END, { finished: true });
}

function recordDynamicProgramming(
  recorder,
  algorithm,
  argumentsList,
  line,
  scopeId,
  logicalDynamicPrograms
) {
  logicalDynamicPrograms.nextId += 1;

  const dpId = `dp:${logicalDynamicPrograms.nextId}`;
  let table = [];
  let rowLabels = [];
  let columnLabels = [];
  let readCount = 0;
  let writeCount = 0;
  let cacheHitCount = 0;
  let cacheMissCount = 0;
  let choiceCount = 0;

  function emit(type, extra = {}) {
    record(recorder, type, line, {
      dpId,
      algorithm,
      table: structuredClone(table),
      dimension: table.length === 1 ? "1d" : "2d",
      rows: table.length,
      columns: table[0]?.length ?? 0,
      rowLabels: structuredClone(rowLabels),
      columnLabels: structuredClone(columnLabels),
      activeRow: null,
      activeColumn: null,
      readCells: [],
      writtenCell: null,
      decision: null,
      readCount,
      writeCount,
      cacheHitCount,
      cacheMissCount,
      choiceCount,
      finished: false,
      ...extra
    }, scopeId);
  }

  if (algorithm === "fibonacci-memo") {
    const n = Number(argumentsList[0]);
    table = [Array(n + 1).fill(null)];
    rowLabels = ["memo"];
    columnLabels = Array.from({ length: n + 1 }, (_, index) => `n=${index}`);
    emit(EVENT_TYPES.DP_START, { input: { n }, phase: "memoization" });

    function solve(index) {
      const cell = [0, index];
      if (table[0][index] !== null) {
        cacheHitCount += 1;
        readCount += 1;
        emit(EVENT_TYPES.DP_CACHE_HIT, {
          activeRow: 0,
          activeColumn: index,
          readCells: [cell],
          stateKey: index,
          value: table[0][index],
          phase: "memoization"
        });
        return table[0][index];
      }

      cacheMissCount += 1;
      emit(EVENT_TYPES.DP_CACHE_MISS, {
        activeRow: 0,
        activeColumn: index,
        stateKey: index,
        phase: "memoization"
      });
      let value;
      if (index <= 1) {
        value = index;
        choiceCount += 1;
        emit(EVENT_TYPES.DP_CHOICE, {
          activeRow: 0,
          activeColumn: index,
          decision: "base-case",
          candidates: [index],
          chosenValue: value,
          phase: "memoization"
        });
      } else {
        const previous = solve(index - 1);
        const beforePrevious = solve(index - 2);
        const readCells = [[0, index - 1], [0, index - 2]];
        readCount += 2;
        emit(EVENT_TYPES.DP_STATE_READ, {
          activeRow: 0,
          activeColumn: index,
          readCells,
          values: [previous, beforePrevious],
          phase: "memoization"
        });
        value = previous + beforePrevious;
        choiceCount += 1;
        emit(EVENT_TYPES.DP_CHOICE, {
          activeRow: 0,
          activeColumn: index,
          readCells,
          decision: "sum-subproblems",
          candidates: [previous, beforePrevious],
          chosenValue: value,
          phase: "memoization"
        });
      }

      table[0][index] = value;
      writeCount += 1;
      emit(EVENT_TYPES.DP_STATE_WRITE, {
        activeRow: 0,
        activeColumn: index,
        writtenCell: cell,
        stateKey: index,
        value,
        phase: "memoization"
      });
      return value;
    }

    const result = solve(n);
    emit(EVENT_TYPES.DP_ROW_COMPLETE, {
      activeRow: 0,
      completedRow: 0,
      phase: "memoization"
    });
    emit(EVENT_TYPES.DP_END, {
      result,
      resultCell: [0, n],
      finished: true,
      phase: "complete"
    });
    return;
  }

  if (algorithm === "fibonacci-tabulation") {
    const n = Number(argumentsList[0]);
    table = [Array(n + 1).fill(null)];
    rowLabels = ["table"];
    columnLabels = Array.from({ length: n + 1 }, (_, index) => `n=${index}`);
    emit(EVENT_TYPES.DP_START, { input: { n }, phase: "tabulation" });

    for (let index = 0; index <= Math.min(1, n); index += 1) {
      table[0][index] = index;
      writeCount += 1;
      emit(EVENT_TYPES.DP_STATE_WRITE, {
        activeRow: 0,
        activeColumn: index,
        writtenCell: [0, index],
        value: index,
        decision: "base-case",
        phase: "tabulation"
      });
    }

    for (let index = 2; index <= n; index += 1) {
      const previous = table[0][index - 1];
      const beforePrevious = table[0][index - 2];
      const readCells = [[0, index - 1], [0, index - 2]];
      readCount += 2;
      emit(EVENT_TYPES.DP_STATE_READ, {
        activeRow: 0,
        activeColumn: index,
        readCells,
        values: [previous, beforePrevious],
        phase: "tabulation"
      });
      const value = previous + beforePrevious;
      choiceCount += 1;
      emit(EVENT_TYPES.DP_CHOICE, {
        activeRow: 0,
        activeColumn: index,
        readCells,
        decision: "sum-previous",
        candidates: [previous, beforePrevious],
        chosenValue: value,
        phase: "tabulation"
      });
      table[0][index] = value;
      writeCount += 1;
      emit(EVENT_TYPES.DP_STATE_WRITE, {
        activeRow: 0,
        activeColumn: index,
        writtenCell: [0, index],
        value,
        phase: "tabulation"
      });
    }

    const result = table[0][n];
    emit(EVENT_TYPES.DP_ROW_COMPLETE, {
      activeRow: 0,
      completedRow: 0,
      phase: "tabulation"
    });
    emit(EVENT_TYPES.DP_END, {
      result,
      resultCell: [0, n],
      finished: true,
      phase: "complete"
    });
    return;
  }

  const [weights, values, rawCapacity] = argumentsList;
  const capacity = Number(rawCapacity);
  const itemCount = weights.length;
  table = Array.from(
    { length: itemCount + 1 },
    (_, row) => Array.from(
      { length: capacity + 1 },
      (_, column) => row === 0 || column === 0 ? 0 : null
    )
  );
  rowLabels = [
    "0 items",
    ...weights.map((weight, index) => `item ${index + 1} · w${weight} · v${values[index]}`)
  ];
  columnLabels = Array.from({ length: capacity + 1 }, (_, index) => `cap ${index}`);
  emit(EVENT_TYPES.DP_START, {
    input: { weights, values, capacity },
    phase: "tabulation"
  });

  for (let row = 1; row <= itemCount; row += 1) {
    const weight = weights[row - 1];
    const itemValue = values[row - 1];
    for (let column = 1; column <= capacity; column += 1) {
      const exclude = table[row - 1][column];
      const readCells = [[row - 1, column]];
      let include = null;
      if (weight <= column) {
        include = itemValue + table[row - 1][column - weight];
        readCells.push([row - 1, column - weight]);
      }
      readCount += readCells.length;
      emit(EVENT_TYPES.DP_STATE_READ, {
        activeRow: row,
        activeColumn: column,
        readCells,
        values: include === null ? [exclude] : [exclude, include],
        itemIndex: row - 1,
        itemWeight: weight,
        itemValue,
        phase: "tabulation"
      });
      const included = include !== null && include > exclude;
      const value = included ? include : exclude;
      const decision = included ? "include-item" : "exclude-item";
      choiceCount += 1;
      emit(EVENT_TYPES.DP_CHOICE, {
        activeRow: row,
        activeColumn: column,
        readCells,
        decision,
        candidates: include === null ? [exclude] : [exclude, include],
        chosenValue: value,
        itemIndex: row - 1,
        itemWeight: weight,
        itemValue,
        phase: "tabulation"
      });
      table[row][column] = value;
      writeCount += 1;
      emit(EVENT_TYPES.DP_STATE_WRITE, {
        activeRow: row,
        activeColumn: column,
        writtenCell: [row, column],
        value,
        decision,
        itemIndex: row - 1,
        phase: "tabulation"
      });
    }
    emit(EVENT_TYPES.DP_ROW_COMPLETE, {
      activeRow: row,
      completedRow: row,
      phase: "tabulation"
    });
  }

  const result = table[itemCount][capacity];
  emit(EVENT_TYPES.DP_END, {
    result,
    resultCell: [itemCount, capacity],
    finished: true,
    phase: "complete"
  });
}

function recordTowerOfHanoi(
  recorder,
  diskCount,
  line,
  scopeId,
  logicalHanoiRuns
) {
  logicalHanoiRuns.nextId += 1;
  const hanoiId = `hanoi:${logicalHanoiRuns.nextId}`;
  const expectedMoves = (2 ** diskCount) - 1;
  const pegs = {
    A: Array.from({ length: diskCount }, (_, index) => diskCount - index),
    B: [],
    C: []
  };
  const frames = [];
  let moveNumber = 0;
  let maxDepth = 0;

  function emit(type, extra = {}) {
    record(recorder, type, line, {
      hanoiId,
      diskCount,
      source: "A",
      target: "C",
      auxiliary: "B",
      pegs: structuredClone(pegs),
      frames: structuredClone(frames),
      moveNumber,
      expectedMoves,
      depth: frames.length,
      maxDepth,
      finished: false,
      ...extra
    }, scopeId);
  }

  function move(disk, from, to) {
    const removed = pegs[from].pop();
    const destinationTop = pegs[to].at(-1);
    if (removed !== disk || (destinationTop != null && destinationTop < disk)) {
      throw new Error("Invalid Tower of Hanoi move generated.");
    }
    pegs[to].push(disk);
    moveNumber += 1;
    emit(EVENT_TYPES.HANOI_MOVE, { disk, from, to, phase: "move" });
  }

  function solve(count, from, to, auxiliary, depth) {
    const frame = {
      id: `${hanoiId}:frame:${frames.length + 1}:${moveNumber}`,
      diskCount: count,
      from,
      to,
      auxiliary,
      depth,
      phase: "enter"
    };
    frames.push(frame);
    maxDepth = Math.max(maxDepth, depth);
    emit(EVENT_TYPES.HANOI_CALL, {
      disk: count,
      from,
      to,
      phase: "recursive-call"
    });

    if (count === 1) {
      frame.phase = "base-case";
      move(1, from, to);
    } else {
      solve(count - 1, from, auxiliary, to, depth + 1);
      frame.phase = "move-largest";
      move(count, from, to);
      frame.phase = "second-recursion";
      solve(count - 1, auxiliary, to, from, depth + 1);
    }

    frame.phase = "return";
    emit(EVENT_TYPES.HANOI_RETURN, {
      disk: count,
      from,
      to,
      phase: "return"
    });
    frames.pop();
  }

  emit(EVENT_TYPES.HANOI_START, { phase: "start" });
  solve(diskCount, "A", "C", "B", 1);
  emit(EVENT_TYPES.HANOI_END, {
    disk: null,
    from: null,
    to: null,
    depth: 0,
    frames: [],
    finished: true,
    phase: "complete"
  });
}

function resolveAlgorithmStatement(sourceLines, line) {
  const directSourceLine = sourceLines[line - 1] || "";
  let startIndex = Math.max(0, line - 1);

  while (startIndex > 0) {
    const previousLine = sourceLines[startIndex - 1]?.trim() || "";

    if (/[;{}]\s*$/.test(previousLine)) {
      break;
    }

    startIndex -= 1;
  }

  let endIndex = startIndex;
  const maximumEndIndex = Math.min(sourceLines.length - 1, startIndex + 24);

  while (
    endIndex < maximumEndIndex &&
    !/[;{}]\s*$/.test(sourceLines[endIndex] || "")
  ) {
    endIndex += 1;
  }

  const statement = sourceLines
    .slice(startIndex, endIndex + 1)
    .map((sourceLine) => sourceLine.trim())
    .join(" ");

  if (
    !statement.includes("DynamicProgramming.") &&
    !statement.includes("RecursionAlgorithms.")
  ) {
    return {
      sourceLine: directSourceLine,
      line
    };
  }

  return {
    sourceLine: statement,
    line: startIndex + 1
  };
}

function processCollectionStatement(
  recorder,
  sourceLine,
  line,
  locals,
  scopeId,
  logicalQueues,
  logicalLinkedLists,
  logicalHashMaps,
  logicalTrees,
  logicalHeaps,
  logicalGraphs,
  logicalSearches,
  logicalSorts,
  logicalDynamicPrograms,
  logicalHanoiRuns,
  currentLocals = locals
) {
  const match = sourceLine.match(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(push|add|addFirst|addLast|offer|pop|poll|remove|removeFirst|removeLast|get|getFirst|getLast|peek|element|put|putIfAbsent|containsKey|contains|toArray|addNode|addEdge|bfs|dfs|linearSearch|binarySearch|bubbleSort|selectionSort|insertionSort|mergeSort|quickSort|fibonacciMemo|fibonacciTabulation|knapsack01|towerOfHanoi)\s*\((.*?)\)\s*;/
  );

  if (!match) {
    return;
  }

  const [, name, method, expression] = match;

  if (name === "RecursionAlgorithms" && method === "towerOfHanoi") {
    const invocationKey = `${scopeId || "global"}:${line}:${method}:${expression}`;
    if (logicalHanoiRuns.processed.has(invocationKey)) {
      return;
    }

    const evaluationLocals = { ...locals, ...currentLocals };
    const diskCount = evaluateSimpleExpression(expression.trim(), evaluationLocals);
    if (Number.isInteger(diskCount) && diskCount >= 1 && diskCount <= 8) {
      logicalHanoiRuns.processed.add(invocationKey);
      recordTowerOfHanoi(
        recorder,
        diskCount,
        line,
        scopeId,
        logicalHanoiRuns
      );
    }
    return;
  }

  if (
    name === "DynamicProgramming" &&
    ["fibonacciMemo", "fibonacciTabulation", "knapsack01"].includes(method)
  ) {
    const assignment = sourceLine.match(
      /\b([A-Za-z_$][\w$]*)\s*=\s*DynamicProgramming\s*\./
    );
    const resultName = assignment?.[1] || null;

    // JDI can report the same caller line both when a static helper is entered
    // and when it returns. Track the source-level invocation so it is recorded
    // once while still supporting the first observation before assignment.
    const invocationKey = `${scopeId || "global"}:${line}:${method}:${resultName || expression}`;

    if (logicalDynamicPrograms.processed.has(invocationKey)) {
      return;
    }

    const evaluationLocals = {
      ...locals,
      ...currentLocals
    };
    const argumentsList = expression
      .split(",")
      .map((argument) => evaluateSimpleExpression(argument.trim(), evaluationLocals));
    const algorithms = {
      fibonacciMemo: "fibonacci-memo",
      fibonacciTabulation: "fibonacci-tabulation",
      knapsack01: "knapsack-01"
    };

    if (
      method !== "knapsack01" ||
      (Array.isArray(argumentsList[0]) && Array.isArray(argumentsList[1]))
    ) {
      logicalDynamicPrograms.processed.add(invocationKey);
      recordDynamicProgramming(
        recorder,
        algorithms[method],
        argumentsList,
        line,
        scopeId,
        logicalDynamicPrograms
      );
    }

    return;
  }

  if (
    name === "SortingAlgorithms" &&
    ["bubbleSort", "selectionSort", "insertionSort", "mergeSort", "quickSort"].includes(method)
  ) {
    const arrayExpression = expression.split(",")[0].trim();
    const values = locals[arrayExpression]?.value;

    if (Array.isArray(values)) {
      const algorithms = {
        bubbleSort: "bubble",
        selectionSort: "selection",
        insertionSort: "insertion",
        mergeSort: "merge",
        quickSort: "quick"
      };

      recordSortAlgorithm(
        recorder,
        algorithms[method],
        arrayExpression,
        values,
        line,
        scopeId,
        logicalSorts
      );
    }

    return;
  }

  if (
    name === "SearchAlgorithms" &&
    ["linearSearch", "binarySearch"].includes(method)
  ) {
    const [arrayExpression, targetExpression] = expression
      .split(",")
      .map((argument) => argument.trim());
    const values = locals[arrayExpression]?.value;

    if (Array.isArray(values)) {
      recordSearchAlgorithm(
        recorder,
        method === "linearSearch" ? "linear" : "binary",
        arrayExpression,
        values,
        evaluateSimpleExpression(targetExpression, locals),
        line,
        scopeId,
        logicalSearches
      );
    }

    return;
  }

  const lowerName = name.toLowerCase();

  if (
    logicalGraphs.has(name) ||
    /(?:^|\.)Graph$/.test(locals[name]?.value?.display || "")
  ) {
    const graph = logicalGraphs.get(name) || {
      nodes: [],
      edges: [],
      adjacency: new Map()
    };
    const argumentsList = expression.trim() === ""
      ? []
      : expression.split(",").map((item) => evaluateSimpleExpression(item.trim(), locals));

    if (method === "addNode") {
      const result = addLogicalGraphNode(graph, argumentsList[0]);
      logicalGraphs.set(name, graph);
      record(recorder, EVENT_TYPES.GRAPH_NODE_ADD, line, {
        name,
        graphName: name,
        directed: false,
        nodes: structuredClone(graph.nodes),
        edges: structuredClone(graph.edges),
        nodeId: result.node.id,
        value: result.node.value,
        inserted: result.inserted
      }, scopeId);
    } else if (method === "addEdge") {
      const result = addLogicalGraphEdge(graph, argumentsList[0], argumentsList[1]);
      logicalGraphs.set(name, graph);
      record(recorder, EVENT_TYPES.GRAPH_EDGE_ADD, line, {
        name,
        graphName: name,
        directed: false,
        nodes: structuredClone(graph.nodes),
        edges: structuredClone(graph.edges),
        edgeId: result.edge.id,
        sourceId: result.edge.sourceId,
        targetId: result.edge.targetId,
        inserted: result.inserted
      }, scopeId);
    } else if (method === "bfs" || method === "dfs") {
      const result = traverseLogicalGraph(graph, argumentsList[0], method);
      const payload = {
        name,
        graphName: name,
        directed: false,
        nodes: structuredClone(graph.nodes),
        edges: structuredClone(graph.edges),
        traversalType: method
      };

      for (const step of result.steps) {
        record(
          recorder,
          step.kind === "edge" ? EVENT_TYPES.GRAPH_EDGE_TRAVERSE : EVENT_TYPES.GRAPH_VISIT,
          line,
          { ...payload, ...step },
          scopeId
        );
      }

      record(recorder, EVENT_TYPES.GRAPH_TRAVERSE, line, {
        ...payload,
        visitedIds: result.visitedIds,
        order: result.order
      }, scopeId);
    }

    return;
  }

  if (
    logicalHeaps.has(name) ||
    /(?:^|\.)PriorityQueue$/.test(locals[name]?.value?.display || "")
  ) {
    const values = logicalHeaps.get(name) || [];

    if (["add", "offer"].includes(method)) {
      const value = evaluateSimpleExpression(expression.trim(), locals);
      const steps = insertLogicalHeap(values, value);
      logicalHeaps.set(name, values);
      recordLogicalHeapSteps(
        recorder,
        line,
        scopeId,
        name,
        EVENT_TYPES.HEAP_INSERT,
        value,
        steps,
        "bubble-up"
      );
    } else if (["poll", "remove"].includes(method)) {
      const extraction = extractLogicalHeap(values);
      logicalHeaps.set(name, values);
      recordLogicalHeapSteps(
        recorder,
        line,
        scopeId,
        name,
        EVENT_TYPES.HEAP_EXTRACT,
        extraction.value,
        extraction.steps,
        "bubble-down"
      );
    } else if (["peek", "element"].includes(method)) {
      record(recorder, EVENT_TYPES.HEAP_PEEK, line, {
        name,
        heapName: name,
        heapType: "min",
        value: structuredClone(values[0]),
        values: structuredClone(values),
        activeIndices: values.length > 0 ? [0] : []
      }, scopeId);
    }

    return;
  }

  if (
    logicalTrees.has(name) ||
    /(?:^|\.)TreeSet$/.test(locals[name]?.value?.display || "")
  ) {
    const tree = logicalTrees.get(name) || {
      nodes: [],
      rootId: null,
      nextNodeNumber: 0
    };
    const value = evaluateSimpleExpression(expression.trim(), locals);
    const payload = {
      name,
      treeName: name
    };

    if (method === "add") {
      const insertion = insertLogicalTree(tree, value);
      logicalTrees.set(name, tree);

      record(recorder, EVENT_TYPES.TREE_INSERT, line, {
        ...payload,
        value,
        ...insertion,
        nodes: structuredClone(tree.nodes),
        rootId: tree.rootId
      }, scopeId);
    } else if (method === "contains") {
      const search = searchLogicalTree(tree, value);

      record(recorder, EVENT_TYPES.TREE_SEARCH, line, {
        ...payload,
        target: value,
        ...search,
        nodes: structuredClone(tree.nodes),
        rootId: tree.rootId
      }, scopeId);
    } else if (method === "toArray") {
      const traversal = traverseLogicalTree(tree);

      record(recorder, EVENT_TYPES.TREE_TRAVERSE, line, {
        ...payload,
        traversalType: "inorder",
        ...traversal,
        nodes: structuredClone(tree.nodes),
        rootId: tree.rootId
      }, scopeId);
    }

    return;
  }

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
  const activeFrames = [];
  const logicalQueues = new Map();
  const logicalLinkedLists = new Map();
  const logicalHashMaps = new Map();
  const logicalTrees = new Map();
  const logicalHeaps = new Map();
  const logicalGraphs = new Map();
  const logicalSearches = { nextId: 0 };
  const logicalSorts = { nextId: 0 };
  const logicalDynamicPrograms = { nextId: 0, processed: new Set() };
  const logicalHanoiRuns = { nextId: 0, processed: new Set() };
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
      const callerFrame = activeFrames.at(-1) || null;
      const recursionDepth = 1 + activeFrames.filter(
        (frame) => frame.functionName === functionName
      ).length;
      const recursive = recursionDepth > 1;
      const parameters = Object.fromEntries(
        Object.entries(locals).map(([name, variable]) => [
          name,
          structuredClone(variable.value)
        ])
      );

      if (
        callerFrame &&
        callerFrame.functionName === functionName
      ) {
        callerFrame.recursiveChildren += 1;
      }

      if (functionName !== "main") {
        record(recorder, EVENT_TYPES.FUNCTION_CALL, callerLine, {
          name: functionName,
          functionName,
          arguments: Object.values(locals).map((variable) => structuredClone(variable.value)),
          callerFrameId: callerFrame?.scopeId || null,
          depth: activeFrames.length + 1,
          recursionDepth,
          recursive
        }, callerFrame?.scopeId || null);
      }

      record(recorder, EVENT_TYPES.FUNCTION_ENTER, methodLine, {
        name: functionName,
        functionName,
        frameId,
        callerFrameId: callerFrame?.scopeId || null,
        depth: activeFrames.length + 1,
        recursionDepth,
        recursive,
        parameters
      }, scopeId);

      for (const [name, variable] of Object.entries(locals)) {
        emitVariableDeclare(recorder, name, variable, methodLine, scopeId);
      }

      frameStates.set(frameId, {
        functionName,
        locals,
        lastLine: methodLine,
        scopeId,
        parameters,
        depth: activeFrames.length + 1,
        recursionDepth,
        recursive,
        recursiveChildren: 0
      });

      activeFrames.push(frameStates.get(frameId));

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

      const collectionStatement = resolveAlgorithmStatement(
        options.sourceLines,
        frameState.lastLine
      );

      processCollectionStatement(
        recorder,
        collectionStatement.sourceLine,
        collectionStatement.line,
        frameState.locals,
        frameState.scopeId,
        logicalQueues,
        logicalLinkedLists,
        logicalHashMaps,
        logicalTrees,
        logicalHeaps,
        logicalGraphs,
        logicalSearches,
        logicalSorts,
        logicalDynamicPrograms,
        logicalHanoiRuns,
        locals
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
      const activeFrameIndex = activeFrames.findLastIndex(
        (activeFrame) => activeFrame.scopeId === frameState?.scopeId &&
          activeFrame.functionName === functionName
      );
      const activeFrame = activeFrameIndex === -1
        ? frameState
        : activeFrames[activeFrameIndex];
      const callerFrame = activeFrameIndex > 0
        ? activeFrames[activeFrameIndex - 1]
        : null;

      if (frameState) {
        emitLocalChanges(
          recorder,
          frameState.locals,
          locals,
          frameState.lastLine,
          frameState.scopeId
        );

        const collectionStatement = resolveAlgorithmStatement(
          options.sourceLines,
          frameState.lastLine
        );

        processCollectionStatement(
          recorder,
          collectionStatement.sourceLine,
          collectionStatement.line,
          frameState.locals,
          frameState.scopeId,
          logicalQueues,
          logicalLinkedLists,
          logicalHashMaps,
          logicalTrees,
          logicalHeaps,
          logicalGraphs,
          logicalSearches,
          logicalSorts,
          logicalDynamicPrograms,
          logicalHanoiRuns,
          locals
        );

        controlFlow.close(recorder, frameState.lastLine, frameState.scopeId);
      }

      record(recorder, EVENT_TYPES.FUNCTION_RETURN, line, {
        name: functionName,
        functionName,
        frameId: activeFrame?.scopeId || frameId,
        callerFrameId: callerFrame?.scopeId || null,
        depth: activeFrame?.depth || activeFrames.length,
        recursionDepth: activeFrame?.recursionDepth || 1,
        recursive: Boolean(activeFrame?.recursive),
        baseCase: Boolean(
          activeFrame?.recursive &&
          activeFrame?.recursiveChildren === 0
        ),
        unwinding: Boolean(
          activeFrame?.recursive ||
          activeFrame?.recursiveChildren > 0
        ),
        value: returnValue,
        returnValue,
        parameters: activeFrame?.parameters || {}
      }, frameId);

      if (activeFrameIndex !== -1) {
        activeFrames.splice(activeFrameIndex, 1);
      }

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
  const graphSourcePath = path.join(__dirname, "CodeFlowGraph.java");
  const searchSourcePath = path.join(__dirname, "CodeFlowSearchAlgorithms.java");
  const sortSourcePath = path.join(__dirname, "CodeFlowSortingAlgorithms.java");
  const dynamicProgrammingSourcePath = path.join(
    __dirname,
    "CodeFlowDynamicProgramming.java"
  );
  const recursionAlgorithmsSourcePath = path.join(
    __dirname,
    "CodeFlowRecursionAlgorithms.java"
  );

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
        graphSourcePath,
        searchSourcePath,
        sortSourcePath,
        dynamicProgrammingSourcePath,
        recursionAlgorithmsSourcePath,
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
