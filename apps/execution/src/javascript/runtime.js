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

    maximumOutputBytes = DEFAULT_MAX_OUTPUT_BYTES
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

  let nextFrameNumber = 0;

  let nextSearchNumber = 0;

  let nextSortNumber = 0;

  let lastRecordedLine = 1;

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
    } else {
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
    }

    for (let index = 0; index < values.length; index += 1) {
      sorted.add(index);
    }

    emit(EVENT_TYPES.SORT_END, { finished: true });
    return values;
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
      record(
        EVENT_TYPES.FUNCTION_CALL,

        line,

        {
          name: functionName,

          functionName
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
      nextFrameNumber += 1;

      const scopeId = (
        `${functionName}:${nextFrameNumber}`
      );

      callFrames.push({
        functionName,

        scopeId
      });

      record(
        EVENT_TYPES.FUNCTION_ENTER,

        line,

        {
          name: functionName,

          functionName,

          frameId: scopeId,

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

      record(
        EVENT_TYPES.FUNCTION_RETURN,

        line,

        {
          name: functionName,

          functionName,

          value: toSerializable(
            returnValue
          ),

          returnValue: toSerializable(
            returnValue
          )
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

      recorder.fail(
        {
          name: (
            error?.name ??
            "JavaScriptExecutionError"
          ),

          errorType: (
            error?.name ??
            "JavaScriptExecutionError"
          ),

          code: (
            error?.code ??
            null
          ),

          message: (
            error?.message ??
            "JavaScript execution failed."
          )
        },

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
        }
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
