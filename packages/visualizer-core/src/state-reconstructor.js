"use strict";

const {
  EVENT_TYPES,
  TRACE_DOMAINS,
  TRACE_STATUSES,
  assertValidTrace
} = require("@codeflow/execution-trace");

const DEFAULT_CHECKPOINT_INTERVAL = 10;

function cloneValue(value) {
  return structuredClone(value);
}

function createInitialState(trace) {
  return {
    language: trace.language,

    domain: trace.domain,

    step: -1,

    status: TRACE_STATUSES.IDLE,

    currentEvent: null,

    source: null,

    variables: {},

    scopes: {
      global: {
        id: "global",
        variables: {}
      }
    },

    activeScopes: ["global"],

    arrays: {},

    stacks: {},

    queues: {},

    hashMaps: {},

    trees: {},

    heaps: {},

    graphs: {},

    searches: {},

    sorts: {},

    linkedLists: {},

    objects: {},

    callStack: [],

    controlFlow: {
      lastCondition: null,
      branches: [],
      loops: {}
    },

    lastOperation: null,

    console: [],

    errors: [],

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
    }
  };
}

function getScopeId(event) {
  return event.scopeId || "global";
}

function ensureScope(state, scopeId) {
  if (!state.scopes[scopeId]) {
    state.scopes[scopeId] = {
      id: scopeId,
      variables: {}
    };
  }

  if (!state.activeScopes.includes(scopeId)) {
    state.activeScopes.push(scopeId);
  }

  return state.scopes[scopeId];
}

function refreshVisibleVariables(state) {
  const visibleVariables = {};

  for (const scopeId of state.activeScopes) {
    const scope = state.scopes[scopeId];

    if (!scope) {
      continue;
    }

    for (const [name, value] of Object.entries(scope.variables)) {
      visibleVariables[name] = cloneValue(value);
    }
  }

  state.variables = visibleVariables;
}

function setVariable(state, name, value, scopeId = "global") {
  if (
    typeof name !== "string" ||
    name.trim().length === 0
  ) {
    return;
  }

  const scope = ensureScope(
    state,
    scopeId
  );

  scope.variables[name] = cloneValue(
    value
  );

  if (Array.isArray(value)) {
    state.arrays[name] = cloneValue(
      value
    );
  }

  refreshVisibleVariables(
    state
  );
}

function removeScope(state, scopeId) {
  if (
    !scopeId ||
    scopeId === "global"
  ) {
    return;
  }

  delete state.scopes[scopeId];

  state.activeScopes = state.activeScopes.filter(
    (activeScopeId) => activeScopeId !== scopeId
  );

  refreshVisibleVariables(
    state
  );
}

function normalizeArrayName(payload) {
  return (
    payload.name ||
    payload.array ||
    payload.arrayName ||
    null
  );
}

function ensureArray(state, arrayName) {
  if (!Array.isArray(state.arrays[arrayName])) {
    state.arrays[arrayName] = [];
  }

  return state.arrays[arrayName];
}

function synchronizeArrayVariable(state, arrayName, event) {
  setVariable(
    state,
    arrayName,
    state.arrays[arrayName],
    getScopeId(event)
  );
}

function normalizeStackName(payload) {
  return (
    payload.name ||
    payload.stack ||
    payload.stackName ||
    "stack"
  );
}

function normalizeQueueName(payload) {
  return (
    payload.name ||
    payload.queue ||
    payload.queueName ||
    "queue"
  );
}

function normalizeLoopId(event) {
  const payload = event.payload || {};

  return (
    payload.loopId ||
    payload.id ||
    payload.name ||
    (
      event.source
        ? `line:${event.source.line}`
        : "default-loop"
    )
  );
}

function getRowsFromPayload(payload) {
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload.outputRows)) {
    return payload.outputRows;
  }

  if (Array.isArray(payload.matchingRows)) {
    return payload.matchingRows;
  }

  return null;
}

function registerQueryOperation(state, event) {
  state.query.operations.push({
    step: event.step,

    type: event.type,

    source: event.source
      ? cloneValue(event.source)
      : null,

    payload: cloneValue(
      event.payload
    )
  });
}

function applyStateDelta(state, stateDelta) {
  if (
    stateDelta === null ||
    stateDelta === undefined
  ) {
    return;
  }

  if (
    stateDelta.variables &&
    typeof stateDelta.variables === "object"
  ) {
    for (const [name, value] of Object.entries(
      stateDelta.variables
    )) {
      setVariable(
        state,
        name,
        value
      );
    }
  }

  if (
    stateDelta.arrays &&
    typeof stateDelta.arrays === "object"
  ) {
    for (const [name, values] of Object.entries(
      stateDelta.arrays
    )) {
      if (!Array.isArray(values)) {
        continue;
      }

      state.arrays[name] = cloneValue(
        values
      );

      setVariable(
        state,
        name,
        values
      );
    }
  }

  if (
    stateDelta.stacks &&
    typeof stateDelta.stacks === "object"
  ) {
    for (const [name, values] of Object.entries(
      stateDelta.stacks
    )) {
      if (Array.isArray(values)) {
        state.stacks[name] = cloneValue(
          values
        );
      }
    }
  }

  if (
    stateDelta.queues &&
    typeof stateDelta.queues === "object"
  ) {
    for (const [name, values] of Object.entries(
      stateDelta.queues
    )) {
      if (Array.isArray(values)) {
        state.queues[name] = cloneValue(
          values
        );
      }
    }
  }

  if (
    stateDelta.objects &&
    typeof stateDelta.objects === "object"
  ) {
    for (const [name, value] of Object.entries(
      stateDelta.objects
    )) {
      state.objects[name] = cloneValue(
        value
      );
    }
  }

  if (
    stateDelta.hashMaps &&
    typeof stateDelta.hashMaps === "object"
  ) {
    for (const [name, hashMap] of Object.entries(stateDelta.hashMaps)) {
      state.hashMaps[name] = cloneValue(hashMap);
    }
  }

  if (
    stateDelta.trees &&
    typeof stateDelta.trees === "object"
  ) {
    for (const [name, tree] of Object.entries(stateDelta.trees)) {
      state.trees[name] = cloneValue(tree);
    }
  }

  if (stateDelta.graphs && typeof stateDelta.graphs === "object") {
    for (const [name, graph] of Object.entries(stateDelta.graphs)) {
      state.graphs[name] = cloneValue(graph);
    }
  }

  if (
    stateDelta.linkedLists &&
    typeof stateDelta.linkedLists === "object"
  ) {
    for (const [name, linkedList] of Object.entries(stateDelta.linkedLists)) {
      state.linkedLists[name] = cloneValue(linkedList);
    }
  }

  if (
    stateDelta.query &&
    typeof stateDelta.query === "object"
  ) {
    Object.assign(
      state.query,

      cloneValue(
        stateDelta.query
      )
    );
  }
}

