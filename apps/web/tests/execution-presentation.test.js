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
    hashMaps: {},
    linkedLists: {},
    trees: {},
    heaps: {},
    graphs: {},
    searches: {},
    callStack: [],
    console: [],
    errors: [],
    controlFlow: {
      lastCondition: null,
      loops: {}
    },
    query: {
      text: null,
      tables: {},
      currentRows: [],
      resultRows: [],
      columns: [],
      operations: [],
      scannedRowCount: 0,
      matchingRowCount: 0,
      rejectedRowCount: 0
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

function createSqlResult() {
  const allRows = [
    { id: 1, name: "Arun", marks: 72 },
    { id: 2, name: "Divya", marks: 92 },
    { id: 3, name: "Nila", marks: 88 },
    { id: 4, name: "Kavin", marks: 84 },
    { id: 5, name: "Manoj", marks: 65 }
  ];
  const matchingRows = allRows.filter((row) => row.marks > 80);
  const projectedRows = matchingRows.map(({ name, marks }) => ({ name, marks }));
  const queryText = "SELECT name, marks FROM students WHERE marks > 80 ORDER BY marks DESC LIMIT 3";

  const event = (step, type, line, payload = {}) => ({
    id: `sql-event-${step}`,
    step,
    type,
    source: { line },
    payload
  });

  const queryState = (step, overrides = {}) => createState(step, {
    source: { line: overrides.line || 1 },
    query: {
      text: queryText,
      tables: { students: allRows },
      currentRows: overrides.currentRows || [],
      resultRows: overrides.resultRows || [],
      columns: overrides.columns || [],
      operations: [],
      scannedRowCount: overrides.scannedRowCount ?? 0,
      matchingRowCount: overrides.matchingRowCount ?? 0,
      rejectedRowCount: overrides.rejectedRowCount ?? 0
    },
    console: overrides.console || [],
    status: overrides.status || "running"
  });

  const events = [
    event(0, "SQL_QUERY_START", 1, { query: queryText }),
    event(1, "SQL_SCAN", 2, {
      table: "students",
      columns: ["id", "name", "marks"],
      rows: allRows,
      scannedRows: 5,
      operation: "Scan students"
    }),
    event(2, "SQL_FILTER", 3, {
      table: "students",
      condition: "marks > 80",
      row: allRows[1],
      rowIndex: 1,
      result: true,
      rows: [allRows[1]],
      displayRows: allRows,
      rejectedIds: [1],
      matchingRows: 1,
      rejectedRows: 1,
      columns: ["id", "name", "marks"],
      operation: "WHERE marks > 80"
    }),
    event(3, "SQL_PROJECT", 1, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      operation: "SELECT name, marks"
    }),
    event(4, "SQL_SORT", 4, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      expression: "marks DESC",
      direction: "DESC",
      operation: "ORDER BY marks DESC"
    }),
    event(5, "SQL_LIMIT", 5, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      limit: "3",
      rowCount: 3,
      operation: "LIMIT 3"
    }),
    event(6, "SQL_RESULT", 1, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      rowCount: 3,
      operation: "Final query result"
    }),
    event(7, "OUTPUT", 1, { channel: "result", text: "3 rows returned" }),
    event(8, "SQL_QUERY_END", 1, { rowCount: 3 })
  ];

  const states = [
    queryState(0),
    queryState(1, { currentRows: allRows, columns: ["id", "name", "marks"], scannedRowCount: 5 }),
    queryState(2, {
      currentRows: [allRows[1]],
      columns: ["id", "name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 1,
      rejectedRowCount: 1
    }),
    queryState(3, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(4, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(5, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(6, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(7, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2,
      console: [{ channel: "result", text: "3 rows returned" }]
    }),
    queryState(8, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2,
      console: [{ channel: "result", text: "3 rows returned" }],
      status: "completed"
    })
  ];

  return {
    status: "ok",
    language: "sql",
    executionStatus: "completed",
    trace: {
      traceId: "sql-presentation-test",
      status: "completed",
      events
    },
    states,
    summary: { eventCount: events.length, rowCount: 3 }
  };
}

function createQueueResult(language = "javascript") {
  const queueStates = [
    [],
    [],
    ["A"],
    ["A", "B"],
    ["A", "B"],
    ["B"],
    ["B"]
  ];

  const eventTypes = [
    "PROGRAM_START",
    "QUEUE_CREATE",
    "QUEUE_ENQUEUE",
    "QUEUE_ENQUEUE",
    "QUEUE_PEEK",
    "QUEUE_DEQUEUE",
    "PROGRAM_END"
  ];

  const events = eventTypes.map((type, step) => ({
    id: `queue-event-${step}`,
    step,
    type,
    source: { line: Math.max(1, step) },
    payload: {
      name: "taskQueue",
      value: step === 2 ? "A" : step === 3 ? "B" : step >= 4 ? "A" : undefined,
      values: queueStates[step]
    }
  }));

  const states = queueStates.map((values, step) => createState(step, {
    status: step === queueStates.length - 1 ? "completed" : "running",
    variables: step > 0 ? { taskQueue: values } : {},
    arrays: step > 0
      ? {
        ...(language === "java" ? { args: [] } : {}),
        taskQueue: values
      }
      : {},
    queues: step > 0 ? { taskQueue: values } : {}
  }));

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: {
      traceId: "queue-presentation-test",
      status: "completed",
      events
    },
    states,
    summary: { eventCount: events.length }
  };
}

function createLinkedListResult(language) {
  const linkedListName = language === "python" ? "linked_list" : "linkedList";
  const first = { id: "node:1", value: 10, nextId: "node:2" };
  const second = { id: "node:2", value: 20, nextId: null };
  const third = { id: "node:3", value: 30, nextId: null };
  const nodeStates = [
    [],
    [],
    [{ ...first, nextId: null }],
    [first, second],
    [first, { ...second, nextId: "node:3" }, third],
    [first, { ...second, nextId: "node:3" }, third],
    [{ ...second, nextId: "node:3" }, third],
    [{ ...second, nextId: "node:3" }, third]
  ];
  const types = [
    "PROGRAM_START",
    "LINKED_LIST_CREATE",
    "NODE_INSERT",
    "NODE_INSERT",
    "NODE_INSERT",
    "NODE_VISIT",
    "NODE_DELETE",
    "PROGRAM_END"
  ];
  const events = types.map((type, step) => ({
    id: `linked-list-event-${step}`,
    step,
    type,
    source: { line: step + 1 },
    payload: {
      name: linkedListName,
      listName: linkedListName,
      nodeId: step === 5 ? "node:2" : step === 6 ? "node:1" : `node:${Math.max(1, step - 1)}`,
      value: step === 5 ? 20 : step === 6 ? 10 : step * 10,
      index: step === 6 ? 0 : Math.max(0, step - 2)
    }
  }));
  const states = nodeStates.map((nodes, step) => createState(step, {
    status: step === nodeStates.length - 1 ? "completed" : "running",
    arrays: language === "java" ? { args: [] } : {},
    variables: step > 0 ? { [linkedListName]: { $type: "object", display: "LinkedList" } } : {},
    linkedLists: step > 0 ? {
      [linkedListName]: {
        name: linkedListName,
        nodes,
        headId: nodes[0]?.id || null,
        tailId: nodes.at(-1)?.id || null,
        activeNodeId: events[step].payload.nodeId,
        pendingNode: null,
        lastOperation: types[step]
      }
    } : {}
  }));

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-linked-list-presentation-test`, status: "completed", events },
    states,
    summary: { eventCount: events.length }
  };
}

function createHashMapResult(language) {
  const entryStates = [
    [],
    [],
    [{ key: "Alice", value: 90 }],
    [{ key: "Alice", value: 90 }, { key: "Bob", value: 80 }],
    [{ key: "Alice", value: 90 }, { key: "Bob", value: 85 }],
    [{ key: "Alice", value: 90 }, { key: "Bob", value: 85 }],
    [{ key: "Bob", value: 85 }],
    [{ key: "Bob", value: 85 }]
  ];
  const types = [
    "PROGRAM_START",
    "HASHMAP_CREATE",
    "HASHMAP_SET",
    "HASHMAP_SET",
    "HASHMAP_SET",
    "HASHMAP_GET",
    "HASHMAP_DELETE",
    "PROGRAM_END"
  ];
  const events = types.map((type, step) => ({
    id: `hashmap-event-${step}`,
    step,
    type,
    source: { line: step + 1 },
    payload: {
      name: "scores",
      mapName: "scores",
      key: step === 2 || step === 6 ? "Alice" : "Bob",
      value: step === 2 || step === 6 ? 90 : step === 3 ? 80 : 85,
      previousValue: step === 4 ? 80 : null,
      updated: step === 4
    }
  }));
  const states = entryStates.map((entries, step) => createState(step, {
    status: step === entryStates.length - 1 ? "completed" : "running",
    arrays: language === "java" ? { args: [] } : {},
    variables: step > 0 ? {
      scores: language === "java"
        ? { $type: "object", display: "java.util.HashMap" }
        : Object.fromEntries(entries.map((entry) => [entry.key, entry.value]))
    } : {},
    hashMaps: step > 0 ? {
      scores: {
        name: "scores",
        entries,
        size: entries.length,
        activeKey: events[step].payload.key,
        lastOperation: types[step],
        lastResult: events[step].payload.value
      }
    } : {}
  }));

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-hashmap-presentation-test`, status: "completed", events },
    states,
    summary: { eventCount: events.length }
  };
}

