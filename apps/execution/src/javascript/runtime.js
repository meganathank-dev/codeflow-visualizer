"use strict";

const {
  TraceRecorder,

  EVENT_TYPES
} = require("@codeflow/execution-trace");

const DEFAULT_MAX_TRACE_EVENTS = 1_000;

const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024;

class RuntimeLimitError extends Error {
  constructor(message, code) {
    super(message);

    this.name = "RuntimeLimitError";

    this.code = code;
  }
}

function toSerializable(
  value,

  depth = 0,

  ancestors = new WeakSet()
) {
  if (depth > 15) {
    return {
      $type: typeof value,

      display: "<maximum serialization depth reached>"
    };
  }

  if (value === undefined) {
    return {
      $type: "undefined"
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
    if (
      Number.isFinite(value)
    ) {
      return value;
    }

    return {
      $type: "number",

      display: String(value)
    };
  }

  if (typeof value === "bigint") {
    return {
      $type: "bigint",

      display: value.toString()
    };
  }

  if (
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return {
      $type: typeof value,

      display: String(value)
    };
  }

  if (
    typeof value === "object"
  ) {
    if (value.__codeflowLinkedList === true) {
      return value.toArray().map((item) => toSerializable(item, depth + 1, ancestors));
    }

    if (value.__codeflowHashMap === true) {
      return Object.fromEntries(
        value.snapshot().map((entry) => [String(entry.key), entry.value])
      );
    }

    if (value.__codeflowBinarySearchTree === true) {
      return value.inorderValues().map((item) => toSerializable(item, depth + 1, ancestors));
    }

    if (value.__codeflowMinHeap === true) {
      return value.toArray().map((item) => toSerializable(item, depth + 1, ancestors));
    }

    if (value.__codeflowGraph === true) {
      return value.toAdjacencyObject();
    }

    if (
      ancestors.has(value)
    ) {
      return {
        $type: "circular",

        display: "<circular reference>"
      };
    }

    ancestors.add(value);

    if (
      Array.isArray(value)
    ) {
      const serializedArray = value.map(
        (item) => toSerializable(
          item,

          depth + 1,

          ancestors
        )
      );

      ancestors.delete(value);

      return serializedArray;
    }

    const serializedObject = {};

    for (
      const [
        key,

        childValue
      ] of Object.entries(value)
    ) {
      serializedObject[key] = toSerializable(
        childValue,

        depth + 1,

        ancestors
      );
    }

    ancestors.delete(value);

    return serializedObject;
  }

  return {
    $type: typeof value,

    display: String(value)
  };
}

function getValueType(value) {
  if (value === null) {
    return "null";
  }

  if (
    Array.isArray(value)
  ) {
    return "array";
  }

  if (value && value.__codeflowLinkedList === true) {
    return "linked-list";
  }

  if (value && value.__codeflowHashMap === true) {
    return "hash-map";
  }

  if (value && value.__codeflowBinarySearchTree === true) {
    return "binary-search-tree";
  }

  if (value && value.__codeflowMinHeap === true) {
    return "min-heap";
  }

  if (value && value.__codeflowGraph === true) {
    return "graph";
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
    return JSON.stringify(
      toSerializable(value)
    );
  } catch {
    return String(value);
  }
}

function isStackName(name) {
  return /stack/i.test(
    name
  );
}

function isQueueName(name) {
  return /queue/i.test(
    name
  );
}

function normalizeLine(line) {
  if (
    Number.isInteger(line) &&
    line > 0
  ) {
    return line;
  }

  return 1;
}

function createJavaScriptRuntime(options = {}) {
  const {
    traceId,

    sourceFile = "main.js",

    maximumTraceEvents = DEFAULT_MAX_TRACE_EVENTS,

    maximumOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,

    source = "",

    inputs = []
  } = options;

  if (
    typeof traceId !== "string" ||
    traceId.trim().length === 0
  ) {
    throw new TypeError(
      "traceId must be a non-empty string."
    );
  }

  if (
    !Number.isInteger(maximumTraceEvents) ||
    maximumTraceEvents < 3
  ) {
    throw new TypeError(
      "maximumTraceEvents must be an integer greater than or equal to 3."
    );
  }

  if (
    !Number.isInteger(maximumOutputBytes) ||
    maximumOutputBytes < 1
  ) {
    throw new TypeError(
      "maximumOutputBytes must be a positive integer."
    );
  }

  if (!Array.isArray(inputs) || inputs.some((value) => typeof value !== "string")) {
    throw new TypeError("inputs must be an array of strings.");
  }

  const recorder = new TraceRecorder({
    language: "javascript",

    traceId,

    maxEvents: maximumTraceEvents,

    metadata: {
      adapter: "javascript",

      sourceFile,

      executionMode: "local-trusted-child-process"
    }
  });

  const references = new Map();

  const loopIterations = new Map();

  const callFrames = [];

  let totalOutputBytes = 0;

  const inputQueue = Array.from(inputs);

  let nextInputIndex = 0;

  let nextFrameNumber = 0;

  let nextSearchNumber = 0;

  let nextSortNumber = 0;

  let nextDynamicProgrammingNumber = 0;

  let nextHanoiNumber = 0;

  let lastRecordedLine = 1;

  const sourceLines = String(source).split(/\r?\n/);

  function createErrorPayload(error, line) {
    const name = error?.name ?? "JavaScriptExecutionError";
    const message = error?.message ?? "JavaScript execution failed.";
    const normalizedLine = normalizeLine(line);
    const category = name === "SyntaxError"
      ? "syntax"
      : error?.code === "INPUT_EXHAUSTED"
        ? "input"
        : error instanceof RuntimeLimitError
          ? "limit"
          : "runtime";
    const hint = category === "input"
      ? "Enter the requested value in the input dialog to continue execution."
      : category === "syntax"
        ? "Correct the highlighted JavaScript syntax before running again."
        : name === "ReferenceError"
          ? "Check that every variable and function is declared before it is used."
          : name === "TypeError"
            ? "Check the value types, function arguments, and method used on this line."
            : name === "RangeError"
              ? "Check array bounds and reduce recursive depth if the call stack is too deep."
              : category === "limit"
                ? "Reduce the loop iterations, recursion depth, output, or total work."
                : "Inspect the highlighted source line and the recorded call-stack frames.";
    const frames = String(error?.stack || "")
      .split(/\r?\n/)
      .map((entry) => entry.match(/at\s+(.*?)\s+\(codeflow-user-program\.js:(\d+):(\d+)\)|at\s+codeflow-user-program\.js:(\d+):(\d+)/))
      .filter(Boolean)
      .map((match) => ({
        functionName: match[1] || "<program>",
        line: Number(match[2] || match[4]),
        column: Number(match[3] || match[5])
      }));

    return {
      name,
      errorType: name,
      code: error?.code ?? null,
      message,
      phase: category === "syntax" ? "parse" : "execute",
      category,
      hint,
      sourceExcerpt: sourceLines[normalizedLine - 1]?.trim() || null,
      inputRequest: error?.inputRequest ?? null,
      frames
    };
  }

  function currentScopeId() {
    return (
      callFrames.at(-1)?.scopeId ??
      null
    );
  }

  function createEventOptions(
    line,

    explicitScopeId = undefined
  ) {
    return {
      source: {
        line: normalizeLine(line),

        column: null,

        endLine: null,

        endColumn: null
      },

      scopeId: explicitScopeId === undefined
        ? currentScopeId()
        : explicitScopeId
    };
  }

  function record(
    eventType,

    line,

    payload = {},

    explicitScopeId = undefined
  ) {
    if (
      recorder.eventCount >= maximumTraceEvents - 1
    ) {
      throw new RuntimeLimitError(
        `Execution exceeded the maximum of ${maximumTraceEvents} trace events.`,

        "TRACE_LIMIT_EXCEEDED"
      );
    }

    lastRecordedLine = normalizeLine(
      line
    );

    return recorder.record(
      eventType,

      toSerializable(payload),

      createEventOptions(
        line,

        explicitScopeId
      )
    );
  }

  class CodeFlowLinkedList {
    constructor() {
      this.__codeflowLinkedList = true;
      this.head = null;
      this.tail = null;
      this.length = 0;
      this.nextNodeNumber = 0;
    }

    append(value) {
      return this.insert(this.length, value);
    }

    prepend(value) {
      return this.insert(0, value);
    }

    insert(index, value) {
      if (!Number.isInteger(index) || index < 0 || index > this.length) {
        throw new RangeError("Linked-list insertion index is out of bounds.");
      }

      const node = { id: `node:${++this.nextNodeNumber}`, value, next: null };

      if (index === 0) {
        node.next = this.head;
        this.head = node;
      } else {
        let previous = this.head;

        for (let position = 1; position < index; position += 1) {
          previous = previous.next;
        }

        node.next = previous.next;
        previous.next = node;
      }

      if (node.next === null) {
        this.tail = node;
      }

      this.length += 1;

      return value;
    }

    removeAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.length) {
        throw new RangeError("Linked-list removal index is out of bounds.");
      }

      let removed;

      if (index === 0) {
        removed = this.head;
        this.head = removed.next;
      } else {
        let previous = this.head;

        for (let position = 1; position < index; position += 1) {
          previous = previous.next;
        }

        removed = previous.next;
        previous.next = removed.next;
      }

      this.length -= 1;

      if (this.length === 0) {
        this.tail = null;
      } else if (removed === this.tail) {
        let current = this.head;

        while (current.next) {
          current = current.next;
        }

        this.tail = current;
      }

      return removed.value;
    }

    get(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.length) {
        throw new RangeError("Linked-list access index is out of bounds.");
      }

      let current = this.head;

      for (let position = 0; position < index; position += 1) {
        current = current.next;
      }

      return current.value;
    }

    toArray() {
      const values = [];
      let current = this.head;

      while (current) {
        values.push(current.value);
        current = current.next;
      }

      return values;
    }

    snapshot() {
      const nodes = [];
      let current = this.head;

      while (current) {
        nodes.push({
          id: current.id,
          value: toSerializable(current.value),
          nextId: current.next?.id || null
        });
        current = current.next;
      }

      return nodes;
    }
  }

  class CodeFlowHashMap {
    #entries = new Map();
    #lastAccessKey = null;

    constructor() {
      Object.defineProperty(this, "__codeflowHashMap", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    get size() {
      return this.#entries.size;
    }

    set(key, value) {
      if (key !== null && !["string", "number", "boolean"].includes(typeof key)) {
        throw new TypeError("The current Map visualizer supports primitive keys only.");
      }

      this.#lastAccessKey = key;
      this.#entries.set(key, value);
      return this;
    }

    get(key) {
      this.#lastAccessKey = key;
      return this.#entries.get(key);
    }

    has(key) {
      this.#lastAccessKey = key;
      return this.#entries.has(key);
    }

    delete(key) {
      this.#lastAccessKey = key;
      return this.#entries.delete(key);
    }

    entries() {
      return this.#entries.entries();
    }

    lastAccessKey() {
      return this.#lastAccessKey;
    }

    snapshot() {
      return Array.from(this.#entries, ([key, value]) => ({
        key: toSerializable(key),
        value: toSerializable(value)
      }));
    }
  }

  class CodeFlowBinarySearchTree {
    constructor() {
      Object.defineProperty(this, "__codeflowBinarySearchTree", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
      this.root = null;
      this.nextNodeNumber = 0;
      this.lastVisitedIds = [];
      this.lastInsertedNodeId = null;
      this.lastFoundNodeId = null;
      this.lastTraversalIds = [];
      this.lastRequestedValue = undefined;
    }

    validateValue(value) {
      if (!["number", "string"].includes(typeof value)) {
        throw new TypeError("The current BinarySearchTree visualizer supports number or string values only.");
      }

      if (this.root && typeof value !== typeof this.root.value) {
        throw new TypeError("All BinarySearchTree values must use the same primitive type.");
      }
    }

    insert(value) {
      this.validateValue(value);
      this.lastRequestedValue = value;
      this.lastVisitedIds = [];
      this.lastInsertedNodeId = null;

      const node = {
        id: `tree-node:${++this.nextNodeNumber}`,
        value,
        left: null,
        right: null,
        parent: null
      };

      if (!this.root) {
        this.root = node;
        this.lastVisitedIds.push(node.id);
        this.lastInsertedNodeId = node.id;
        return true;
      }

      let current = this.root;

      while (current) {
        this.lastVisitedIds.push(current.id);

        if (value === current.value) {
          this.nextNodeNumber -= 1;
          return false;
        }

        const direction = value < current.value ? "left" : "right";

        if (!current[direction]) {
          node.parent = current;
          current[direction] = node;
          this.lastVisitedIds.push(node.id);
          this.lastInsertedNodeId = node.id;
          return true;
        }

        current = current[direction];
      }

      return false;
    }

    search(value) {
      this.validateValue(value);
      this.lastRequestedValue = value;
      this.lastVisitedIds = [];
      this.lastFoundNodeId = null;
      let current = this.root;

      while (current) {
        this.lastVisitedIds.push(current.id);

        if (value === current.value) {
          this.lastFoundNodeId = current.id;
          return true;
        }

        current = value < current.value ? current.left : current.right;
      }

      return false;
    }

    inorderValues() {
      const values = [];

      function visit(node) {
        if (!node) {
          return;
        }

        visit(node.left);
        values.push(node.value);
        visit(node.right);
      }

      visit(this.root);
      return values;
    }

    inorder() {
      const values = [];
      const identifiers = [];

      function visit(node) {
        if (!node) {
          return;
        }

        visit(node.left);
        identifiers.push(node.id);
        values.push(node.value);
        visit(node.right);
      }

      visit(this.root);
      this.lastTraversalIds = identifiers;
      return values;
    }

    snapshot() {
      const nodes = [];

      function visit(node) {
        if (!node) {
          return;
        }

        nodes.push({
          id: node.id,
          value: toSerializable(node.value),
          leftId: node.left?.id || null,
          rightId: node.right?.id || null,
          parentId: node.parent?.id || null
        });
        visit(node.left);
        visit(node.right);
      }

      visit(this.root);
      return nodes;
    }
  }

  class CodeFlowMinHeap {
    constructor() {
      Object.defineProperty(this, "__codeflowMinHeap", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
      this.values = [];
      this.lastRequestedValue = undefined;
      this.lastExtractedValue = undefined;
      this.lastPeekedValue = undefined;
      this.lastSteps = [];
    }

    validateValue(value) {
      if (!["number", "string"].includes(typeof value)) {
        throw new TypeError("The current MinHeap visualizer supports number or string values only.");
      }

      if (this.values.length > 0 && typeof value !== typeof this.values[0]) {
        throw new TypeError("All MinHeap values must use the same primitive type.");
      }
    }

    insert(value) {
      this.validateValue(value);
      this.lastRequestedValue = value;
      this.lastSteps = [];
      this.values.push(value);

      let index = this.values.length - 1;
      this.lastSteps.push({
        kind: "insert",
        index,
        values: this.toArray()
      });

      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);

        if (this.values[parentIndex] <= this.values[index]) {
          break;
        }

        [this.values[parentIndex], this.values[index]] = [
          this.values[index],
          this.values[parentIndex]
        ];

        this.lastSteps.push({
          kind: "swap",
          fromIndex: index,
          toIndex: parentIndex,
          values: this.toArray()
        });
        index = parentIndex;
      }

      return this.values.length;
    }

    peek() {
      this.lastPeekedValue = this.values[0];
      this.lastSteps = [];
      return this.lastPeekedValue;
    }

    extract() {
      this.lastSteps = [];

      if (this.values.length === 0) {
        this.lastExtractedValue = undefined;
        return undefined;
      }

      const minimum = this.values[0];
      const last = this.values.pop();

      if (this.values.length > 0) {
        this.values[0] = last;
      }

      this.lastExtractedValue = minimum;
      this.lastSteps.push({
        kind: "extract",
        index: 0,
        values: this.toArray()
      });

      let index = 0;

      while (index < this.values.length) {
        const leftIndex = index * 2 + 1;
        const rightIndex = index * 2 + 2;
        let smallestIndex = index;

        if (
          leftIndex < this.values.length &&
          this.values[leftIndex] < this.values[smallestIndex]
        ) {
          smallestIndex = leftIndex;
        }

        if (
          rightIndex < this.values.length &&
          this.values[rightIndex] < this.values[smallestIndex]
        ) {
          smallestIndex = rightIndex;
        }

        if (smallestIndex === index) {
          break;
        }

        [this.values[index], this.values[smallestIndex]] = [
          this.values[smallestIndex],
          this.values[index]
        ];

        this.lastSteps.push({
          kind: "swap",
          fromIndex: index,
          toIndex: smallestIndex,
          values: this.toArray()
        });
        index = smallestIndex;
      }

      return minimum;
    }

    toArray() {
      return Array.from(this.values);
    }
  }

  class CodeFlowGraph {
    constructor() {
      Object.defineProperty(this, "__codeflowGraph", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      });
      this.directed = false;
      this.nodes = [];
      this.edges = [];
      this.adjacency = new Map();
      this.lastAddedNodeId = null;
      this.lastAddedEdgeId = null;
      this.lastTraversalSteps = [];
      this.lastTraversalIds = [];
      this.lastTraversalType = null;
    }

    key(value) {
      if (!["string", "number"].includes(typeof value)) {
        throw new TypeError("Graph nodes must be strings or finite numbers.");
      }

      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new TypeError("Graph node numbers must be finite.");
      }

      return `${typeof value}:${String(value)}`;
    }

    addNode(value) {
      const key = this.key(value);
      const existing = this.nodes.find((node) => node.key === key);

      if (existing) {
        this.lastAddedNodeId = existing.id;
        return false;
      }

      const node = { id: `graph-node:${this.nodes.length + 1}`, key, value };
      this.nodes.push(node);
      this.adjacency.set(key, []);
      this.lastAddedNodeId = node.id;
      return true;
    }

    addEdge(source, target) {
      this.addNode(source);
      this.addNode(target);

      const sourceKey = this.key(source);
      const targetKey = this.key(target);
      const sourceNode = this.nodes.find((node) => node.key === sourceKey);
      const targetNode = this.nodes.find((node) => node.key === targetKey);
      const existing = this.edges.find((edge) => (
        (edge.sourceId === sourceNode.id && edge.targetId === targetNode.id) ||
        (!this.directed && edge.sourceId === targetNode.id && edge.targetId === sourceNode.id)
      ));

      if (existing) {
        this.lastAddedEdgeId = existing.id;
        return false;
      }

      const edge = {
        id: `graph-edge:${this.edges.length + 1}`,
        sourceId: sourceNode.id,
        targetId: targetNode.id
      };
      this.edges.push(edge);
      this.adjacency.get(sourceKey).push(targetKey);

      if (sourceKey !== targetKey) {
        this.adjacency.get(targetKey).push(sourceKey);
      }

      this.lastAddedEdgeId = edge.id;
      return true;
    }

    traverse(start, traversalType) {
      const startKey = this.key(start);

      if (!this.adjacency.has(startKey)) {
        throw new RangeError(`Graph does not contain starting node ${String(start)}.`);
      }

      const pending = [{ key: startKey, fromKey: null }];
      const queued = new Set([startKey]);
      const visited = new Set();
      const order = [];
      this.lastTraversalSteps = [];
      this.lastTraversalType = traversalType;

      while (pending.length > 0) {
        const current = traversalType === "dfs" ? pending.pop() : pending.shift();

        if (visited.has(current.key)) {
          continue;
        }

        const node = this.nodes.find((item) => item.key === current.key);

        if (current.fromKey !== null) {
          const previous = this.nodes.find((item) => item.key === current.fromKey);
          const edge = this.edges.find((item) => (
            (item.sourceId === previous.id && item.targetId === node.id) ||
            (item.sourceId === node.id && item.targetId === previous.id)
          ));

          if (edge) {
            this.lastTraversalSteps.push({
              kind: "edge",
              edgeId: edge.id,
              sourceId: previous.id,
              targetId: node.id
            });
          }
        }

        visited.add(current.key);
        order.push(node.value);
        this.lastTraversalSteps.push({
          kind: "visit",
          nodeId: node.id,
          value: node.value,
          visitedIds: this.nodes.filter((item) => visited.has(item.key))
            .sort((left, right) => order.indexOf(left.value) - order.indexOf(right.value))
            .map((item) => item.id)
        });

        const neighbors = this.adjacency.get(current.key) || [];
        const candidates = traversalType === "dfs" ? [...neighbors].reverse() : neighbors;

        for (const neighbor of candidates) {
          if (!visited.has(neighbor) && !queued.has(neighbor)) {
            pending.push({ key: neighbor, fromKey: current.key });
            queued.add(neighbor);
          }
        }
      }

      this.lastTraversalIds = this.lastTraversalSteps
        .filter((step) => step.kind === "visit")
        .map((step) => step.nodeId);
      return order;
    }

    bfs(start) {
      return this.traverse(start, "bfs");
    }

    dfs(start) {
      return this.traverse(start, "dfs");
    }

    snapshot() {
      return {
        directed: this.directed,
        nodes: this.nodes.map(({ id, value }) => ({ id, value: toSerializable(value) })),
        edges: this.edges.map((edge) => ({ ...edge }))
      };
    }

    toAdjacencyObject() {
      return Object.fromEntries(this.nodes.map((node) => [
        String(node.value),
        (this.adjacency.get(node.key) || []).map((key) => (
          this.nodes.find((item) => item.key === key)?.value
        ))
      ]));
    }
  }

  function recordGraphMethod(name, method, graph, result, line) {
    const payload = {
      name,
      graphName: name,
      ...graph.snapshot()
    };

    if (method === "addNode") {
      const node = graph.nodes.find((item) => item.id === graph.lastAddedNodeId);
      record(EVENT_TYPES.GRAPH_NODE_ADD, line, {
        ...payload,
        nodeId: node?.id || null,
        value: toSerializable(node?.value),
        inserted: Boolean(result)
      });
    } else if (method === "addEdge") {
      const edge = graph.edges.find((item) => item.id === graph.lastAddedEdgeId);
      record(EVENT_TYPES.GRAPH_EDGE_ADD, line, {
        ...payload,
        edgeId: edge?.id || null,
        sourceId: edge?.sourceId || null,
        targetId: edge?.targetId || null,
        inserted: Boolean(result)
      });
    } else if (method === "bfs" || method === "dfs") {
      for (const step of graph.lastTraversalSteps) {
        record(
          step.kind === "edge" ? EVENT_TYPES.GRAPH_EDGE_TRAVERSE : EVENT_TYPES.GRAPH_VISIT,
          line,
          {
            ...payload,
            ...toSerializable(step),
            traversalType: method
          }
        );
      }

      record(EVENT_TYPES.GRAPH_TRAVERSE, line, {
        ...payload,
        traversalType: method,
        visitedIds: graph.lastTraversalIds,
        order: toSerializable(result)
      });
    }
  }

  function runSearchAlgorithm(algorithm, values, target) {
    if (!Array.isArray(values)) {
      throw new TypeError("SearchAlgorithms requires an array as its first argument.");
    }

    if (algorithm === "binary" && values.some((value, index) => (
      index > 0 && values[index - 1] > value
    ))) {
      throw new RangeError("Binary search requires an array sorted in ascending order.");
    }

    const arrayName = [...references.entries()].find(([, value]) => value === values)?.[0] || "values";
    const searchId = `search:${++nextSearchNumber}`;
    const line = lastRecordedLine;
    const comparedIndices = [];
    let low = 0;
    let high = values.length - 1;
    let middle = algorithm === "binary" && high >= 0
      ? Math.floor((low + high) / 2)
      : null;

    const payload = (extra = {}) => ({
      searchId,
      algorithm,
      arrayName,
      values: Array.from(values),
      target,
      low,
      high,
      middle,
      comparedIndices: Array.from(comparedIndices),
      eliminatedIndices: values.map((_, index) => index)
        .filter((index) => index < low || index > high),
      comparisonCount: comparedIndices.length,
      ...extra
    });

    record(EVENT_TYPES.SEARCH_START, line, payload());

    while (low <= high) {
      const index = algorithm === "binary"
        ? Math.floor((low + high) / 2)
        : low;

      middle = algorithm === "binary" ? index : null;
      comparedIndices.push(index);

      const matches = values[index] === target;

      record(EVENT_TYPES.SEARCH_COMPARE, line, payload({
        index,
        value: values[index],
        match: matches
      }));

      if (matches) {
        record(EVENT_TYPES.SEARCH_FOUND, line, payload({
          index,
          foundIndex: index,
          found: true
        }));
        record(EVENT_TYPES.SEARCH_END, line, payload({
          index,
          foundIndex: index,
          found: true
        }));
        return index;
      }

      const previousLow = low;
      const previousHigh = high;
      const direction = algorithm === "binary" && values[index] > target
        ? "left"
        : "right";

      if (direction === "left") {
        high = index - 1;
      } else {
        low = index + 1;
      }

      middle = algorithm === "binary" && low <= high
        ? Math.floor((low + high) / 2)
        : null;

      record(EVENT_TYPES.SEARCH_RANGE_UPDATE, line, payload({
        previousLow,
        previousHigh,
        direction
      }));
    }

    record(EVENT_TYPES.SEARCH_NOT_FOUND, line, payload({
      foundIndex: -1,
      found: false
    }));
    record(EVENT_TYPES.SEARCH_END, line, payload({
      foundIndex: -1,
      found: false
    }));

    return -1;
  }

  function runSortAlgorithm(algorithm, values) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new TypeError("SortingAlgorithms requires an array containing finite numbers.");
    }

    const arrayName = [...references.entries()].find(([, value]) => value === values)?.[0] || "values";
    const sortId = `sort:${++nextSortNumber}`;
    const line = lastRecordedLine;
    const initialValues = Array.from(values);
    const sorted = new Set();
    let comparisonCount = 0;
    let swapCount = 0;
    let writeCount = 0;
    let pass = 0;

    function emit(type, extra = {}) {
      record(type, line, {
        sortId,
        algorithm,
        arrayName,
        values: Array.from(values),
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
      });
    }

    function mark(index) {
      sorted.add(index);
      emit(EVENT_TYPES.SORT_MARK_SORTED, { activeIndex: index });
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

        mark(boundary);
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

        mark(start);
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
    return values;
  }

  function runDynamicProgrammingAlgorithm(algorithm, ...argumentsList) {
    const line = lastRecordedLine;
    const dpId = `dp:${++nextDynamicProgrammingNumber}`;
    let table = [];
    let rowLabels = [];
    let columnLabels = [];
    let readCount = 0;
    let writeCount = 0;
    let cacheHitCount = 0;
    let cacheMissCount = 0;
    let choiceCount = 0;

    function emit(type, extra = {}) {
      record(type, line, {
        dpId,
        algorithm,
        table: structuredClone(table),
        dimension: table.length === 1 ? "1d" : "2d",
        rows: table.length,
        columns: table[0]?.length ?? 0,
        rowLabels: Array.from(rowLabels),
        columnLabels: Array.from(columnLabels),
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
      });
    }

    function assertIndex(value, name) {
      if (!Number.isInteger(value) || value < 0 || value > 40) {
        throw new TypeError(`${name} must be an integer between 0 and 40.`);
      }
    }

    if (algorithm === "fibonacci-memo") {
      const n = argumentsList[0];
      assertIndex(n, "fibonacciMemo input");
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
          readCount += 2;
          emit(EVENT_TYPES.DP_STATE_READ, {
            activeRow: 0,
            activeColumn: index,
            readCells: [[0, index - 1], [0, index - 2]],
            values: [previous, beforePrevious],
            phase: "memoization"
          });
          value = previous + beforePrevious;
          choiceCount += 1;
          emit(EVENT_TYPES.DP_CHOICE, {
            activeRow: 0,
            activeColumn: index,
            readCells: [[0, index - 1], [0, index - 2]],
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
      return result;
    }

    if (algorithm === "fibonacci-tabulation") {
      const n = argumentsList[0];
      assertIndex(n, "fibonacciTabulation input");
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
        readCount += 2;
        emit(EVENT_TYPES.DP_STATE_READ, {
          activeRow: 0,
          activeColumn: index,
          readCells: [[0, index - 1], [0, index - 2]],
          values: [previous, beforePrevious],
          phase: "tabulation"
        });
        const value = previous + beforePrevious;
        choiceCount += 1;
        emit(EVENT_TYPES.DP_CHOICE, {
          activeRow: 0,
          activeColumn: index,
          readCells: [[0, index - 1], [0, index - 2]],
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
      return result;
    }

    if (algorithm === "knapsack-01") {
      const [weights, values, capacity] = argumentsList;

      if (
        !Array.isArray(weights) ||
        !Array.isArray(values) ||
        weights.length !== values.length ||
        weights.length === 0 ||
        weights.some((value) => !Number.isInteger(value) || value <= 0) ||
        values.some((value) => typeof value !== "number" || !Number.isFinite(value))
      ) {
        throw new TypeError("knapsack01 requires equal non-empty weight and value arrays.");
      }

      if (!Number.isInteger(capacity) || capacity < 0 || capacity > 40) {
        throw new TypeError("knapsack01 capacity must be an integer between 0 and 40.");
      }

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
        input: { weights: Array.from(weights), values: Array.from(values), capacity },
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
          choiceCount += 1;
          emit(EVENT_TYPES.DP_CHOICE, {
            activeRow: row,
            activeColumn: column,
            readCells,
            decision: included ? "include-item" : "exclude-item",
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
            decision: included ? "include-item" : "exclude-item",
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
      return result;
    }

    throw new TypeError(`Unsupported dynamic-programming algorithm: ${algorithm}`);
  }

  function runTowerOfHanoi(diskCount) {
    if (!Number.isInteger(diskCount) || diskCount < 1 || diskCount > 8) {
      throw new TypeError("towerOfHanoi disk count must be an integer between 1 and 8.");
    }

    const line = lastRecordedLine;
    const hanoiId = `hanoi:${++nextHanoiNumber}`;
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
      record(type, line, {
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
      });
    }

    function move(disk, from, to) {
      const removed = pegs[from].pop();
      const destinationTop = pegs[to].at(-1);

      if (removed !== disk || (destinationTop != null && destinationTop < disk)) {
        throw new Error("Invalid Tower of Hanoi move generated.");
      }

      pegs[to].push(disk);
      moveNumber += 1;
      emit(EVENT_TYPES.HANOI_MOVE, {
        disk,
        from,
        to,
        phase: "move"
      });
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
    return moveNumber;
  }

  function recordTreeMethod(name, method, tree, result, line, requestedValue) {
    const payload = {
      name,
      treeName: name,
      nodes: tree.snapshot(),
      rootId: tree.root?.id || null
    };

    if (method === "insert") {
      record(EVENT_TYPES.TREE_INSERT, line, {
        ...payload,
        value: toSerializable(requestedValue),
        inserted: Boolean(result),
        insertedNodeId: tree.lastInsertedNodeId,
        path: tree.lastVisitedIds
      });
    } else if (method === "search") {
      record(EVENT_TYPES.TREE_SEARCH, line, {
        ...payload,
        target: toSerializable(requestedValue),
        found: Boolean(result),
        foundNodeId: tree.lastFoundNodeId,
        path: tree.lastVisitedIds
      });
    } else if (method === "inorder") {
      record(EVENT_TYPES.TREE_TRAVERSE, line, {
        ...payload,
        traversalType: "inorder",
        visitedIds: tree.lastTraversalIds,
        order: toSerializable(result)
      });
    }
  }

  function recordHeapMethod(name, method, heap, result, line) {
    const basePayload = {
      name,
      heapName: name,
      heapType: "min"
    };

    if (method === "insert") {
      const [insertStep, ...swapSteps] = heap.lastSteps;

      record(EVENT_TYPES.HEAP_INSERT, line, {
        ...basePayload,
        value: toSerializable(heap.lastRequestedValue),
        index: insertStep?.index ?? heap.values.length - 1,
        values: toSerializable(insertStep?.values || heap.toArray())
      });

      for (const step of swapSteps) {
        record(EVENT_TYPES.HEAP_SWAP, line, {
          ...basePayload,
          fromIndex: step.fromIndex,
          toIndex: step.toIndex,
          values: toSerializable(step.values),
          reason: "bubble-up"
        });
      }
    } else if (method === "peek") {
      record(EVENT_TYPES.HEAP_PEEK, line, {
        ...basePayload,
        value: toSerializable(result),
        values: toSerializable(heap.toArray()),
        activeIndices: heap.values.length > 0 ? [0] : []
      });
    } else if (method === "extract") {
      const [extractStep, ...swapSteps] = heap.lastSteps;

      record(EVENT_TYPES.HEAP_EXTRACT, line, {
        ...basePayload,
        value: toSerializable(result),
        values: toSerializable(extractStep?.values || heap.toArray()),
        activeIndices: heap.values.length > 0 ? [0] : []
      });

      for (const step of swapSteps) {
        record(EVENT_TYPES.HEAP_SWAP, line, {
          ...basePayload,
          fromIndex: step.fromIndex,
          toIndex: step.toIndex,
          values: toSerializable(step.values),
          reason: "bubble-down"
        });
      }
    }
  }

  function recordHashMapMethod(name, method, before, after, result, line, requestedKey) {
    const entryMatches = (left, right) => (
      JSON.stringify(left.key) === JSON.stringify(right.key)
    );
    const changed = after.find((entry) => {
      const previous = before.find((item) => entryMatches(item, entry));

      return !previous || JSON.stringify(previous.value) !== JSON.stringify(entry.value);
    });
    const removed = before.find(
      (entry) => !after.some((item) => entryMatches(item, entry))
    );
    const payload = {
      name,
      mapName: name,
      entries: after,
      size: after.length
    };

    if (method === "set") {
      const current = changed || after.find((entry) => (
        JSON.stringify(entry.key) === JSON.stringify(requestedKey)
      ));
      const previous = before.find((entry) => entryMatches(entry, current));

      record(EVENT_TYPES.HASHMAP_SET, line, {
        ...payload,
        key: current.key,
        value: current.value,
        previousValue: previous?.value,
        updated: Boolean(previous)
      });
    } else if (method === "delete" && removed) {
      record(EVENT_TYPES.HASHMAP_DELETE, line, {
        ...payload,
        key: removed.key,
        value: removed.value,
        result
      });
    }
  }

  function recordLinkedListMethod(name, method, before, after, result, line) {
    const inserted = after.find((node) => !before.some((previous) => previous.id === node.id));
    const removed = before.find((node) => !after.some((next) => next.id === node.id));
    const payload = {
      name,
      listName: name,
      nodes: after,
      headId: after[0]?.id || null,
      tailId: after.at(-1)?.id || null,
      length: after.length
    };

    if (inserted) {
      const index = after.findIndex((node) => node.id === inserted.id);

      record(EVENT_TYPES.NODE_CREATE, line, {
        ...payload,
        nodeId: inserted.id,
        value: inserted.value,
        nextId: inserted.nextId
      });

      record(EVENT_TYPES.REFERENCE_UPDATE, line, {
        ...payload,
        reference: index === 0 ? "head" : "next",
        fromNodeId: index === 0 ? null : after[index - 1].id,
        previousTargetId: index === 0 ? before[0]?.id || null : before[index - 1]?.nextId || null,
        targetNodeId: inserted.id
      });

      record(EVENT_TYPES.NODE_INSERT, line, {
        ...payload,
        nodeId: inserted.id,
        value: inserted.value,
        index
      });
    } else if (removed) {
      const index = before.findIndex((node) => node.id === removed.id);

      record(EVENT_TYPES.REFERENCE_UPDATE, line, {
        ...payload,
        reference: index === 0 ? "head" : "next",
        fromNodeId: index === 0 ? null : before[index - 1].id,
        previousTargetId: removed.id,
        targetNodeId: after[index]?.id || null
      });

      record(EVENT_TYPES.NODE_DELETE, line, {
        ...payload,
        nodeId: removed.id,
        value: removed.value,
        index
      });
    } else if (method === "get") {
      const node = after.find((item) => JSON.stringify(item.value) === JSON.stringify(toSerializable(result)));

      if (node) {
        record(EVENT_TYPES.NODE_VISIT, line, {
          ...payload,
          nodeId: node.id,
          value: node.value,
          index: after.findIndex((item) => item.id === node.id)
        });
      }
    }
  }

  function recordArrayMethod(
    objectName,

    methodName,

    beforeValues,

    afterValues,

    line
  ) {
    if (
      methodName === "push" &&
      afterValues.length > beforeValues.length
    ) {
      for (
        let index = beforeValues.length;
        index < afterValues.length;
        index += 1
      ) {
        const value = toSerializable(
          afterValues[index]
        );

        record(
          EVENT_TYPES.ARRAY_INSERT,

          line,

          {
            name: objectName,

            arrayName: objectName,

            index,

            value,

            values: toSerializable(
              afterValues
            )
          }
        );

        if (
          isStackName(objectName)
        ) {
          record(
            EVENT_TYPES.STACK_PUSH,

            line,

            {
              name: objectName,

              value,

              values: toSerializable(
                afterValues
              )
            }
          );
        }

        if (
          isQueueName(objectName)
        ) {
          record(
            EVENT_TYPES.QUEUE_ENQUEUE,

            line,

            {
              name: objectName,

              value,

              values: toSerializable(
                afterValues
              )
            }
          );
        }
      }

      return;
    }

    if (
      methodName === "pop" &&
      beforeValues.length > afterValues.length
    ) {
      const removedIndex = beforeValues.length - 1;

      const removedValue = toSerializable(
        beforeValues[removedIndex]
      );

      record(
        EVENT_TYPES.ARRAY_DELETE,

        line,

        {
          name: objectName,

          arrayName: objectName,

          index: removedIndex,

          value: removedValue,

          values: toSerializable(
            afterValues
          )
        }
      );

      if (
        isStackName(objectName)
      ) {
        record(
          EVENT_TYPES.STACK_POP,

          line,

          {
            name: objectName,

            value: removedValue,

            values: toSerializable(
              afterValues
            )
          }
        );
      }

      return;
    }

    if (
      methodName === "shift" &&
      beforeValues.length > afterValues.length
    ) {
      const removedValue = toSerializable(
        beforeValues[0]
      );

      record(
        EVENT_TYPES.ARRAY_DELETE,

        line,

        {
          name: objectName,

          arrayName: objectName,

          index: 0,

          value: removedValue,

          values: toSerializable(
            afterValues
          )
        }
      );

      if (
        isQueueName(objectName)
      ) {
        record(
          EVENT_TYPES.QUEUE_DEQUEUE,

          line,

          {
            name: objectName,

            value: removedValue,

            values: toSerializable(
              afterValues
            )
          }
        );
      }

      return;
    }

    if (
      methodName === "unshift" &&
      afterValues.length > beforeValues.length
    ) {
      const insertedCount = (
        afterValues.length -
        beforeValues.length
      );

      for (
        let index = 0;
        index < insertedCount;
        index += 1
      ) {
        record(
          EVENT_TYPES.ARRAY_INSERT,

          line,

          {
            name: objectName,

            arrayName: objectName,

            index,

            value: toSerializable(
              afterValues[index]
            ),

            values: toSerializable(
              afterValues
            )
          }
        );
      }
    }
  }

  const runtime = {
    start() {
      recorder.start(
        {
          sourceFile,

          message: "JavaScript execution started."
        },

        createEventOptions(1)
      );
    },

    statement(line) {
      record(
        EVENT_TYPES.STATEMENT_EXECUTE,

        line,

        {
          statementKind: "javascript-statement"
        }
      );
    },

    declare(
      name,

      value,

      line
    ) {
      const serializedValue = toSerializable(
        value
      );

      if (value && value.__codeflowLinkedList === true) {
        references.set(name, value);

        record(EVENT_TYPES.LINKED_LIST_CREATE, line, {
          name,
          listName: name,
          nodes: value.snapshot(),
          headId: null,
          tailId: null,
          length: 0
        });
      }

      if (value && value.__codeflowHashMap === true) {
        references.set(name, value);

        record(EVENT_TYPES.HASHMAP_CREATE, line, {
          name,
          mapName: name,
          entries: value.snapshot(),
          size: value.size
        });
      }

      if (value && value.__codeflowBinarySearchTree === true) {
        references.set(name, value);

        record(EVENT_TYPES.TREE_CREATE, line, {
          name,
          treeName: name,
          nodes: value.snapshot(),
          rootId: value.root?.id || null
        });
      }

      if (value && value.__codeflowMinHeap === true) {
        references.set(name, value);

        record(EVENT_TYPES.HEAP_CREATE, line, {
          name,
          heapName: name,
          heapType: "min",
          values: value.toArray()
        });
      }

      if (value && value.__codeflowGraph === true) {
        references.set(name, value);

        record(EVENT_TYPES.GRAPH_CREATE, line, {
          name,
          graphName: name,
          ...value.snapshot()
        });
      }

      if (
        Array.isArray(value)
      ) {
        references.set(
          name,

          value
        );

        record(
          EVENT_TYPES.ARRAY_CREATE,

          line,

          {
            name,

            arrayName: name,

            values: serializedValue,

            length: value.length
          }
        );
      }

      record(
        EVENT_TYPES.VARIABLE_DECLARE,

        line,

        {
          name,

          value: serializedValue,

          valueType: getValueType(value)
        }
      );

      if (
        Array.isArray(value) &&
        isStackName(name)
      ) {
        record(
          EVENT_TYPES.STACK_CREATE,

          line,

          {
            name,

            values: serializedValue
          }
        );
      }

      if (
        Array.isArray(value) &&
        isQueueName(name)
      ) {
        record(
          EVENT_TYPES.QUEUE_CREATE,

          line,

          {
            name,

            values: serializedValue
          }
        );
      }

      return value;
    },

    captureAssignment(
      name,

      readPreviousValue,

      executeAssignment,

      line,

      assignmentOperator
    ) {
      const previousValue = readPreviousValue();

      const newValue = executeAssignment();

      record(
        EVENT_TYPES.VARIABLE_UPDATE,

        line,

        {
          name,

          previousValue: toSerializable(
            previousValue
          ),

          value: toSerializable(
            newValue
          ),

          newValue: toSerializable(
            newValue
          ),

          valueType: getValueType(
            newValue
          ),

          operation: assignmentOperator
        }
      );

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
      const previousValue = toSerializable(
        array[index]
      );

      const result = executeAssignment();

      const newValue = toSerializable(
        array[index]
      );

      record(
        EVENT_TYPES.ARRAY_UPDATE,

        line,

        {
          name: arrayName,

          arrayName,

          index: toSerializable(index),

          previousValue,

          value: newValue,

          newValue,

          values: toSerializable(array),

          operation: assignmentOperator
        }
      );

      return result;
    },

    arrayAccess(
      arrayName,

      array,

      index,

      line
    ) {
      const value = array[index];

      record(
        EVENT_TYPES.ARRAY_ACCESS,

        line,

        {
          name: arrayName,

          arrayName,

          index: toSerializable(index),

          value: toSerializable(value)
        }
      );

      if (
        isQueueName(arrayName) &&
        Number(index) === 0
      ) {
        record(
          EVENT_TYPES.QUEUE_PEEK,

          line,

          {
            name: arrayName,

            value: toSerializable(value),

            values: toSerializable(array)
          }
        );
      }

      return value;
    },

    call(
      functionName,

      line,

      invoke
    ) {
      const callerFrame = callFrames.at(-1) ?? null;
      const sameFunctionDepth = (
        callFrames.filter(
          (frame) => frame.functionName === functionName
        ).length + 1
      );

      record(
        EVENT_TYPES.FUNCTION_CALL,

        line,

        {
          name: functionName,

          functionName,

          callerFrameId: callerFrame?.scopeId ?? null,

          depth: callFrames.length + 1,

          recursionDepth: sameFunctionDepth,

          recursive: sameFunctionDepth > 1
        }
      );

      const separatorIndex = functionName.indexOf(
        "."
      );

      const objectName = separatorIndex === -1
        ? null
        : functionName.slice(
          0,

          separatorIndex
        );

      const methodName = separatorIndex === -1
        ? null
        : functionName.slice(
          separatorIndex + 1
        );

      const reference = objectName
        ? references.get(objectName)
        : null;

      const beforeValues = Array.isArray(reference)
        ? Array.from(reference)
        : null;

      const beforeNodes = reference?.__codeflowLinkedList === true
        ? reference.snapshot()
        : null;

      const beforeEntries = reference?.__codeflowHashMap === true
        ? reference.snapshot()
        : null;

      const isBinarySearchTree = reference?.__codeflowBinarySearchTree === true;

      const isMinHeap = reference?.__codeflowMinHeap === true;

      const isGraph = reference?.__codeflowGraph === true;

      const frameCountBeforeCall = callFrames.length;

      const result = invoke();

      if (
        Array.isArray(reference) &&
        beforeValues !== null
      ) {
        recordArrayMethod(
          objectName,

          methodName,

          beforeValues,

          Array.from(reference),

          line
        );
      }

      if (beforeNodes !== null) {
        recordLinkedListMethod(
          objectName,
          methodName,
          beforeNodes,
          reference.snapshot(),
          result,
          line
        );
      }

      if (beforeEntries !== null) {
        const afterEntries = reference.snapshot();

        if (methodName === "get" || methodName === "has") {
          record(
            methodName === "get" ? EVENT_TYPES.HASHMAP_GET : EVENT_TYPES.HASHMAP_HAS,
            line,
            {
              name: objectName,
              mapName: objectName,
              key: toSerializable(reference.lastAccessKey()),
              ...(methodName === "get"
                ? { value: toSerializable(result) }
                : { result }),
              entries: afterEntries,
              size: afterEntries.length
            }
          );
        } else {
          recordHashMapMethod(
            objectName,
            methodName,
            beforeEntries,
            afterEntries,
            result,
            line,
            toSerializable(reference.lastAccessKey())
          );
        }
      }

      if (isBinarySearchTree) {
        recordTreeMethod(
          objectName,
          methodName,
          reference,
          result,
          line,
          methodName === "inorder" ? undefined : reference.lastRequestedValue
        );
      }

      if (isMinHeap) {
        recordHeapMethod(
          objectName,
          methodName,
          reference,
          result,
          line
        );
      }

      if (isGraph) {
        recordGraphMethod(objectName, methodName, reference, result, line);
      }

      if (
        separatorIndex === -1 &&
        callFrames.length > frameCountBeforeCall
      ) {
        const activeFrame = callFrames.at(-1);

        if (
          activeFrame?.functionName === functionName
        ) {
          runtime.functionReturn(
            functionName,

            result,

            line
          );
        }
      }

      return result;
    },

    functionEnter(
      functionName,

      parameters,

      line
    ) {
      if (callFrames.length >= 64) {
        throw new RuntimeLimitError(
          "CodeFlow recursion depth limit of 64 frames was exceeded.",
          "RECURSION_DEPTH_EXCEEDED"
        );
      }

      nextFrameNumber += 1;

      const parentFrame = callFrames.at(-1) ?? null;

      const recursionDepth = (
        callFrames.filter(
          (frame) => frame.functionName === functionName
        ).length + 1
      );

      const recursive = recursionDepth > 1;

      const scopeId = (
        `${functionName}:${nextFrameNumber}`
      );

      callFrames.push({
        functionName,

        scopeId,

        parameters: toSerializable(parameters),

        depth: callFrames.length + 1,

        recursionDepth,

        recursive,

        recursiveChildren: 0
      });

      if (
        parentFrame &&
        parentFrame.functionName === functionName
      ) {
        parentFrame.recursiveChildren += 1;
      }

      record(
        EVENT_TYPES.FUNCTION_ENTER,

        line,

        {
          name: functionName,

          functionName,

          frameId: scopeId,

          callerFrameId: parentFrame?.scopeId ?? null,

          depth: callFrames.length,

          recursionDepth,

          recursive,

          parameters: toSerializable(
            parameters
          )
        },

        scopeId
      );

      for (
        const [
          name,

          value
        ] of Object.entries(parameters)
      ) {
        record(
          EVENT_TYPES.VARIABLE_DECLARE,

          line,

          {
            name,

            value: toSerializable(value),

            valueType: getValueType(value),

            scope: functionName
          },

          scopeId
        );
      }
    },

    functionReturn(
      functionName,

      returnValue,

      line
    ) {
      const activeFrame = callFrames.at(-1);

      const scopeId = (
        activeFrame?.scopeId ??
        null
      );

      const recursive = Boolean(
        activeFrame?.recursive
      );

      const baseCase = Boolean(
        recursive &&
        activeFrame?.recursiveChildren === 0
      );

      const unwinding = Boolean(
        recursive ||
        activeFrame?.recursiveChildren > 0
      );

      const callerFrame = callFrames.at(-2) ?? null;

      record(
        EVENT_TYPES.FUNCTION_RETURN,

        line,

        {
          name: functionName,

          functionName,

          frameId: scopeId,

          callerFrameId: callerFrame?.scopeId ?? null,

          depth: activeFrame?.depth ?? callFrames.length,

          recursionDepth: activeFrame?.recursionDepth ?? 1,

          recursive,

          baseCase,

          unwinding,

          value: toSerializable(
            returnValue
          ),

          returnValue: toSerializable(
            returnValue
          ),

          parameters: activeFrame?.parameters ?? {}
        },

        scopeId
      );

      if (
        activeFrame?.functionName === functionName
      ) {
        callFrames.pop();
      }

      return returnValue;
    },

    condition(
      line,

      expression,

      result
    ) {
      record(
        EVENT_TYPES.CONDITION_EVALUATE,

        line,

        {
          expression,

          result: Boolean(result)
        }
      );

      return result;
    },

    branchEnter(
      line,

      branch
    ) {
      record(
        EVENT_TYPES.BRANCH_ENTER,

        line,

        {
          branch,

          reason: `${branch} branch selected.`
        }
      );
    },

    loopStart(
      line,

      loopType
    ) {
      loopIterations.set(
        line,

        0
      );

      record(
        EVENT_TYPES.LOOP_START,

        line,

        {
          loopId: `line:${line}`,

          loopType
        }
      );
    },

    loopCondition(
      line,

      expression,

      result
    ) {
      record(
        EVENT_TYPES.LOOP_CONDITION,

        line,

        {
          loopId: `line:${line}`,

          expression,

          result: Boolean(result)
        }
      );

      return result;
    },

    loopIteration(line) {
      const iteration = (
        (
          loopIterations.get(line) ??
          0
        ) + 1
      );

      loopIterations.set(
        line,

        iteration
      );

      record(
        EVENT_TYPES.LOOP_ITERATION,

        line,

        {
          loopId: `line:${line}`,

          iteration
        }
      );
    },

    loopEnd(line) {
      const iterations = (
        loopIterations.get(line) ??
        0
      );

      record(
        EVENT_TYPES.LOOP_END,

        line,

        {
          loopId: `line:${line}`,

          iterations,

          reason: "condition-false"
        }
      );

      loopIterations.delete(
        line
      );
    },

    output(
      line,

      ...values
    ) {
      const renderedOutput = values.map(
        formatOutputValue
      ).join(" ");

      const outputBytes = Buffer.byteLength(
        renderedOutput,

        "utf8"
      );

      if (
        totalOutputBytes + outputBytes >
        maximumOutputBytes
      ) {
        throw new RuntimeLimitError(
          "Program output exceeded the permitted output size.",

          "OUTPUT_LIMIT_EXCEEDED"
        );
      }

      totalOutputBytes += outputBytes;

      record(
        EVENT_TYPES.OUTPUT,

        line,

        {
          channel: "stdout",

          stream: "stdout",

          text: renderedOutput,

          value: renderedOutput
        }
      );
    },

    fail(
      error,

      line = lastRecordedLine
    ) {
      if (
        recorder.status === "completed" ||
        recorder.status === "failed"
      ) {
        return;
      }

      const payload = createErrorPayload(error, line);

      if (
        payload.category !== "syntax" &&
        recorder.eventCount < maximumTraceEvents - 1
      ) {
        recorder.record(
          EVENT_TYPES.EXCEPTION_THROW,
          payload,
          createEventOptions(line, null)
        );
      }

      recorder.fail(
        payload,

        createEventOptions(
          line,

          null
        )
      );
    },

    end() {
      if (
        recorder.status === "completed" ||
        recorder.status === "failed"
      ) {
        return;
      }

      recorder.finish(
        {
          exitCode: 0,

          outputBytes: totalOutputBytes
        },

        createEventOptions(
          lastRecordedLine,

          null
        )
      );
    },

    createLinkedListConstructor() {
      return CodeFlowLinkedList;
    },

    createHashMapConstructor() {
      return CodeFlowHashMap;
    },

    createBinarySearchTreeConstructor() {
      return CodeFlowBinarySearchTree;
    },

    createMinHeapConstructor() {
      return CodeFlowMinHeap;
    },

    createGraphConstructor() {
      return CodeFlowGraph;
    },

    createSearchAlgorithms() {
      return {
        linearSearch(values, target) {
          return runSearchAlgorithm("linear", values, target);
        },

        binarySearch(values, target) {
          return runSearchAlgorithm("binary", values, target);
        }
      };
    },

    createSortingAlgorithms() {
      return {
        bubbleSort(values) {
          return runSortAlgorithm("bubble", values);
        },

        selectionSort(values) {
          return runSortAlgorithm("selection", values);
        },

        insertionSort(values) {
          return runSortAlgorithm("insertion", values);
        },

        mergeSort(values) {
          return runSortAlgorithm("merge", values);
        },

        quickSort(values) {
          return runSortAlgorithm("quick", values);
        }
      };
    },

    createDynamicProgrammingAlgorithms() {
      return {
        fibonacciMemo(n) {
          return runDynamicProgrammingAlgorithm("fibonacci-memo", n);
        },

        fibonacciTabulation(n) {
          return runDynamicProgrammingAlgorithm("fibonacci-tabulation", n);
        },

        knapsack01(weights, values, capacity) {
          return runDynamicProgrammingAlgorithm(
            "knapsack-01",
            weights,
            values,
            capacity
          );
        }
      };
    },

    createRecursionAlgorithms() {
      return {
        towerOfHanoi(diskCount) {
          return runTowerOfHanoi(diskCount);
        }
      };
    },

    createPrompt() {
      return (message = "") => {
        const prompt = String(message ?? "");

        if (nextInputIndex >= inputQueue.length) {
          const error = new Error(
            `No program input remains for prompt ${JSON.stringify(prompt)}.`
          );
          error.name = "InputExhaustedError";
          error.code = "INPUT_EXHAUSTED";
          error.inputRequest = {
            prompt,
            inputNumber: nextInputIndex + 1
          };
          throw error;
        }

        const rawValue = inputQueue[nextInputIndex];
        const inputNumber = nextInputIndex + 1;
        nextInputIndex += 1;
        record(EVENT_TYPES.INPUT, lastRecordedLine, {
          inputId: `input:${inputNumber}`,
          prompt,
          rawValue,
          value: rawValue,
          valueType: "string",
          inputNumber,
          remaining: inputQueue.length - nextInputIndex
        });
        return rawValue;
      };
    },

    getTrace() {
      return recorder.toJSON();
    }
  };

  return runtime;
}

module.exports = {
  DEFAULT_MAX_TRACE_EVENTS,

  DEFAULT_MAX_OUTPUT_BYTES,

  RuntimeLimitError,

  toSerializable,

  createJavaScriptRuntime
};