function handleVariableEvent(state, event) {
  const {
    name
  } = event.payload;

  const value = Object.hasOwn(
    event.payload,
    "value"
  )
    ? event.payload.value
    : event.payload.newValue;

  setVariable(
    state,
    name,
    value,
    getScopeId(event)
  );
}

function handleArrayCreate(state, event) {
  const name = normalizeArrayName(
    event.payload
  );

  if (!name) {
    return;
  }

  const values = Array.isArray(event.payload.values)
    ? event.payload.values
    : (
      Array.isArray(event.payload.value)
        ? event.payload.value
        : []
    );

  state.arrays[name] = cloneValue(
    values
  );

  synchronizeArrayVariable(
    state,
    name,
    event
  );
}

function handleArrayUpdate(state, event) {
  const name = normalizeArrayName(
    event.payload
  );

  if (!name) {
    return;
  }

  const values = ensureArray(
    state,
    name
  );

  const {
    index
  } = event.payload;

  if (
    !Number.isInteger(index) ||
    index < 0
  ) {
    return;
  }

  const value = Object.hasOwn(
    event.payload,
    "value"
  )
    ? event.payload.value
    : event.payload.newValue;

  values[index] = cloneValue(
    value
  );

  synchronizeArrayVariable(
    state,
    name,
    event
  );
}

function handleArrayInsert(state, event) {
  const name = normalizeArrayName(
    event.payload
  );

  if (!name) {
    return;
  }

  const values = ensureArray(
    state,
    name
  );

  const index = Number.isInteger(
    event.payload.index
  )
    ? event.payload.index
    : values.length;

  values.splice(
    index,
    0,
    cloneValue(event.payload.value)
  );

  synchronizeArrayVariable(
    state,
    name,
    event
  );
}

function handleArrayDelete(state, event) {
  const name = normalizeArrayName(
    event.payload
  );

  if (!name) {
    return;
  }

  const values = ensureArray(
    state,
    name
  );

  const index = Number.isInteger(
    event.payload.index
  )
    ? event.payload.index
    : values.length - 1;

  if (
    index >= 0 &&
    index < values.length
  ) {
    values.splice(
      index,
      1
    );
  }

  synchronizeArrayVariable(
    state,
    name,
    event
  );
}

function handleArraySwap(state, event) {
  const name = normalizeArrayName(
    event.payload
  );

  if (!name) {
    return;
  }

  const values = ensureArray(
    state,
    name
  );

  const firstIndex = event.payload.firstIndex;

  const secondIndex = event.payload.secondIndex;

  if (
    !Number.isInteger(firstIndex) ||
    !Number.isInteger(secondIndex)
  ) {
    return;
  }

  if (
    firstIndex < 0 ||
    secondIndex < 0 ||
    firstIndex >= values.length ||
    secondIndex >= values.length
  ) {
    return;
  }

  [
    values[firstIndex],
    values[secondIndex]
  ] = [
    values[secondIndex],
    values[firstIndex]
  ];

  synchronizeArrayVariable(
    state,
    name,
    event
  );
}

function handleStackEvent(state, event) {
  const name = normalizeStackName(
    event.payload
  );

  if (!Array.isArray(state.stacks[name])) {
    state.stacks[name] = [];
  }

  if (event.type === EVENT_TYPES.STACK_CREATE) {
    state.stacks[name] = Array.isArray(
      event.payload.values
    )
      ? cloneValue(event.payload.values)
      : [];

    return;
  }

  if (event.type === EVENT_TYPES.STACK_PUSH) {
    state.stacks[name].push(
      cloneValue(event.payload.value)
    );

    return;
  }

  if (event.type === EVENT_TYPES.STACK_POP) {
    state.stacks[name].pop();
  }
}

function handleQueueEvent(state, event) {
  const name = normalizeQueueName(
    event.payload
  );

  if (!Array.isArray(state.queues[name])) {
    state.queues[name] = [];
  }

  if (event.type === EVENT_TYPES.QUEUE_CREATE) {
    state.queues[name] = Array.isArray(
      event.payload.values
    )
      ? cloneValue(event.payload.values)
      : [];

    return;
  }

  if (event.type === EVENT_TYPES.QUEUE_ENQUEUE) {
    state.queues[name].push(
      cloneValue(event.payload.value)
    );

    return;
  }

  if (event.type === EVENT_TYPES.QUEUE_DEQUEUE) {
    state.queues[name].shift();
  }

  // QUEUE_PEEK is intentionally non-mutating. Keeping it in this handler
  // ensures the queue exists while replay remains deterministic.
}