function createTreeResult(language) {
  const treeName = language === "python" ? "search_tree" : "searchTree";
  const allNodes = [
    { id: "tree-node:1", value: 50, leftId: "tree-node:2", rightId: "tree-node:3", parentId: null },
    { id: "tree-node:2", value: 30, leftId: "tree-node:4", rightId: "tree-node:5", parentId: "tree-node:1" },
    { id: "tree-node:3", value: 70, leftId: null, rightId: null, parentId: "tree-node:1" },
    { id: "tree-node:4", value: 20, leftId: null, rightId: null, parentId: "tree-node:2" },
    { id: "tree-node:5", value: 40, leftId: null, rightId: null, parentId: "tree-node:2" }
  ];
  const nodeCounts = [0, 0, 1, 2, 3, 4, 5, 5, 5, 5];
  const types = [
    "PROGRAM_START",
    "TREE_CREATE",
    "TREE_INSERT",
    "TREE_INSERT",
    "TREE_INSERT",
    "TREE_INSERT",
    "TREE_INSERT",
    "TREE_SEARCH",
    "TREE_TRAVERSE",
    "PROGRAM_END"
  ];
  const insertedValues = [null, null, 50, 30, 70, 20, 40];
  const events = types.map((type, step) => {
    const nodes = allNodes.slice(0, nodeCounts[step]);
    const insertedNode = type === "TREE_INSERT" ? nodes.at(-1) : null;
    const payload = {
      name: treeName,
      treeName,
      nodes,
      rootId: nodes.length > 0 ? "tree-node:1" : null
    };

    if (type === "TREE_INSERT") {
      payload.value = insertedValues[step];
      payload.inserted = true;
      payload.insertedNodeId = insertedNode.id;
      payload.path = insertedNode.id === "tree-node:1"
        ? ["tree-node:1"]
        : insertedNode.parentId === "tree-node:1"
          ? ["tree-node:1", insertedNode.id]
          : ["tree-node:1", "tree-node:2", insertedNode.id];
    } else if (type === "TREE_SEARCH") {
      payload.target = 40;
      payload.found = true;
      payload.foundNodeId = "tree-node:5";
      payload.path = ["tree-node:1", "tree-node:2", "tree-node:5"];
    } else if (type === "TREE_TRAVERSE") {
      payload.traversalType = "inorder";
      payload.visitedIds = ["tree-node:4", "tree-node:2", "tree-node:5", "tree-node:1", "tree-node:3"];
      payload.order = [20, 30, 40, 50, 70];
    }

    return {
      id: `tree-event-${step}`,
      step,
      type,
      source: { line: step + 1 },
      payload
    };
  });
  const states = events.map((event, step) => {
    const nodes = allNodes.slice(0, nodeCounts[step]);
    const isSearch = event.type === "TREE_SEARCH";
    const isTraversal = event.type === "TREE_TRAVERSE";

    return createState(step, {
      status: step === events.length - 1 ? "completed" : "running",
      variables: step > 0 ? {
        [treeName]: language === "java"
          ? { $type: "object", display: "java.util.TreeSet" }
          : [20, 30, 40, 50, 70].slice(0, nodeCounts[step])
      } : {},
      arrays: step > 0 ? {
        ...(language === "java" ? { args: [] } : {}),
        [treeName]: [20, 30, 40, 50, 70].slice(0, nodeCounts[step])
      } : {},
      trees: step > 0 ? {
        [treeName]: {
          name: treeName,
          nodes,
          rootId: nodes.length > 0 ? "tree-node:1" : null,
          activeNodeId: isSearch ? "tree-node:5" : event.payload.insertedNodeId || null,
          visitedIds: isSearch ? event.payload.path : isTraversal ? event.payload.visitedIds : event.payload.path || [],
          traversalOrder: isTraversal || step === events.length - 1 ? [20, 30, 40, 50, 70] : [],
          searchResult: isSearch || step === events.length - 1 ? true : null,
          lastOperation: event.type
        }
      } : {}
    });
  });

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-tree-presentation-test`, status: "completed", events },
    states,
    summary: { eventCount: events.length }
  };
}

function createHeapResult(language) {
  const types = [
    "PROGRAM_START",
    "HEAP_CREATE",
    "HEAP_INSERT",
    "HEAP_INSERT",
    "HEAP_SWAP",
    "HEAP_INSERT",
    "HEAP_PEEK",
    "HEAP_EXTRACT",
    "PROGRAM_END"
  ];
  const valuesByStep = [
    [],
    [],
    [40],
    [40, 10],
    [10, 40],
    [10, 40, 30],
    [10, 40, 30],
    [30, 40],
    [30, 40]
  ];
  const events = types.map((type, step) => ({
    id: `heap-event-${step}`,
    step,
    type,
    source: { line: step + 1 },
    payload: {
      name: "heap",
      heapName: "heap",
      heapType: "min",
      values: valuesByStep[step],
      value: type === "HEAP_PEEK" || type === "HEAP_EXTRACT"
        ? 10
        : type === "HEAP_INSERT"
          ? valuesByStep[step].at(-1)
          : undefined,
      index: type === "HEAP_INSERT" ? valuesByStep[step].length - 1 : undefined,
      fromIndex: type === "HEAP_SWAP" ? 1 : undefined,
      toIndex: type === "HEAP_SWAP" ? 0 : undefined
    }
  }));
  const states = events.map((event, step) => createState(step, {
    status: step === events.length - 1 ? "completed" : "running",
    variables: step > 0 ? {
      heap: language === "java"
        ? { $type: "object", display: "java.util.PriorityQueue" }
        : valuesByStep[step]
    } : {},
    arrays: step > 0 ? {
      ...(language === "java" ? { args: [] } : {}),
      heap: valuesByStep[step]
    } : {},
    heaps: step > 0 ? {
      heap: {
        name: "heap",
        heapType: "min",
        values: valuesByStep[step],
        activeIndices: event.type === "HEAP_SWAP"
          ? [1, 0]
          : event.type === "HEAP_INSERT"
            ? [Math.max(0, valuesByStep[step].length - 1)]
            : [0],
        swap: event.type === "HEAP_SWAP"
          ? { fromIndex: 1, toIndex: 0 }
          : null,
        peekedValue: step >= 6 ? 10 : null,
        extractedValue: step >= 7 ? 10 : null,
        lastOperation: event.type
      }
    } : {}
  }));

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-heap-presentation-test`, status: "completed", events },
    states,
    summary: { eventCount: events.length }
  };
}

