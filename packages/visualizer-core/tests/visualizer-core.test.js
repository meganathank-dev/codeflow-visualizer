"use strict";

const assert = require("node:assert/strict");

const {
  TraceRecorder,
  EVENT_TYPES,
  LANGUAGES,
  TRACE_DOMAINS,
  TRACE_STATUSES
} = require("@codeflow/execution-trace");

const {
  StateReconstructor,
  TimelineController,
  SUPPORTED_PLAYBACK_SPEEDS
} = require("../src");

function createProgramTrace() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-program-test"
  });

  recorder.start({
    filename: "basic-flow.js"
  });

  recorder.record(
    EVENT_TYPES.VARIABLE_DECLARE,
    {
      name: "total",
      value: 0
    },
    {
      source: {
        line: 1,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.ARRAY_CREATE,
    {
      name: "numbers",
      values: [2, 4, 6]
    },
    {
      source: {
        line: 2,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.LOOP_START,
    {
      loopId: "main-loop",
      loopType: "for"
    },
    {
      source: {
        line: 4,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.LOOP_ITERATION,
    {
      loopId: "main-loop",
      iteration: 0
    },
    {
      source: {
        line: 4,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.ARRAY_UPDATE,
    {
      name: "numbers",
      index: 0,
      previousValue: 2,
      value: 4
    },
    {
      source: {
        line: 5,
        column: 3
      }
    }
  );

  recorder.record(
    EVENT_TYPES.VARIABLE_UPDATE,
    {
      name: "total",
      previousValue: 0,
      value: 4
    },
    {
      source: {
        line: 6,
        column: 3
      }
    }
  );

  recorder.record(
    EVENT_TYPES.CONDITION_EVALUATE,
    {
      expression: "total > 0",
      result: true
    },
    {
      source: {
        line: 8,
        column: 5
      }
    }
  );

  recorder.record(
    EVENT_TYPES.BRANCH_ENTER,
    {
      branch: "if"
    },
    {
      source: {
        line: 8,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_CALL,
    {
      name: "double",
      arguments: [4]
    },
    {
      source: {
        line: 9,
        column: 3
      }
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_ENTER,
    {
      name: "double",
      parameters: {
        value: 4
      }
    },
    {
      source: {
        line: 12,
        column: 1
      },
      scopeId: "double:1"
    }
  );

  recorder.record(
    EVENT_TYPES.VARIABLE_DECLARE,
    {
      name: "doubled",
      value: 8
    },
    {
      source: {
        line: 13,
        column: 3
      },
      scopeId: "double:1"
    }
  );

  recorder.record(
    EVENT_TYPES.OUTPUT,
    {
      channel: "stdout",
      text: "Doubled value: 8"
    },
    {
      source: {
        line: 14,
        column: 3
      }
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_RETURN,
    {
      name: "double",
      value: 8
    },
    {
      source: {
        line: 15,
        column: 3
      },
      scopeId: "double:1"
    }
  );

  recorder.record(
    EVENT_TYPES.BRANCH_EXIT,
    {
      branch: "if"
    }
  );

  recorder.record(
    EVENT_TYPES.LOOP_END,
    {
      loopId: "main-loop"
    }
  );

  recorder.finish({
    exitCode: 0
  });

  return recorder.toJSON();
}

function createSqlTrace() {
  const students = [
    {
      name: "Arun",
      marks: 72
    },
    {
      name: "Divya",
      marks: 92
    },
    {
      name: "Nila",
      marks: 88
    },
    {
      name: "Kavin",
      marks: 84
    },
    {
      name: "Manoj",
      marks: 65
    }
  ];

  const matchingRows = [
    {
      name: "Divya",
      marks: 92
    },
    {
      name: "Nila",
      marks: 88
    },
    {
      name: "Kavin",
      marks: 84
    }
  ];

  const recorder = new TraceRecorder({
    language: LANGUAGES.SQL,
    traceId: "visualizer-core-sql-test"
  });

  recorder.start({
    query:
      "SELECT name, marks FROM students WHERE marks > 80 ORDER BY marks DESC"
  });

  recorder.record(
    EVENT_TYPES.SQL_SCAN,
    {
      table: "students",
      rows: students,
      scannedRows: students.length
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_FILTER,
    {
      condition: "marks > 80",
      rows: matchingRows,
      matchingRows: matchingRows.length,
      rejectedRows: 2
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_PROJECT,
    {
      columns: [
        "name",
        "marks"
      ]
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_SORT,
    {
      column: "marks",
      direction: "DESC"
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_RESULT,
    {
      rows: matchingRows
    }
  );

  recorder.finish({
    rowCount: 3
  });

  return recorder.toJSON();
}

function createDataStructureTrace() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.PYTHON,
    traceId: "visualizer-core-data-structures-test"
  });

  recorder.start();

  recorder.record(
    EVENT_TYPES.STACK_CREATE,
    {
      name: "letters",
      values: []
    }
  );

  recorder.record(
    EVENT_TYPES.STACK_PUSH,
    {
      name: "letters",
      value: "A"
    }
  );

  recorder.record(
    EVENT_TYPES.STACK_PUSH,
    {
      name: "letters",
      value: "B"
    }
  );

  recorder.record(
    EVENT_TYPES.STACK_POP,
    {
      name: "letters",
      value: "B"
    }
  );

  recorder.record(
    EVENT_TYPES.QUEUE_CREATE,
    {
      name: "tasks",
      values: []
    }
  );

  recorder.record(
    EVENT_TYPES.QUEUE_ENQUEUE,
    {
      name: "tasks",
      value: "first"
    }
  );

  recorder.record(
    EVENT_TYPES.QUEUE_ENQUEUE,
    {
      name: "tasks",
      value: "second"
    }
  );

  recorder.record(
    EVENT_TYPES.QUEUE_PEEK,
    {
      name: "tasks",
      value: "first"
    }
  );

  recorder.record(
    EVENT_TYPES.QUEUE_DEQUEUE,
    {
      name: "tasks",
      value: "first"
    }
  );

  recorder.finish();

  return recorder.toJSON();
}

function testLinkedListReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-linked-list-test"
  });

  const first = { id: "node:1", value: 10, nextId: null };
  const second = { id: "node:2", value: 20, nextId: null };

  recorder.start();
  recorder.record(EVENT_TYPES.LINKED_LIST_CREATE, {
    name: "linkedList",
    listName: "linkedList",
    nodes: [],
    headId: null,
    tailId: null
  });
  recorder.record(EVENT_TYPES.NODE_CREATE, {
    name: "linkedList",
    listName: "linkedList",
    nodeId: first.id,
    value: first.value
  });
  recorder.record(EVENT_TYPES.REFERENCE_UPDATE, {
    name: "linkedList",
    listName: "linkedList",
    reference: "head",
    targetNodeId: first.id
  });
  recorder.record(EVENT_TYPES.NODE_INSERT, {
    name: "linkedList",
    listName: "linkedList",
    nodeId: first.id,
    value: first.value,
    index: 0,
    nodes: [first],
    headId: first.id,
    tailId: first.id
  });
  recorder.record(EVENT_TYPES.NODE_INSERT, {
    name: "linkedList",
    listName: "linkedList",
    nodeId: second.id,
    value: second.value,
    index: 1,
    nodes: [{ ...first, nextId: second.id }, second],
    headId: first.id,
    tailId: second.id
  });
  recorder.record(EVENT_TYPES.NODE_VISIT, {
    name: "linkedList",
    listName: "linkedList",
    nodeId: second.id,
    value: second.value,
    index: 1
  });
  recorder.record(EVENT_TYPES.NODE_DELETE, {
    name: "linkedList",
    listName: "linkedList",
    nodeId: first.id,
    value: first.value,
    index: 0,
    nodes: [second],
    headId: second.id,
    tailId: second.id
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.deepEqual(reconstructor.getStateAt(1).linkedLists.linkedList.nodes, []);
  assert.equal(reconstructor.getStateAt(3).linkedLists.linkedList.headId, first.id);
  assert.deepEqual(
    reconstructor.getStateAt(5).linkedLists.linkedList.nodes.map((node) => node.value),
    [10, 20]
  );
  assert.equal(reconstructor.getStateAt(6).linkedLists.linkedList.activeNodeId, second.id);
  assert.deepEqual(
    reconstructor.getStateAt(7).linkedLists.linkedList.nodes.map((node) => node.value),
    [20]
  );
  assert.equal(reconstructor.getStateAt(7).linkedLists.linkedList.headId, second.id);
}

function testHashMapReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-hash-map-test"
  });

  recorder.start();
  recorder.record(EVENT_TYPES.HASHMAP_CREATE, {
    name: "scores",
    mapName: "scores",
    entries: []
  });
  recorder.record(EVENT_TYPES.HASHMAP_SET, {
    name: "scores",
    key: "Alice",
    value: 90
  });
  recorder.record(EVENT_TYPES.HASHMAP_SET, {
    name: "scores",
    key: "Bob",
    value: 80
  });
  recorder.record(EVENT_TYPES.HASHMAP_SET, {
    name: "scores",
    key: "Bob",
    value: 85,
    previousValue: 80
  });
  recorder.record(EVENT_TYPES.HASHMAP_GET, {
    name: "scores",
    key: "Bob",
    value: 85
  });
  recorder.record(EVENT_TYPES.HASHMAP_HAS, {
    name: "scores",
    key: "Alice",
    result: true
  });
  recorder.record(EVENT_TYPES.HASHMAP_DELETE, {
    name: "scores",
    key: "Alice",
    value: 90
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.deepEqual(reconstructor.getStateAt(1).hashMaps.scores.entries, []);
  assert.equal(reconstructor.getStateAt(3).hashMaps.scores.size, 2);
  assert.deepEqual(reconstructor.getStateAt(4).hashMaps.scores.entries, [
    { key: "Alice", value: 90 },
    { key: "Bob", value: 85 }
  ]);
  assert.equal(reconstructor.getStateAt(5).hashMaps.scores.activeKey, "Bob");
  assert.equal(reconstructor.getStateAt(6).hashMaps.scores.lastResult, true);
  assert.deepEqual(reconstructor.getStateAt(7).hashMaps.scores.entries, [
    { key: "Bob", value: 85 }
  ]);
}

function testTreeReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-tree-test"
  });
  const root = {
    id: "tree-node:1",
    value: 50,
    leftId: null,
    rightId: null,
    parentId: null
  };
  const left = {
    id: "tree-node:2",
    value: 30,
    leftId: null,
    rightId: null,
    parentId: root.id
  };
  const right = {
    id: "tree-node:3",
    value: 70,
    leftId: null,
    rightId: null,
    parentId: root.id
  };

  recorder.start();
  recorder.record(EVENT_TYPES.TREE_CREATE, {
    name: "tree",
    treeName: "tree",
    nodes: [],
    rootId: null
  });
  recorder.record(EVENT_TYPES.TREE_INSERT, {
    name: "tree",
    nodes: [root],
    rootId: root.id,
    insertedNodeId: root.id,
    path: [root.id]
  });
  recorder.record(EVENT_TYPES.TREE_INSERT, {
    name: "tree",
    nodes: [{ ...root, leftId: left.id }, left],
    rootId: root.id,
    insertedNodeId: left.id,
    path: [root.id, left.id]
  });
  recorder.record(EVENT_TYPES.TREE_INSERT, {
    name: "tree",
    nodes: [{ ...root, leftId: left.id, rightId: right.id }, left, right],
    rootId: root.id,
    insertedNodeId: right.id,
    path: [root.id, right.id]
  });
  recorder.record(EVENT_TYPES.TREE_SEARCH, {
    name: "tree",
    target: 30,
    found: true,
    foundNodeId: left.id,
    path: [root.id, left.id]
  });
  recorder.record(EVENT_TYPES.TREE_TRAVERSE, {
    name: "tree",
    traversalType: "inorder",
    visitedIds: [left.id, root.id, right.id],
    order: [30, 50, 70]
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.equal(reconstructor.getStateAt(1).trees.tree.rootId, null);
  assert.equal(reconstructor.getStateAt(2).trees.tree.nodes.length, 1);
  assert.equal(reconstructor.getStateAt(4).trees.tree.nodes.length, 3);
  assert.equal(reconstructor.getStateAt(5).trees.tree.searchResult, true);
  assert.deepEqual(reconstructor.getStateAt(5).trees.tree.visitedIds, [root.id, left.id]);
  assert.deepEqual(reconstructor.getStateAt(6).trees.tree.traversalOrder, [30, 50, 70]);
}

function testHeapReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-heap-test"
  });

  recorder.start();
  recorder.record(EVENT_TYPES.HEAP_CREATE, {
    name: "heap",
    heapName: "heap",
    heapType: "min",
    values: []
  });
  recorder.record(EVENT_TYPES.HEAP_INSERT, {
    name: "heap",
    heapName: "heap",
    value: 40,
    index: 0,
    values: [40]
  });
  recorder.record(EVENT_TYPES.HEAP_INSERT, {
    name: "heap",
    heapName: "heap",
    value: 10,
    index: 1,
    values: [40, 10]
  });
  recorder.record(EVENT_TYPES.HEAP_SWAP, {
    name: "heap",
    heapName: "heap",
    fromIndex: 1,
    toIndex: 0,
    values: [10, 40]
  });
  recorder.record(EVENT_TYPES.HEAP_INSERT, {
    name: "heap",
    heapName: "heap",
    value: 30,
    index: 2,
    values: [10, 40, 30]
  });
  recorder.record(EVENT_TYPES.HEAP_PEEK, {
    name: "heap",
    heapName: "heap",
    value: 10,
    values: [10, 40, 30]
  });
  recorder.record(EVENT_TYPES.HEAP_EXTRACT, {
    name: "heap",
    heapName: "heap",
    value: 10,
    values: [30, 40]
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.deepEqual(reconstructor.getStateAt(1).heaps.heap.values, []);
  assert.deepEqual(reconstructor.getStateAt(3).heaps.heap.values, [40, 10]);
  assert.deepEqual(reconstructor.getStateAt(4).heaps.heap.values, [10, 40]);
  assert.deepEqual(reconstructor.getStateAt(4).heaps.heap.activeIndices, [1, 0]);
  assert.deepEqual(reconstructor.getStateAt(4).heaps.heap.swap, {
    fromIndex: 1,
    toIndex: 0
  });
  assert.equal(reconstructor.getStateAt(6).heaps.heap.peekedValue, 10);
  assert.equal(reconstructor.getStateAt(7).heaps.heap.extractedValue, 10);
  assert.deepEqual(reconstructor.getStateAt(7).heaps.heap.values, [30, 40]);
}

function testGraphReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-graph-test"
  });

  const first = { id: "graph-node:1", value: "A" };
  const second = { id: "graph-node:2", value: "B" };
  const third = { id: "graph-node:3", value: "C" };
  const firstEdge = {
    id: "graph-edge:1",
    sourceId: first.id,
    targetId: second.id
  };
  const secondEdge = {
    id: "graph-edge:2",
    sourceId: first.id,
    targetId: third.id
  };
  const base = { name: "graph", graphName: "graph", directed: false };

  recorder.start();
  recorder.record(EVENT_TYPES.GRAPH_CREATE, { ...base, nodes: [], edges: [] });
  recorder.record(EVENT_TYPES.GRAPH_NODE_ADD, {
    ...base,
    nodeId: first.id,
    value: first.value,
    nodes: [first],
    edges: []
  });
  recorder.record(EVENT_TYPES.GRAPH_NODE_ADD, {
    ...base,
    nodeId: second.id,
    value: second.value,
    nodes: [first, second],
    edges: []
  });
  recorder.record(EVENT_TYPES.GRAPH_NODE_ADD, {
    ...base,
    nodeId: third.id,
    value: third.value,
    nodes: [first, second, third],
    edges: []
  });
  recorder.record(EVENT_TYPES.GRAPH_EDGE_ADD, {
    ...base,
    edgeId: firstEdge.id,
    sourceId: first.id,
    targetId: second.id,
    nodes: [first, second, third],
    edges: [firstEdge]
  });
  recorder.record(EVENT_TYPES.GRAPH_EDGE_ADD, {
    ...base,
    edgeId: secondEdge.id,
    sourceId: first.id,
    targetId: third.id,
    nodes: [first, second, third],
    edges: [firstEdge, secondEdge]
  });
  recorder.record(EVENT_TYPES.GRAPH_VISIT, {
    ...base,
    traversalType: "bfs",
    nodeId: first.id,
    value: first.value,
    visitedIds: [first.id],
    nodes: [first, second, third],
    edges: [firstEdge, secondEdge]
  });
  recorder.record(EVENT_TYPES.GRAPH_EDGE_TRAVERSE, {
    ...base,
    traversalType: "bfs",
    edgeId: firstEdge.id,
    sourceId: first.id,
    targetId: second.id,
    nodes: [first, second, third],
    edges: [firstEdge, secondEdge]
  });
  recorder.record(EVENT_TYPES.GRAPH_VISIT, {
    ...base,
    traversalType: "bfs",
    nodeId: second.id,
    value: second.value,
    visitedIds: [first.id, second.id],
    nodes: [first, second, third],
    edges: [firstEdge, secondEdge]
  });
  recorder.record(EVENT_TYPES.GRAPH_TRAVERSE, {
    ...base,
    traversalType: "bfs",
    visitedIds: [first.id, second.id, third.id],
    order: ["A", "B", "C"],
    nodes: [first, second, third],
    edges: [firstEdge, secondEdge]
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.deepEqual(reconstructor.getStateAt(1).graphs.graph.nodes, []);
  assert.equal(reconstructor.getStateAt(4).graphs.graph.nodes.length, 3);
  assert.equal(reconstructor.getStateAt(6).graphs.graph.edges.length, 2);
  assert.equal(reconstructor.getStateAt(7).graphs.graph.activeNodeId, first.id);
  assert.equal(reconstructor.getStateAt(8).graphs.graph.activeEdgeId, firstEdge.id);
  assert.deepEqual(reconstructor.getStateAt(9).graphs.graph.visitedIds, [first.id, second.id]);
  assert.deepEqual(reconstructor.getStateAt(10).graphs.graph.traversalOrder, ["A", "B", "C"]);
  assert.equal(reconstructor.getStateAt(10).graphs.graph.traversalType, "bfs");
}

function testSearchReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,
    traceId: "visualizer-core-search-test"
  });
  const values = [4, 8, 15, 16, 23, 42];
  const binary = {
    searchId: "search:1",
    algorithm: "binary",
    arrayName: "numbers",
    values,
    target: 23
  };

  recorder.start();
  recorder.record(EVENT_TYPES.SEARCH_START, {
    ...binary, low: 0, high: 5, middle: 2, comparedIndices: [], eliminatedIndices: []
  });
  recorder.record(EVENT_TYPES.SEARCH_COMPARE, {
    ...binary, low: 0, high: 5, middle: 2, index: 2, value: 15,
    comparedIndices: [2], eliminatedIndices: [], comparisonCount: 1
  });
  recorder.record(EVENT_TYPES.SEARCH_RANGE_UPDATE, {
    ...binary, low: 3, high: 5, middle: 4, previousIndex: 2,
    comparedIndices: [2], eliminatedIndices: [0, 1, 2], comparisonCount: 1
  });
  recorder.record(EVENT_TYPES.SEARCH_COMPARE, {
    ...binary, low: 3, high: 5, middle: 4, index: 4, value: 23,
    comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
  });
  recorder.record(EVENT_TYPES.SEARCH_FOUND, {
    ...binary, low: 3, high: 5, middle: 4, index: 4, foundIndex: 4, found: true,
    comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
  });
  recorder.record(EVENT_TYPES.SEARCH_END, {
    ...binary, low: 3, high: 5, middle: 4, foundIndex: 4, found: true,
    comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
  });

  const linear = {
    searchId: "search:2",
    algorithm: "linear",
    arrayName: "numbers",
    values,
    target: 99,
    low: 6,
    high: 5,
    middle: null,
    comparedIndices: [0, 1, 2, 3, 4, 5],
    eliminatedIndices: [0, 1, 2, 3, 4, 5],
    comparisonCount: 6
  };

  recorder.record(EVENT_TYPES.SEARCH_START, {
    ...linear, low: 0, comparedIndices: [], eliminatedIndices: [], comparisonCount: 0
  });
  recorder.record(EVENT_TYPES.SEARCH_NOT_FOUND, {
    ...linear, found: false, foundIndex: -1
  });
  recorder.record(EVENT_TYPES.SEARCH_END, {
    ...linear, found: false, foundIndex: -1
  });
  recorder.finish();

  const reconstructor = new StateReconstructor(recorder.toJSON(), {
    checkpointInterval: 2
  });

  assert.equal(reconstructor.getStateAt(1).searches["search:1"].middle, 2);
  assert.equal(reconstructor.getStateAt(2).searches["search:1"].activeIndex, 2);
  assert.deepEqual(
    reconstructor.getStateAt(3).searches["search:1"].eliminatedIndices,
    [0, 1, 2]
  );
  assert.equal(reconstructor.getStateAt(3).searches["search:1"].low, 3);
  assert.equal(reconstructor.getStateAt(5).searches["search:1"].foundIndex, 4);
  assert.equal(reconstructor.getStateAt(6).searches["search:1"].finished, true);
  assert.equal(reconstructor.getStateAt(8).searches["search:2"].found, false);
  assert.equal(reconstructor.getStateAt(9).searches["search:2"].foundIndex, -1);
  assert.equal(reconstructor.getStateAt(9).searches["search:2"].comparisonCount, 6);
}

function testProgramStateReconstruction(trace) {
  const reconstructor = new StateReconstructor(
    trace,
    {
      checkpointInterval: 3
    }
  );

  assert.equal(
    reconstructor.totalSteps,
    17
  );

  const initialState = reconstructor.getStateAt(-1);

  assert.equal(
    initialState.step,
    -1
  );

  assert.equal(
    initialState.status,
    TRACE_STATUSES.IDLE
  );

  assert.deepEqual(
    initialState.variables,
    {}
  );

  const declarationState = reconstructor.getStateAt(1);

  assert.equal(
    declarationState.variables.total,
    0
  );

  const arrayState = reconstructor.getStateAt(2);

  assert.deepEqual(
    arrayState.arrays.numbers,
    [2, 4, 6]
  );

  const loopState = reconstructor.getStateAt(4);

  assert.equal(
    loopState.controlFlow.loops["main-loop"].active,
    true
  );

  assert.equal(
    loopState.controlFlow.loops["main-loop"].iteration,
    0
  );

  const updatedArrayState = reconstructor.getStateAt(5);

  assert.deepEqual(
    updatedArrayState.arrays.numbers,
    [4, 4, 6]
  );

  const updatedVariableState = reconstructor.getStateAt(6);

  assert.equal(
    updatedVariableState.variables.total,
    4
  );

  const conditionState = reconstructor.getStateAt(7);

  assert.equal(
    conditionState.controlFlow.lastCondition.result,
    true
  );

  const branchState = reconstructor.getStateAt(8);

  assert.equal(
    branchState.controlFlow.branches.length,
    1
  );

  const functionState = reconstructor.getStateAt(10);

  assert.equal(
    functionState.callStack.length,
    1
  );

  assert.equal(
    functionState.callStack[0].name,
    "double"
  );

  assert.equal(
    functionState.variables.value,
    4
  );

  const localVariableState = reconstructor.getStateAt(11);

  assert.equal(
    localVariableState.variables.doubled,
    8
  );

  const outputState = reconstructor.getStateAt(12);

  assert.equal(
    outputState.console.length,
    1
  );

  assert.equal(
    outputState.console[0].text,
    "Doubled value: 8"
  );

  const returnedState = reconstructor.getStateAt(13);

  assert.equal(
    returnedState.callStack.length,
    0
  );

  assert.equal(
    Object.hasOwn(
      returnedState.variables,
      "doubled"
    ),
    false
  );

  assert.equal(
    Object.hasOwn(
      returnedState.variables,
      "value"
    ),
    false
  );

  const finalState = reconstructor.getStateAt(16);

  assert.equal(
    finalState.status,
    TRACE_STATUSES.COMPLETED
  );

  assert.equal(
    finalState.variables.total,
    4
  );

  assert.deepEqual(
    finalState.arrays.numbers,
    [4, 4, 6]
  );

  assert.equal(
    finalState.controlFlow.loops["main-loop"].active,
    false
  );

  assert.equal(
    finalState.controlFlow.branches.length,
    0
  );

  return reconstructor;
}

function testCheckpointBehavior(reconstructor) {
  const checkpointSteps = reconstructor.getCheckpointSteps();

  assert.deepEqual(
    checkpointSteps,
    [
      -1,
      2,
      5,
      8,
      11,
      14,
      16
    ]
  );

  const firstRead = reconstructor.getStateAt(5);

  firstRead.arrays.numbers.push(999);

  const secondRead = reconstructor.getStateAt(5);

  assert.deepEqual(
    secondRead.arrays.numbers,
    [4, 4, 6]
  );

  assert.equal(
    reconstructor.getEventAt(-1),
    null
  );

  assert.equal(
    reconstructor.getEventAt(5).type,
    EVENT_TYPES.ARRAY_UPDATE
  );

  assert.throws(
    () => {
      reconstructor.getStateAt(500);
    },
    /outside the available timeline/
  );

  assert.throws(
    () => {
      reconstructor.getStateAt(1.5);
    },
    /must be an integer/
  );

  assert.equal(
    reconstructor.reconstructAll().length,
    17
  );
}

function testSqlStateReconstruction(trace) {
  const reconstructor = new StateReconstructor(
    trace,
    {
      checkpointInterval: 2
    }
  );

  const initialState = reconstructor.getStateAt(-1);

  assert.equal(
    initialState.domain,
    TRACE_DOMAINS.QUERY
  );

  const queryState = reconstructor.getStateAt(0);

  assert.equal(
    queryState.query.text.includes("SELECT name, marks"),
    true
  );

  const scanState = reconstructor.getStateAt(1);

  assert.equal(
    scanState.query.currentRows.length,
    5
  );

  assert.equal(
    scanState.query.scannedRowCount,
    5
  );

  const filterState = reconstructor.getStateAt(2);

  assert.equal(
    filterState.query.currentRows.length,
    3
  );

  assert.equal(
    filterState.query.matchingRowCount,
    3
  );

  assert.equal(
    filterState.query.rejectedRowCount,
    2
  );

  const projectionState = reconstructor.getStateAt(3);

  assert.deepEqual(
    projectionState.query.columns,
    [
      "name",
      "marks"
    ]
  );

  const sortState = reconstructor.getStateAt(4);

  assert.equal(
    sortState.query.currentRows[0].name,
    "Divya"
  );

  const resultState = reconstructor.getStateAt(5);

  assert.equal(
    resultState.query.resultRows.length,
    3
  );

  assert.deepEqual(
    resultState.query.resultRows.map(
      (row) => row.name
    ),
    [
      "Divya",
      "Nila",
      "Kavin"
    ]
  );

  const finalState = reconstructor.getStateAt(6);

  assert.equal(
    finalState.status,
    TRACE_STATUSES.COMPLETED
  );

  assert.equal(
    finalState.query.operations.length,
    5
  );

  return reconstructor;
}

function testDataStructureReconstruction(trace) {
  const reconstructor = new StateReconstructor(trace);

  const stackState = reconstructor.getStateAt(3);

  assert.deepEqual(
    stackState.stacks.letters,
    [
      "A",
      "B"
    ]
  );

  const poppedStackState = reconstructor.getStateAt(4);

  assert.deepEqual(
    poppedStackState.stacks.letters,
    [
      "A"
    ]
  );

  const queueState = reconstructor.getStateAt(7);

  assert.deepEqual(
    queueState.queues.tasks,
    [
      "first",
      "second"
    ]
  );

  const peekedQueueState = reconstructor.getStateAt(8);

  assert.deepEqual(
    peekedQueueState.queues.tasks,
    [
      "first",
      "second"
    ]
  );

  const dequeuedQueueState = reconstructor.getStateAt(9);

  assert.deepEqual(
    dequeuedQueueState.queues.tasks,
    [
      "second"
    ]
  );
}

function testTimelineNavigation(trace) {
  const controller = new TimelineController(
    trace,
    {
      checkpointInterval: 3,
      baseIntervalMs: 10
    }
  );

  const observedSteps = [];

  const unsubscribe = controller.subscribe((snapshot) => {
    observedSteps.push(
      snapshot.currentStep
    );
  });

  try {
    assert.equal(
      controller.currentStep,
      -1
    );

    assert.equal(
      controller.totalSteps,
      17
    );

    const first = controller.first();

    assert.equal(
      first.currentStep,
      0
    );

    assert.equal(
      first.event.type,
      EVENT_TYPES.PROGRAM_START
    );

    const next = controller.next();

    assert.equal(
      next.currentStep,
      1
    );

    assert.equal(
      next.state.variables.total,
      0
    );

    const arrayUpdate = controller.seek(5);

    assert.deepEqual(
      arrayUpdate.state.arrays.numbers,
      [4, 4, 6]
    );

    const previous = controller.previous();

    assert.equal(
      previous.currentStep,
      4
    );

    assert.deepEqual(
      previous.state.arrays.numbers,
      [2, 4, 6]
    );

    const last = controller.last();

    assert.equal(
      last.currentStep,
      16
    );

    assert.equal(
      last.state.status,
      TRACE_STATUSES.COMPLETED
    );

    assert.equal(
      last.canNext,
      false
    );

    const reset = controller.reset();

    assert.equal(
      reset.currentStep,
      -1
    );

    assert.deepEqual(
      reset.state.variables,
      {}
    );

    assert.deepEqual(
      SUPPORTED_PLAYBACK_SPEEDS,
      [
        0.25,
        0.5,
        1,
        1.5,
        2
      ]
    );

    assert.equal(
      controller.setSpeed(2),
      2
    );

    assert.throws(
      () => {
        controller.setSpeed(3);
      },
      /Unsupported playback speed/
    );

    assert.throws(
      () => {
        controller.seek(100);
      },
      /outside the available range/
    );

    assert.equal(
      observedSteps.length > 0,
      true
    );
  } finally {
    unsubscribe();

    controller.destroy();
  }
}

function waitForPlaybackCompletion(
  controller,
  timeoutMs = 10_000
) {
  return new Promise((resolve, reject) => {
    let settled = false;

    let timeoutId = null;

    let unsubscribe = () => {};

    function cleanup() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);

        timeoutId = null;
      }

      unsubscribe();
    }

    function resolvePlayback(snapshot) {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      resolve(snapshot);
    }

    function rejectPlayback(error) {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      controller.pause();

      reject(error);
    }

    unsubscribe = controller.subscribe((snapshot) => {
      const reachedFinalStep = (
        snapshot.currentStep === controller.lastStep
      );

      const playbackStopped = (
        snapshot.isPlaying === false
      );

      if (
        reachedFinalStep &&
        playbackStopped
      ) {
        resolvePlayback(snapshot);
      }
    });

    timeoutId = setTimeout(() => {
      rejectPlayback(
        new Error(
          "Automatic playback did not finish before the timeout"
        )
      );
    }, timeoutMs);

    controller.play();

    if (
      controller.currentStep === controller.lastStep &&
      controller.isPlaying === false
    ) {
      resolvePlayback(
        controller.getSnapshot()
      );

      return;
    }

    if (!controller.isPlaying) {
      rejectPlayback(
        new Error(
          "Automatic playback could not be started"
        )
      );
    }
  });
}

async function testAutomaticPlayback(trace) {
  const controller = new TimelineController(
    trace,
    {
      baseIntervalMs: 4,
      speed: 2
    }
  );

  try {
    const playbackPromise = waitForPlaybackCompletion(
      controller
    );

    assert.equal(
      controller.isPlaying,
      true
    );

    const finalSnapshot = await playbackPromise;

    assert.equal(
      finalSnapshot.currentStep,
      16
    );

    assert.equal(
      controller.currentStep,
      16
    );

    assert.equal(
      controller.isPlaying,
      false
    );

    const finalState = controller.getState();

    assert.equal(
      finalState.variables.total,
      4
    );

    assert.deepEqual(
      finalState.arrays.numbers,
      [4, 4, 6]
    );
  } finally {
    controller.destroy();
  }
}

function testErrorStateReconstruction() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVA,
    traceId: "visualizer-core-error-test"
  });

  recorder.start();

  recorder.fail(
    {
      name: "ArithmeticException",
      message: "/ by zero"
    },
    {
      source: {
        line: 7,
        column: 10
      }
    }
  );

  const reconstructor = new StateReconstructor(
    recorder.toJSON()
  );

  const errorState = reconstructor.getStateAt(1);

  assert.equal(
    errorState.status,
    TRACE_STATUSES.FAILED
  );

  assert.equal(
    errorState.errors.length,
    1
  );

  assert.equal(
    errorState.errors[0].name,
    "ArithmeticException"
  );

  assert.equal(
    errorState.errors[0].source.line,
    7
  );
}