function handleLinkedListEvent(state, event) {
  const payload = event.payload || {};
  const name = payload.listName || payload.name || "linkedList";

  if (!state.linkedLists[name]) {
    state.linkedLists[name] = {
      name,
      nodes: [],
      headId: null,
      tailId: null,
      activeNodeId: null,
      pendingNode: null,
      lastOperation: null
    };
  }

  const linkedList = state.linkedLists[name];

  if (event.type === EVENT_TYPES.LINKED_LIST_CREATE) {
    linkedList.nodes = Array.isArray(payload.nodes) ? cloneValue(payload.nodes) : [];
    linkedList.headId = payload.headId || linkedList.nodes[0]?.id || null;
    linkedList.tailId = payload.tailId || linkedList.nodes.at(-1)?.id || null;
    linkedList.activeNodeId = null;
    linkedList.pendingNode = null;
  } else if (event.type === EVENT_TYPES.NODE_CREATE) {
    linkedList.pendingNode = {
      id: payload.nodeId,
      value: cloneValue(payload.value),
      nextId: payload.nextId || null
    };
    linkedList.activeNodeId = payload.nodeId || null;
  } else if (event.type === EVENT_TYPES.NODE_INSERT) {
    if (Array.isArray(payload.nodes)) {
      linkedList.nodes = cloneValue(payload.nodes);
    } else {
      const index = Number.isInteger(payload.index) ? payload.index : linkedList.nodes.length;
      linkedList.nodes.splice(index, 0, {
        id: payload.nodeId,
        value: cloneValue(payload.value),
        nextId: payload.nextId || null
      });
    }

    linkedList.headId = payload.headId || linkedList.nodes[0]?.id || null;
    linkedList.tailId = payload.tailId || linkedList.nodes.at(-1)?.id || null;
    linkedList.activeNodeId = payload.nodeId || null;
    linkedList.pendingNode = null;
  } else if (event.type === EVENT_TYPES.NODE_DELETE) {
    linkedList.nodes = Array.isArray(payload.nodes)
      ? cloneValue(payload.nodes)
      : linkedList.nodes.filter((node) => node.id !== payload.nodeId);
    linkedList.headId = payload.headId || linkedList.nodes[0]?.id || null;
    linkedList.tailId = payload.tailId || linkedList.nodes.at(-1)?.id || null;
    linkedList.activeNodeId = payload.nodeId || null;
    linkedList.pendingNode = null;
  } else if (event.type === EVENT_TYPES.NODE_VISIT) {
    linkedList.activeNodeId = payload.nodeId || null;
  } else if (event.type === EVENT_TYPES.REFERENCE_UPDATE) {
    if (payload.reference === "head") {
      linkedList.headId = payload.targetNodeId || null;
    } else if (payload.reference === "tail") {
      linkedList.tailId = payload.targetNodeId || null;
    } else if (payload.fromNodeId) {
      const node = linkedList.nodes.find((item) => item.id === payload.fromNodeId);

      if (node) {
        node.nextId = payload.targetNodeId || null;
      }
    }

    linkedList.activeNodeId = payload.fromNodeId || payload.targetNodeId || null;
  }

  linkedList.lastOperation = event.type;
}

function handleHashMapEvent(state, event) {
  const payload = event.payload || {};
  const name = payload.mapName || payload.name || "hashMap";

  if (!state.hashMaps[name]) {
    state.hashMaps[name] = {
      name,
      entries: [],
      size: 0,
      activeKey: null,
      lastOperation: null,
      lastResult: null
    };
  }

  const hashMap = state.hashMaps[name];
  const keyMatches = (entry) => (
    JSON.stringify(entry.key) === JSON.stringify(payload.key)
  );

  if (event.type === EVENT_TYPES.HASHMAP_CREATE) {
    hashMap.entries = Array.isArray(payload.entries)
      ? cloneValue(payload.entries)
      : [];
    hashMap.activeKey = null;
    hashMap.lastResult = null;
  } else if (event.type === EVENT_TYPES.HASHMAP_SET) {
    if (Array.isArray(payload.entries)) {
      hashMap.entries = cloneValue(payload.entries);
    } else {
      const existing = hashMap.entries.find(keyMatches);

      if (existing) {
        existing.value = cloneValue(payload.value);
      } else {
        hashMap.entries.push({
          key: cloneValue(payload.key),
          value: cloneValue(payload.value)
        });
      }
    }

    hashMap.activeKey = cloneValue(payload.key);
    hashMap.lastResult = cloneValue(payload.value);
  } else if (event.type === EVENT_TYPES.HASHMAP_DELETE) {
    hashMap.entries = Array.isArray(payload.entries)
      ? cloneValue(payload.entries)
      : hashMap.entries.filter((entry) => !keyMatches(entry));
    hashMap.activeKey = cloneValue(payload.key);
    hashMap.lastResult = Object.hasOwn(payload, "value")
      ? cloneValue(payload.value)
      : null;
  } else if (
    event.type === EVENT_TYPES.HASHMAP_GET ||
    event.type === EVENT_TYPES.HASHMAP_HAS
  ) {
    hashMap.activeKey = cloneValue(payload.key);
    hashMap.lastResult = Object.hasOwn(payload, "value")
      ? cloneValue(payload.value)
      : Object.hasOwn(payload, "result")
        ? cloneValue(payload.result)
        : null;
  }

  hashMap.size = hashMap.entries.length;
  hashMap.lastOperation = event.type;
}