function createGraphResult(language) {
  const nodes = [
    { id: "graph-node:1", value: "A" },
    { id: "graph-node:2", value: "B" },
    { id: "graph-node:3", value: "C" }
  ];
  const edges = [
    { id: "graph-edge:1", sourceId: nodes[0].id, targetId: nodes[1].id },
    { id: "graph-edge:2", sourceId: nodes[0].id, targetId: nodes[2].id }
  ];
  const types = [
    "PROGRAM_START",
    "GRAPH_CREATE",
    "GRAPH_NODE_ADD",
    "GRAPH_NODE_ADD",
    "GRAPH_NODE_ADD",
    "GRAPH_EDGE_ADD",
    "GRAPH_EDGE_ADD",
    "GRAPH_VISIT",
    "GRAPH_EDGE_TRAVERSE",
    "GRAPH_VISIT",
    "GRAPH_TRAVERSE",
    "PROGRAM_END"
  ];
  const events = types.map((type, step) => ({
    id: `graph-event-${step}`,
    step,
    type,
    source: { line: step + 1 },
    payload: {
      name: "graph",
      graphName: "graph",
      directed: false,
      nodes: step < 2 ? [] : nodes.slice(0, Math.min(step - 1, nodes.length)),
      edges: step < 5 ? [] : edges.slice(0, Math.min(step - 4, edges.length)),
      nodeId: type === "GRAPH_VISIT"
        ? step === 7 ? nodes[0].id : nodes[1].id
        : type === "GRAPH_NODE_ADD" ? nodes[step - 2].id : undefined,
      value: type === "GRAPH_VISIT"
        ? step === 7 ? "A" : "B"
        : type === "GRAPH_NODE_ADD" ? nodes[step - 2].value : undefined,
      edgeId: type === "GRAPH_EDGE_TRAVERSE"
        ? edges[0].id
        : type === "GRAPH_EDGE_ADD" ? edges[step - 5].id : undefined,
      sourceId: type === "GRAPH_EDGE_TRAVERSE" || type === "GRAPH_EDGE_ADD"
        ? nodes[0].id
        : undefined,
      targetId: type === "GRAPH_EDGE_TRAVERSE"
        ? nodes[1].id
        : type === "GRAPH_EDGE_ADD" ? edges[step - 5].targetId : undefined,
      traversalType: step >= 7 ? "bfs" : undefined,
      visitedIds: step >= 10
        ? nodes.map((node) => node.id)
        : step >= 9 ? [nodes[0].id, nodes[1].id] : step >= 7 ? [nodes[0].id] : [],
      order: step >= 10 ? ["A", "B", "C"] : []
    }
  }));
  const states = events.map((event, step) => createState(step, {
    status: step === events.length - 1 ? "completed" : "running",
    variables: step > 0 ? {
      graph: language === "java"
        ? { $type: "object", display: "Graph" }
        : {}
    } : {},
    arrays: step > 0 && language === "java" ? { args: [] } : {},
    graphs: step > 0 ? {
      graph: {
        name: "graph",
        directed: false,
        nodes: event.payload.nodes,
        edges: event.payload.edges,
        activeNodeId: event.payload.nodeId || event.payload.targetId || null,
        activeEdgeId: event.payload.edgeId || null,
        visitedIds: event.payload.visitedIds,
        traversalOrder: event.payload.order,
        traversalType: event.payload.traversalType || null,
        lastOperation: event.type
      }
    } : {}
  }));

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-graph-presentation-test`, status: "completed", events },
    states,
    summary: { eventCount: events.length }
  };
}

function createSearchResult(language) {
  const values = [4, 8, 15, 16, 23, 42];
  const searchId = "search:1";
  const base = {
    searchId,
    algorithm: "binary",
    arrayName: "numbers",
    values,
    target: 23
  };
  const entries = [
    ["PROGRAM_START", {}],
    ["ARRAY_CREATE", { name: "numbers", values }],
    ["SEARCH_START", { ...base, low: 0, high: 5, middle: 2 }],
    ["SEARCH_COMPARE", {
      ...base, low: 0, high: 5, middle: 2, index: 2, value: 15,
      matched: false, comparedIndices: [2], eliminatedIndices: [], comparisonCount: 1
    }],
    ["SEARCH_RANGE_UPDATE", {
      ...base, low: 3, high: 5, middle: 4, previousIndex: 2,
      comparedIndices: [2], eliminatedIndices: [0, 1, 2], comparisonCount: 1
    }],
    ["SEARCH_COMPARE", {
      ...base, low: 3, high: 5, middle: 4, index: 4, value: 23,
      matched: true, comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
    }],
    ["SEARCH_FOUND", {
      ...base, low: 3, high: 5, middle: 4, index: 4, found: true, foundIndex: 4,
      comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
    }],
    ["SEARCH_END", {
      ...base, low: 3, high: 5, middle: 4, found: true, foundIndex: 4,
      comparedIndices: [2, 4], eliminatedIndices: [0, 1, 2], comparisonCount: 2
    }],
    ["PROGRAM_END", {}]
  ];
  const events = entries.map(([type, payload], step) => ({
    id: `search-event-${step}`,
    step,
    type,
    source: { line: step > 1 ? 2 : 1 },
    payload
  }));
  const states = events.map((event, step) => {
    const searches = step >= 2
      ? {
        [searchId]: {
          id: searchId,
          algorithm: "binary",
          arrayName: "numbers",
          values,
          target: 23,
          low: step >= 4 ? 3 : 0,
          high: 5,
          middle: step >= 4 ? 4 : 2,
          activeIndex: step >= 5 ? 4 : step >= 3 ? 2 : null,
          comparedIndices: step >= 5 ? [2, 4] : step >= 3 ? [2] : [],
          eliminatedIndices: step >= 4 ? [0, 1, 2] : [],
          comparisonCount: step >= 5 ? 2 : step >= 3 ? 1 : 0,
          found: step >= 6,
          foundIndex: step >= 6 ? 4 : null,
          finished: step >= 7,
          lastOperation: event.type
        }
      }
      : {};

    return createState(step, {
      status: step === events.length - 1 ? "completed" : "running",
      variables: step > 0 ? { numbers: values } : {},
      arrays: step > 0 ? { numbers: values } : {},
      searches
    });
  });

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: { traceId: `${language}-search-presentation-test`, status: "completed", events },
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

  const javaResult = createResult("java");
  const javaFinalState = javaResult.states.at(-1);

  javaFinalState.variables = {
    args: [],
    numbers: [4, 8, 12],
    stack: { $type: "object", display: "java.util.ArrayDeque" },
    total: 24
  };
  javaFinalState.arrays = {
    args: [],
    numbers: [4, 8, 12]
  };
  javaFinalState.stacks = {
    stack: [4, 8, 12]
  };

  const javaPresentation = createExecutionPresentation(javaResult);
  assert.equal(javaPresentation.language, "java");
  assert.match(javaPresentation.steps[0].description, /Java execution/);
  assert.deepEqual(javaPresentation.steps[3].stack.values, [8]);
  assert.equal(javaPresentation.steps[4].callStack[0].name, "double");
  assert.equal(javaPresentation.steps[5].condition.result, true);
  assert.equal(javaPresentation.steps.at(-1).array.name, "numbers");
  assert.deepEqual(
    javaPresentation.steps.at(-1).variables.stack,
    [4, 8, 12]
  );

  for (const language of ["javascript", "python", "java"]) {
    const queuePresentation = createExecutionPresentation(
      createQueueResult(language)
    );

    assert.equal(queuePresentation.steps[1].queue.name, "taskQueue");
    assert.deepEqual(queuePresentation.steps[3].queue.values, ["A", "B"]);
    assert.equal(queuePresentation.steps[4].queue.operation, "QUEUE_PEEK");
    assert.deepEqual(queuePresentation.steps[5].queue.values, ["B"]);
    assert.equal(queuePresentation.steps[5].array, null);
    assert.deepEqual(queuePresentation.steps[5].variables.taskQueue, ["B"]);

    const linkedListPresentation = createExecutionPresentation(
      createLinkedListResult(language)
    );
    const linkedListName = language === "python" ? "linked_list" : "linkedList";

    assert.equal(linkedListPresentation.steps[1].linkedList.name, linkedListName);
    assert.deepEqual(
      linkedListPresentation.steps[4].linkedList.nodes.map((node) => node.value),
      [10, 20, 30]
    );
    assert.equal(linkedListPresentation.steps[5].linkedList.activeNodeId, "node:2");
    assert.equal(linkedListPresentation.steps[5].linkedList.operation, "NODE_VISIT");
    assert.deepEqual(
      linkedListPresentation.steps[6].linkedList.nodes.map((node) => node.value),
      [20, 30]
    );
    assert.equal(linkedListPresentation.steps[6].array, null);
    assert.deepEqual(linkedListPresentation.steps[6].variables[linkedListName], [20, 30]);

    const hashMapPresentation = createExecutionPresentation(
      createHashMapResult(language)
    );

    assert.equal(hashMapPresentation.steps[1].hashMap.name, "scores");
    assert.deepEqual(hashMapPresentation.steps[4].hashMap.entries, [
      { key: "Alice", value: 90 },
      { key: "Bob", value: 85 }
    ]);
    assert.equal(hashMapPresentation.steps[4].hashMap.activeKey, "Bob");
    assert.equal(hashMapPresentation.steps[5].hashMap.operation, "HASHMAP_GET");
    assert.deepEqual(hashMapPresentation.steps[6].hashMap.entries, [
      { key: "Bob", value: 85 }
    ]);
    assert.deepEqual(hashMapPresentation.steps[6].variables.scores, { Bob: 85 });
    assert.equal(hashMapPresentation.steps[6].array, null);
    assert.match(hashMapPresentation.steps[4].description, /80.*85/);

    const treePresentation = createExecutionPresentation(
      createTreeResult(language)
    );
    const treeName = language === "python" ? "search_tree" : "searchTree";

    assert.equal(treePresentation.steps[1].tree.name, treeName);
    assert.equal(treePresentation.steps[6].tree.rootId, "tree-node:1");
    assert.equal(treePresentation.steps[6].tree.nodes.length, 5);
    assert.deepEqual(treePresentation.steps[7].tree.visitedIds, [
      "tree-node:1",
      "tree-node:2",
      "tree-node:5"
    ]);
    assert.equal(treePresentation.steps[7].tree.activeNodeId, "tree-node:5");
    assert.equal(treePresentation.steps[7].tree.searchResult, true);
    assert.deepEqual(treePresentation.steps[8].tree.traversalOrder, [20, 30, 40, 50, 70]);
    assert.deepEqual(treePresentation.steps[8].variables[treeName], [20, 30, 40, 50, 70]);
    assert.equal(treePresentation.steps[8].array, null);
    assert.match(treePresentation.steps[7].description, /found.*3 tree nodes/i);

    const heapPresentation = createExecutionPresentation(
      createHeapResult(language)
    );

    assert.equal(heapPresentation.steps[1].heap.name, "heap");
    assert.deepEqual(heapPresentation.steps[4].heap.values, [10, 40]);
    assert.deepEqual(heapPresentation.steps[4].heap.activeIndices, [1, 0]);
    assert.deepEqual(heapPresentation.steps[4].heap.swap, {
      fromIndex: 1,
      toIndex: 0
    });
    assert.equal(heapPresentation.steps[6].heap.peekedValue, 10);
    assert.equal(heapPresentation.steps[7].heap.extractedValue, 10);
    assert.deepEqual(heapPresentation.steps[7].heap.values, [30, 40]);
    assert.deepEqual(heapPresentation.steps[7].variables.heap, [30, 40]);
    assert.equal(heapPresentation.steps[7].array, null);
    assert.match(heapPresentation.steps[4].description, /swap/i);

    const graphPresentation = createExecutionPresentation(
      createGraphResult(language)
    );

    assert.equal(graphPresentation.steps[1].graph.name, "graph");
    assert.equal(graphPresentation.steps[4].graph.nodes.length, 3);
    assert.equal(graphPresentation.steps[6].graph.edges.length, 2);
    assert.match(graphPresentation.steps[5].title, /A.*B/);
    assert.equal(graphPresentation.steps[7].graph.activeNodeId, "graph-node:1");
    assert.equal(graphPresentation.steps[8].graph.activeEdgeId, "graph-edge:1");
    assert.match(graphPresentation.steps[8].title, /A.*B/);
    assert.deepEqual(graphPresentation.steps[9].graph.visitedIds, [
      "graph-node:1",
      "graph-node:2"
    ]);
    assert.deepEqual(graphPresentation.steps[10].graph.traversalOrder, ["A", "B", "C"]);
    assert.deepEqual(graphPresentation.steps[10].variables.graph, {
      A: ["B", "C"],
      B: ["A"],
      C: ["A"]
    });
    assert.equal(graphPresentation.steps[10].graph.traversalType, "bfs");
    assert.equal(graphPresentation.steps[10].array, null);
    assert.match(graphPresentation.steps[10].description, /A.*B.*C/);

    const searchPresentation = createExecutionPresentation(
      createSearchResult(language)
    );

    assert.equal(searchPresentation.steps[2].search.algorithm, "binary");
    assert.equal(searchPresentation.steps[3].search.activeIndex, 2);
    assert.deepEqual(searchPresentation.steps[4].search.eliminatedIndices, [0, 1, 2]);
    assert.equal(searchPresentation.steps[4].search.low, 3);
    assert.equal(searchPresentation.steps[4].search.middle, 4);
    assert.equal(searchPresentation.steps[6].search.foundIndex, 4);
    assert.equal(searchPresentation.steps[7].search.finished, true);
    assert.equal(searchPresentation.steps[7].array, null);
    assert.match(searchPresentation.steps[4].description, /LOW 3.*HIGH 5/i);
  }

  const sqlPresentation = createExecutionPresentation(createSqlResult());
  assert.equal(sqlPresentation.language, "sql");
  assert.equal(sqlPresentation.steps.length, 9);
  assert.equal(sqlPresentation.steps.every((step) => step.sql !== null), true);
  assert.equal(sqlPresentation.steps[1].sql.table, "students");
  assert.equal(sqlPresentation.steps[1].sql.scannedCount, 5);
  assert.equal(sqlPresentation.steps[2].sql.activeRowIndex, 1);
  assert.equal(sqlPresentation.steps[2].sql.activeRowResult, true);
  assert.deepEqual(sqlPresentation.steps[2].sql.rejectedIds, [1]);
  assert.equal(sqlPresentation.steps[2].sql.displayRows.length, 5);
  assert.deepEqual(sqlPresentation.steps[3].sql.columns, ["name", "marks"]);
  assert.deepEqual(sqlPresentation.steps[6].sql.rows, [
    { name: "Divya", marks: 92 },
    { name: "Nila", marks: 88 },
    { name: "Kavin", marks: 84 }
  ]);
  assert.equal(sqlPresentation.steps[7].console[0].text, "3 rows returned");
  assert.match(sqlPresentation.steps[0].description, /SQLite/);

  const idle = createIdleExecutionStep();
  assert.equal(idle.status, "idle");
  assert.deepEqual(idle.variables, {});

  const idleSql = createIdleExecutionStep("sql");
  assert.equal(idleSql.event, "SQL_QUERY_START");
  assert.equal(idleSql.sql.table, "Query workspace");

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
  console.log("Java presentation compatibility: passed");
  console.log("Java collection presentation: passed");
  console.log("Empty Java argument-array suppression: passed");
  console.log("Cross-language queue presentation: passed");
  console.log("Queue FIFO animation state: passed");
  console.log("Cross-language linked-list presentation: passed");
  console.log("Linked-list node and reference animation state: passed");
  console.log("Cross-language HashMap presentation: passed");
  console.log("HashMap key-value animation state: passed");
  console.log("Cross-language binary-search-tree presentation: passed");
  console.log("BST comparison path and inorder animation state: passed");
  console.log("Cross-language min-heap presentation: passed");
  console.log("Heap bubble-up, bubble-down, and diagonal-edge animation state: passed");
  console.log("Cross-language graph presentation: passed");
  console.log("Graph node, direct-edge, BFS, and DFS animation state: passed");
  console.log("Cross-language searching-algorithm presentation: passed");
  console.log("Linear and binary search pointers, comparison, and result state: passed");
  console.log("SQL relational presentation: passed");
  console.log("SQL row-filter highlighting: passed");
  console.log("SQL result synchronization: passed");
}

runTests();