async function runTests() {
  const programTrace = createProgramTrace();

  const sqlTrace = createSqlTrace();

  const dataStructureTrace = createDataStructureTrace();

  const programReconstructor = testProgramStateReconstruction(
    programTrace
  );

  testCheckpointBehavior(
    programReconstructor
  );

  const sqlReconstructor = testSqlStateReconstruction(
    sqlTrace
  );

  testDataStructureReconstruction(
    dataStructureTrace
  );

  testLinkedListReconstruction();

  testHashMapReconstruction();

  testTreeReconstruction();

  testHeapReconstruction();

  testGraphReconstruction();

  testSearchReconstruction();

  testTimelineNavigation(
    programTrace
  );

  await testAutomaticPlayback(
    programTrace
  );

  testErrorStateReconstruction();

  const finalProgramState = programReconstructor.getStateAt(
    programReconstructor.totalSteps - 1
  );

  const finalSqlState = sqlReconstructor.getStateAt(
    sqlReconstructor.totalSteps - 1
  );

  console.log(
    "Visualizer core package tests passed."
  );

  console.log(
    `Program replay states: ${programReconstructor.totalSteps}`
  );

  console.log(
    `Final program total: ${finalProgramState.variables.total}`
  );

  console.log(
    `Final program array: ${JSON.stringify(finalProgramState.arrays.numbers)}`
  );

  console.log(
    `SQL result rows: ${finalSqlState.query.resultRows.length}`
  );

  console.log(
    "Checkpoint reconstruction: passed"
  );

  console.log(
    "Timeline navigation: passed"
  );

  console.log(
    "Automatic playback: passed"
  );

  console.log(
    "Stack and queue reconstruction: passed"
  );

  console.log(
    "Linked-list node and reference reconstruction: passed"
  );

  console.log(
    "HashMap key-value reconstruction: passed"
  );

  console.log(
    "Binary-search-tree reconstruction: passed"
  );

  console.log(
    "Min-heap reconstruction and swap replay: passed"
  );

  console.log(
    "Graph node, edge, and traversal reconstruction: passed"
  );

  console.log(
    "Linear and binary search reconstruction: passed"
  );
}

runTests().catch((error) => {
  console.error(
    "Visualizer core package tests failed."
  );

  console.error(error);

  process.exitCode = 1;
});