function handleTreeEvent(state, event) {
  const payload = event.payload || {};
  const name = payload.treeName || payload.name || "tree";

  if (!state.trees[name]) {
    state.trees[name] = {
      name,
      nodes: [],
      rootId: null,
      activeNodeId: null,
      visitedIds: [],
      traversalOrder: [],
      searchResult: null,
      lastOperation: null
    };
  }

  const tree = state.trees[name];

  if (Array.isArray(payload.nodes)) {
    tree.nodes = cloneValue(payload.nodes);
  }

  if (Object.hasOwn(payload, "rootId")) {
    tree.rootId = payload.rootId || null;
  } else if (!tree.rootId && tree.nodes.length > 0) {
    tree.rootId = tree.nodes[0].id;
  }

  if (event.type === EVENT_TYPES.TREE_CREATE) {
    tree.activeNodeId = null;
    tree.visitedIds = [];
    tree.traversalOrder = [];
    tree.searchResult = null;
  } else if (event.type === EVENT_TYPES.TREE_INSERT) {
    tree.activeNodeId = payload.insertedNodeId || payload.nodeId || null;
    tree.visitedIds = cloneValue(payload.path || []);
  } else if (event.type === EVENT_TYPES.TREE_SEARCH) {
    tree.activeNodeId = payload.foundNodeId || (payload.path || []).at(-1) || null;
    tree.visitedIds = cloneValue(payload.path || []);
    tree.searchResult = Boolean(payload.found);
  } else if (event.type === EVENT_TYPES.TREE_TRAVERSE) {
    tree.activeNodeId = (payload.visitedIds || []).at(-1) || null;
    tree.visitedIds = cloneValue(payload.visitedIds || []);
    tree.traversalOrder = cloneValue(payload.order || []);
  }

  tree.lastOperation = event.type;
}

function handleHeapEvent(state, event) {
  const payload = event.payload || {};
  const name = payload.heapName || payload.name || "heap";

  if (!state.heaps[name]) {
    state.heaps[name] = {
      name,
      heapType: payload.heapType || "min",
      values: [],
      activeIndices: [],
      swap: null,
      peekedValue: null,
      extractedValue: null,
      lastOperation: null
    };
  }

  const heap = state.heaps[name];

  if (Array.isArray(payload.values)) {
    heap.values = cloneValue(payload.values);
  }

  heap.heapType = payload.heapType || heap.heapType || "min";
  heap.activeIndices = Array.isArray(payload.activeIndices)
    ? cloneValue(payload.activeIndices)
    : [];
  heap.swap = null;

  if (event.type === EVENT_TYPES.HEAP_CREATE) {
    heap.peekedValue = null;
    heap.extractedValue = null;
  } else if (event.type === EVENT_TYPES.HEAP_INSERT) {
    heap.activeIndices = Number.isInteger(payload.index)
      ? [payload.index]
      : heap.activeIndices;
  } else if (event.type === EVENT_TYPES.HEAP_SWAP) {
    const fromIndex = Number(payload.fromIndex);
    const toIndex = Number(payload.toIndex);

    heap.swap = Number.isInteger(fromIndex) && Number.isInteger(toIndex)
      ? { fromIndex, toIndex }
      : null;
    heap.activeIndices = heap.swap ? [fromIndex, toIndex] : heap.activeIndices;
  } else if (event.type === EVENT_TYPES.HEAP_PEEK) {
    heap.peekedValue = cloneValue(payload.value);
    heap.activeIndices = heap.values.length > 0 ? [0] : [];
  } else if (event.type === EVENT_TYPES.HEAP_EXTRACT) {
    heap.extractedValue = cloneValue(payload.value);
    heap.activeIndices = heap.values.length > 0 ? [0] : [];
  }

  heap.lastOperation = event.type;
}

function handleGraphEvent(state, event) {
  const payload = event.payload || {};
  const name = payload.graphName || payload.name || "graph";

  if (!state.graphs[name]) {
    state.graphs[name] = {
      name,
      directed: Boolean(payload.directed),
      nodes: [],
      edges: [],
      activeNodeId: null,
      activeEdgeId: null,
      visitedIds: [],
      traversalOrder: [],
      traversalType: null,
      lastOperation: null
    };
  }

  const graph = state.graphs[name];

  if (Array.isArray(payload.nodes)) {
    graph.nodes = cloneValue(payload.nodes);
  }

  if (Array.isArray(payload.edges)) {
    graph.edges = cloneValue(payload.edges);
  }

  if (Object.hasOwn(payload, "directed")) {
    graph.directed = Boolean(payload.directed);
  }

  if (event.type === EVENT_TYPES.GRAPH_CREATE) {
    graph.activeNodeId = null;
    graph.activeEdgeId = null;
    graph.visitedIds = [];
    graph.traversalOrder = [];
    graph.traversalType = null;
  } else if (event.type === EVENT_TYPES.GRAPH_NODE_ADD) {
    graph.activeNodeId = payload.nodeId || null;
    graph.activeEdgeId = null;
  } else if (event.type === EVENT_TYPES.GRAPH_EDGE_ADD) {
    graph.activeNodeId = payload.targetId || null;
    graph.activeEdgeId = payload.edgeId || null;
  } else if (event.type === EVENT_TYPES.GRAPH_EDGE_TRAVERSE) {
    graph.activeNodeId = payload.targetId || null;
    graph.activeEdgeId = payload.edgeId || null;
    graph.traversalType = payload.traversalType || graph.traversalType;
  } else if (event.type === EVENT_TYPES.GRAPH_VISIT) {
    graph.activeNodeId = payload.nodeId || null;
    graph.activeEdgeId = payload.edgeId || null;
    graph.visitedIds = Array.isArray(payload.visitedIds)
      ? cloneValue(payload.visitedIds)
      : [...graph.visitedIds, payload.nodeId].filter(Boolean);
    graph.traversalType = payload.traversalType || graph.traversalType;
  } else if (event.type === EVENT_TYPES.GRAPH_TRAVERSE) {
    graph.activeNodeId = (payload.visitedIds || []).at(-1) || null;
    graph.activeEdgeId = null;
    graph.visitedIds = cloneValue(payload.visitedIds || []);
    graph.traversalOrder = cloneValue(payload.order || []);
    graph.traversalType = payload.traversalType || null;
  }

  graph.lastOperation = event.type;
}

function handleSearchEvent(state, event) {
  const payload = event.payload || {};
  const searchId = payload.searchId || `${payload.algorithm || "linear"}:${payload.arrayName || "values"}`;

  if (!state.searches[searchId]) {
    state.searches[searchId] = {
      id: searchId,
      algorithm: payload.algorithm || "linear",
      arrayName: payload.arrayName || "values",
      values: [],
      target: null,
      low: null,
      high: null,
      middle: null,
      activeIndex: null,
      comparedIndices: [],
      eliminatedIndices: [],
      comparisonCount: 0,
      foundIndex: null,
      found: false,
      finished: false,
      lastOperation: null
    };
  }

  const search = state.searches[searchId];

  for (const key of ["algorithm", "arrayName", "target", "low", "high", "middle", "comparisonCount"]) {
    if (Object.hasOwn(payload, key)) {
      search[key] = cloneValue(payload[key]);
    }
  }

  if (Array.isArray(payload.values)) {
    search.values = cloneValue(payload.values);
  }

  if (Array.isArray(payload.comparedIndices)) {
    search.comparedIndices = cloneValue(payload.comparedIndices);
  }

  if (Array.isArray(payload.eliminatedIndices)) {
    search.eliminatedIndices = cloneValue(payload.eliminatedIndices);
  }

  if (Number.isInteger(payload.index)) {
    search.activeIndex = payload.index;
  } else if (event.type === EVENT_TYPES.SEARCH_RANGE_UPDATE) {
    search.activeIndex = Number.isInteger(payload.middle)
      ? payload.middle
      : Number.isInteger(payload.low) ? payload.low : null;
  }

  if (event.type === EVENT_TYPES.SEARCH_START) {
    search.found = false;
    search.finished = false;
    search.foundIndex = null;
    search.comparedIndices = [];
    search.eliminatedIndices = [];
  } else if (event.type === EVENT_TYPES.SEARCH_FOUND) {
    search.found = true;
    search.foundIndex = payload.foundIndex ?? payload.index ?? null;
    search.activeIndex = search.foundIndex;
  } else if (event.type === EVENT_TYPES.SEARCH_NOT_FOUND) {
    search.found = false;
    search.foundIndex = -1;
    search.activeIndex = null;
  } else if (event.type === EVENT_TYPES.SEARCH_END) {
    search.finished = true;

    if (Object.hasOwn(payload, "found")) {
      search.found = Boolean(payload.found);
    }

    if (Object.hasOwn(payload, "foundIndex")) {
      search.foundIndex = payload.foundIndex;
    }
  }

  search.lastOperation = event.type;
}

function handleSortEvent(state, event) {
  const payload = event.payload || {};
  const sortId = payload.sortId || `${payload.algorithm || "bubble"}:${payload.arrayName || "values"}`;

  if (!state.sorts[sortId]) {
    state.sorts[sortId] = {
      id: sortId,
      algorithm: payload.algorithm || "bubble",
      arrayName: payload.arrayName || "values",
      values: [],
      initialValues: [],
      compareIndices: [],
      swapIndices: [],
      sortedIndices: [],
      activeIndex: null,
      minIndex: null,
      keyIndex: null,
      comparisonCount: 0,
      swapCount: 0,
      writeCount: 0,
      pass: 0,
      finished: false,
      lastOperation: null
    };
  }

  const sort = state.sorts[sortId];

  for (const key of [
    "algorithm", "arrayName", "activeIndex", "minIndex", "keyIndex",
    "comparisonCount", "swapCount", "writeCount", "pass"
  ]) {
    if (Object.hasOwn(payload, key)) {
      sort[key] = cloneValue(payload[key]);
    }
  }

  for (const key of ["values", "initialValues", "compareIndices", "swapIndices", "sortedIndices"]) {
    if (Array.isArray(payload[key])) {
      sort[key] = cloneValue(payload[key]);
    }
  }

  if (event.type === EVENT_TYPES.SORT_START) {
    sort.finished = false;
    sort.compareIndices = [];
    sort.swapIndices = [];
    sort.sortedIndices = [];
  } else if (event.type === EVENT_TYPES.SORT_END) {
    sort.finished = true;
    sort.compareIndices = [];
    sort.swapIndices = [];
    sort.activeIndex = null;
    sort.minIndex = null;
    sort.keyIndex = null;
    sort.sortedIndices = sort.values.map((_, index) => index);
  }

  if (Array.isArray(payload.values) && sort.arrayName !== "values") {
    state.arrays[sort.arrayName] = cloneValue(payload.values);
    synchronizeArrayVariable(state, sort.arrayName, event);
  }

  sort.lastOperation = event.type;
}

function handleFunctionEnter(state, event) {
  const name = (
    event.payload.name ||
    event.payload.functionName ||
    "anonymous"
  );

  const scopeId = (
    event.scopeId ||
    event.payload.scopeId ||
    `${name}:${event.step}`
  );

  ensureScope(
    state,
    scopeId
  );

  const frame = {
    id: (
      event.payload.frameId ||
      scopeId
    ),

    scopeId,

    name,

    arguments: Array.isArray(
      event.payload.arguments
    )
      ? cloneValue(event.payload.arguments)
      : [],

    parameters: (
      event.payload.parameters &&
      typeof event.payload.parameters === "object"
    )
      ? cloneValue(event.payload.parameters)
      : {},

    source: event.source
      ? cloneValue(event.source)
      : null
  };

  state.callStack.push(
    frame
  );

  for (const [parameterName, value] of Object.entries(
    frame.parameters
  )) {
    setVariable(
      state,
      parameterName,
      value,
      scopeId
    );
  }
}

function handleFunctionReturn(state, event) {
  if (state.callStack.length === 0) {
    return;
  }

  const expectedName = (
    event.payload.name ||
    event.payload.functionName ||
    null
  );

  let frameIndex = state.callStack.length - 1;

  if (expectedName) {
    const matchedIndex = state.callStack.findLastIndex(
      (frame) => frame.name === expectedName
    );

    if (matchedIndex !== -1) {
      frameIndex = matchedIndex;
    }
  }

  const [frame] = state.callStack.splice(
    frameIndex,
    1
  );

  if (frame) {
    removeScope(
      state,
      frame.scopeId
    );
  }
}

function handleLoopEvent(state, event) {
  const loopId = normalizeLoopId(
    event
  );

  if (!state.controlFlow.loops[loopId]) {
    state.controlFlow.loops[loopId] = {
      id: loopId,

      type: (
        event.payload.loopType ||
        "loop"
      ),

      iteration: null,

      condition: null,

      active: false
    };
  }

  const loop = state.controlFlow.loops[loopId];

  if (event.type === EVENT_TYPES.LOOP_START) {
    loop.active = true;

    return;
  }

  if (event.type === EVENT_TYPES.LOOP_CONDITION) {
    loop.condition = cloneValue({
      expression: event.payload.expression || null,
      result: event.payload.result
    });

    return;
  }

  if (event.type === EVENT_TYPES.LOOP_ITERATION) {
    loop.active = true;

    loop.iteration = (
      event.payload.iteration ??
      event.payload.index ??
      0
    );

    return;
  }

  if (event.type === EVENT_TYPES.LOOP_END) {
    loop.active = false;
  }
}

function handleSqlScan(state, event) {
  const tableName = (
    event.payload.table ||
    event.payload.tableName ||
    "unknown"
  );

  const rows = getRowsFromPayload(
    event.payload
  );

  if (rows) {
    state.query.tables[tableName] = cloneValue(
      rows
    );

    state.query.currentRows = cloneValue(
      rows
    );
  }

  if (Number.isInteger(event.payload.scannedRows)) {
    state.query.scannedRowCount = (
      event.payload.scannedRows
    );
  } else if (rows) {
    state.query.scannedRowCount = rows.length;
  }

  registerQueryOperation(
    state,
    event
  );
}

function handleSqlFilter(state, event) {
  const rows = getRowsFromPayload(
    event.payload
  );

  if (rows) {
    state.query.currentRows = cloneValue(
      rows
    );

    state.query.matchingRowCount = rows.length;
  }

  if (
    Number.isInteger(
      event.payload.matchingRows
    )
  ) {
    state.query.matchingRowCount = (
      event.payload.matchingRows
    );
  }

  if (
    Number.isInteger(
      event.payload.rejectedRows
    )
  ) {
    state.query.rejectedRowCount = (
      event.payload.rejectedRows
    );
  }

  registerQueryOperation(
    state,
    event
  );
}

function handleSqlProjection(state, event) {
  const columns = Array.isArray(
    event.payload.columns
  )
    ? event.payload.columns
    : [];

  state.query.columns = cloneValue(
    columns
  );

  const rows = getRowsFromPayload(
    event.payload
  );

  if (rows) {
    state.query.currentRows = cloneValue(
      rows
    );
  } else if (columns.length > 0) {
    state.query.currentRows = state.query.currentRows.map(
      (row) => Object.fromEntries(
        columns
          .filter(
            (column) => Object.hasOwn(
              row,
              column
            )
          )
          .map(
            (column) => [
              column,
              cloneValue(row[column])
            ]
          )
      )
    );
  }

  registerQueryOperation(
    state,
    event
  );
}

function handleSqlSort(state, event) {
  const rows = getRowsFromPayload(
    event.payload
  );

  if (rows) {
    state.query.currentRows = cloneValue(
      rows
    );
  } else {
    const column = event.payload.column;

    const direction = String(
      event.payload.direction || "ASC"
    ).toUpperCase();

    if (column) {
      state.query.currentRows.sort((first, second) => {
        const firstValue = first[column];

        const secondValue = second[column];

        if (firstValue === secondValue) {
          return 0;
        }

        if (firstValue === undefined || firstValue === null) {
          return 1;
        }

        if (secondValue === undefined || secondValue === null) {
          return -1;
        }

        const comparison = firstValue > secondValue
          ? 1
          : -1;

        return direction === "DESC"
          ? -comparison
          : comparison;
      });
    }
  }

  registerQueryOperation(
    state,
    event
  );
}

function handleGenericSqlOperation(state, event) {
  const rows = getRowsFromPayload(
    event.payload
  );

  if (rows) {
    state.query.currentRows = cloneValue(
      rows
    );
  }

  registerQueryOperation(
    state,
    event
  );
}

function reduceExecutionEvent(previousState, event) {
  const state = cloneValue(
    previousState
  );

  state.step = event.step;

  state.currentEvent = cloneValue(
    event
  );

  state.source = event.source
    ? cloneValue(event.source)
    : null;

  switch (event.type) {
    case EVENT_TYPES.PROGRAM_START: {
      state.status = TRACE_STATUSES.RUNNING;

      break;
    }

    case EVENT_TYPES.SQL_QUERY_START: {
      state.status = TRACE_STATUSES.RUNNING;

      state.query.text = (
        event.payload.query ||
        event.payload.sql ||
        null
      );

      break;
    }

    case EVENT_TYPES.PROGRAM_END:
    case EVENT_TYPES.SQL_QUERY_END: {
      state.status = TRACE_STATUSES.COMPLETED;

      break;
    }

    case EVENT_TYPES.ERROR: {
      state.status = TRACE_STATUSES.FAILED;

      state.errors.push({
        step: event.step,

        source: event.source
          ? cloneValue(event.source)
          : null,

        ...cloneValue(event.payload)
      });

      break;
    }

    case EVENT_TYPES.VARIABLE_DECLARE:
    case EVENT_TYPES.VARIABLE_ASSIGN:
    case EVENT_TYPES.VARIABLE_UPDATE: {
      handleVariableEvent(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.EXPRESSION_START:
    case EVENT_TYPES.EXPRESSION_RESULT:
    case EVENT_TYPES.OPERATION_START:
    case EVENT_TYPES.OPERATION_RESULT: {
      state.lastOperation = {
        step: event.step,

        type: event.type,

        ...cloneValue(event.payload)
      };

      break;
    }

    case EVENT_TYPES.CONDITION_EVALUATE: {
      state.controlFlow.lastCondition = {
        step: event.step,

        expression: (
          event.payload.expression ||
          null
        ),

        result: event.payload.result
      };

      break;
    }

    case EVENT_TYPES.BRANCH_ENTER: {
      state.controlFlow.branches.push({
        step: event.step,

        branch: (
          event.payload.branch ||
          "branch"
        )
      });

      break;
    }

    case EVENT_TYPES.BRANCH_EXIT: {
      state.controlFlow.branches.pop();

      break;
    }

    case EVENT_TYPES.LOOP_START:
    case EVENT_TYPES.LOOP_CONDITION:
    case EVENT_TYPES.LOOP_ITERATION:
    case EVENT_TYPES.LOOP_END: {
      handleLoopEvent(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SCOPE_ENTER: {
      ensureScope(
        state,
        getScopeId(event)
      );

      break;
    }

    case EVENT_TYPES.SCOPE_EXIT: {
      removeScope(
        state,
        getScopeId(event)
      );

      break;
    }

    case EVENT_TYPES.FUNCTION_ENTER: {
      handleFunctionEnter(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.FUNCTION_RETURN: {
      handleFunctionReturn(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.ARRAY_CREATE: {
      handleArrayCreate(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.ARRAY_UPDATE: {
      handleArrayUpdate(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.ARRAY_INSERT: {
      handleArrayInsert(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.ARRAY_DELETE: {
      handleArrayDelete(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.ARRAY_SWAP: {
      handleArraySwap(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.STACK_CREATE:
    case EVENT_TYPES.STACK_PUSH:
    case EVENT_TYPES.STACK_POP: {
      handleStackEvent(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.QUEUE_CREATE:
    case EVENT_TYPES.QUEUE_ENQUEUE:
    case EVENT_TYPES.QUEUE_DEQUEUE:
    case EVENT_TYPES.QUEUE_PEEK: {
      handleQueueEvent(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.LINKED_LIST_CREATE:
    case EVENT_TYPES.NODE_CREATE:
    case EVENT_TYPES.NODE_INSERT:
    case EVENT_TYPES.NODE_DELETE:
    case EVENT_TYPES.NODE_VISIT:
    case EVENT_TYPES.REFERENCE_UPDATE: {
      handleLinkedListEvent(state, event);

      break;
    }

    case EVENT_TYPES.HASHMAP_CREATE:
    case EVENT_TYPES.HASHMAP_SET:
    case EVENT_TYPES.HASHMAP_GET:
    case EVENT_TYPES.HASHMAP_DELETE:
    case EVENT_TYPES.HASHMAP_HAS: {
      handleHashMapEvent(state, event);

      break;
    }

    case EVENT_TYPES.TREE_CREATE:
    case EVENT_TYPES.TREE_INSERT:
    case EVENT_TYPES.TREE_SEARCH:
    case EVENT_TYPES.TREE_TRAVERSE: {
      handleTreeEvent(state, event);

      break;
    }

    case EVENT_TYPES.HEAP_CREATE:
    case EVENT_TYPES.HEAP_INSERT:
    case EVENT_TYPES.HEAP_SWAP:
    case EVENT_TYPES.HEAP_PEEK:
    case EVENT_TYPES.HEAP_EXTRACT: {
      handleHeapEvent(state, event);

      break;
    }

    case EVENT_TYPES.GRAPH_CREATE:
    case EVENT_TYPES.GRAPH_NODE_ADD:
    case EVENT_TYPES.GRAPH_EDGE_ADD:
    case EVENT_TYPES.GRAPH_EDGE_TRAVERSE:
    case EVENT_TYPES.GRAPH_VISIT:
    case EVENT_TYPES.GRAPH_TRAVERSE: {
      handleGraphEvent(state, event);

      break;
    }

    case EVENT_TYPES.SEARCH_START:
    case EVENT_TYPES.SEARCH_COMPARE:
    case EVENT_TYPES.SEARCH_RANGE_UPDATE:
    case EVENT_TYPES.SEARCH_FOUND:
    case EVENT_TYPES.SEARCH_NOT_FOUND:
    case EVENT_TYPES.SEARCH_END: {
      handleSearchEvent(state, event);

      break;
    }

    case EVENT_TYPES.SORT_START:
    case EVENT_TYPES.SORT_COMPARE:
    case EVENT_TYPES.SORT_SWAP:
    case EVENT_TYPES.SORT_WRITE:
    case EVENT_TYPES.SORT_PASS:
    case EVENT_TYPES.SORT_MARK_SORTED:
    case EVENT_TYPES.SORT_END: {
      handleSortEvent(state, event);

      break;
    }

    case EVENT_TYPES.OBJECT_CREATE: {
      const name = (
        event.payload.name ||
        event.payload.objectId
      );

      if (name) {
        state.objects[name] = cloneValue(
          event.payload.properties ||
          event.payload.value ||
          {}
        );
      }

      break;
    }

    case EVENT_TYPES.PROPERTY_WRITE: {
      const name = (
        event.payload.name ||
        event.payload.objectId
      );

      const property = event.payload.property;

      if (
        name &&
        property
      ) {
        if (!state.objects[name]) {
          state.objects[name] = {};
        }

        state.objects[name][property] = cloneValue(
          event.payload.value
        );
      }

      break;
    }

    case EVENT_TYPES.OUTPUT: {
      const rawText = (
        event.payload.text ??
        event.payload.message ??
        event.payload.value ??
        ""
      );

      state.console.push({
        step: event.step,

        channel: (
          event.payload.channel ||
          "stdout"
        ),

        text: String(
          rawText
        )
      });

      break;
    }

    case EVENT_TYPES.SQL_SCAN: {
      handleSqlScan(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SQL_FILTER: {
      handleSqlFilter(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SQL_PROJECT: {
      handleSqlProjection(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SQL_SORT: {
      handleSqlSort(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SQL_JOIN:
    case EVENT_TYPES.SQL_GROUP:
    case EVENT_TYPES.SQL_AGGREGATE:
    case EVENT_TYPES.SQL_DISTINCT:
    case EVENT_TYPES.SQL_LIMIT: {
      handleGenericSqlOperation(
        state,
        event
      );

      break;
    }

    case EVENT_TYPES.SQL_RESULT: {
      const rows = getRowsFromPayload(
        event.payload
      );

      state.query.resultRows = rows
        ? cloneValue(rows)
        : cloneValue(state.query.currentRows);

      state.query.currentRows = cloneValue(
        state.query.resultRows
      );

      registerQueryOperation(
        state,
        event
      );

      break;
    }

    default: {
      break;
    }
  }

  applyStateDelta(
    state,
    event.stateDelta
  );

  return state;
}

class StateReconstructor {
  constructor(trace, options = {}) {
    assertValidTrace(
      trace
    );

    const {
      checkpointInterval = DEFAULT_CHECKPOINT_INTERVAL
    } = options;

    if (
      !Number.isInteger(checkpointInterval) ||
      checkpointInterval < 1
    ) {
      throw new TypeError(
        "checkpointInterval must be a positive integer"
      );
    }

    this.trace = cloneValue(
      trace
    );

    this.checkpointInterval = checkpointInterval;

    this.checkpoints = new Map();

    this.initialState = createInitialState(
      this.trace
    );

    this.checkpoints.set(
      -1,
      cloneValue(this.initialState)
    );

    this.buildCheckpoints();
  }

  get totalSteps() {
    return this.trace.events.length;
  }

  buildCheckpoints() {
    let state = cloneValue(
      this.initialState
    );

    for (const event of this.trace.events) {
      state = reduceExecutionEvent(
        state,
        event
      );

      const isCheckpoint = (
        (event.step + 1) % this.checkpointInterval === 0
      );

      const isLastEvent = (
        event.step === this.trace.events.length - 1
      );

      if (
        isCheckpoint ||
        isLastEvent
      ) {
        this.checkpoints.set(
          event.step,
          cloneValue(state)
        );
      }
    }
  }

  getCheckpointSteps() {
    return Array.from(
      this.checkpoints.keys()
    );
  }

  getEventAt(step) {
    if (!Number.isInteger(step)) {
      throw new TypeError(
        "Execution step must be an integer"
      );
    }

    if (step === -1) {
      return null;
    }

    if (
      step < 0 ||
      step >= this.totalSteps
    ) {
      throw new RangeError(
        `Execution step ${step} is outside the available timeline`
      );
    }

    return cloneValue(
      this.trace.events[step]
    );
  }

  findNearestCheckpoint(step) {
    let nearestStep = -1;

    for (const checkpointStep of this.checkpoints.keys()) {
      if (
        checkpointStep <= step &&
        checkpointStep > nearestStep
      ) {
        nearestStep = checkpointStep;
      }
    }

    return nearestStep;
  }

  getStateAt(step) {
    if (!Number.isInteger(step)) {
      throw new TypeError(
        "Execution step must be an integer"
      );
    }

    if (
      step < -1 ||
      step >= this.totalSteps
    ) {
      throw new RangeError(
        `Execution step ${step} is outside the available timeline`
      );
    }

    if (step === -1) {
      return cloneValue(
        this.initialState
      );
    }

    const checkpointStep = this.findNearestCheckpoint(
      step
    );

    let state = cloneValue(
      this.checkpoints.get(checkpointStep)
    );

    for (
      let currentStep = checkpointStep + 1;
      currentStep <= step;
      currentStep += 1
    ) {
      state = reduceExecutionEvent(
        state,
        this.trace.events[currentStep]
      );
    }

    return cloneValue(
      state
    );
  }

  reconstructAll() {
    return this.trace.events.map(
      (event) => this.getStateAt(
        event.step
      )
    );
  }
}

function createStateReconstructor(trace, options) {
  return new StateReconstructor(
    trace,
    options
  );
}

module.exports = {
  DEFAULT_CHECKPOINT_INTERVAL,

  createInitialState,

  reduceExecutionEvent,

  StateReconstructor,

  createStateReconstructor
};
