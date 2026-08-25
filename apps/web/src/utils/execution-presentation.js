function formatValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readableEventName(eventType) {
  return String(eventType || "EXECUTION_EVENT")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getLanguageLabel(language) {
  return {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    sql: "SQL"
  }[language] || "Program";
}

function describeEvent(event, state, language) {
  const payload = event.payload || {};
  const name = payload.name || payload.arrayName || payload.functionName;
  const value = payload.newValue ?? payload.value;

  switch (event.type) {
    case "PROGRAM_START":
      return {
        title: "Start program execution",
        description: `${getLanguageLabel(language)} execution begins processing your source code.`
      };

    case "PROGRAM_END":
      return {
        title: "Program execution completed",
        description: `Execution finished after ${event.step + 1} recorded events.`
      };

    case "SQL_QUERY_START":
      return {
        title: "Start logical query execution",
        description: "SQLite begins the verified query while CodeFlow prepares its educational relational flow."
      };

    case "SQL_QUERY_END":
      return {
        title: "Query execution completed",
        description: `The logical query flow finished after ${event.step + 1} recorded events.`
      };

    case "SQL_SCAN":
      return {
        title: `Scan ${payload.table || "the source table"}`,
        description: `${payload.scannedRows ?? payload.rowCount ?? 0} rows are read from ${payload.table || "the source table"}.`
      };

    case "SQL_FILTER":
      return {
        title: payload.row
          ? `Evaluate row ${(payload.rowIndex ?? 0) + 1}: ${payload.result ? "match" : "reject"}`
          : "Apply the relational filter",
        description: payload.row
          ? `${payload.condition || payload.predicate || "The filter"} evaluates to ${String(Boolean(payload.result)).toUpperCase()} for this row.`
          : `${payload.condition || payload.predicate || "The filter"} keeps ${payload.matchingRows ?? 0} rows.`
      };

    case "SQL_JOIN":
      return {
        title: "Join related table rows",
        description: `${payload.join || "The join condition"} combines matching rows from ${(payload.tables || []).join(" and ") || "the selected tables"}.`
      };

    case "SQL_GROUP":
      return {
        title: "Group related rows",
        description: `${payload.expression || "The GROUP BY expression"} creates ${payload.groupCount ?? payload.rows?.length ?? 0} logical groups.`
      };

    case "SQL_AGGREGATE":
      return {
        title: "Calculate aggregate values",
        description: `${payload.expressions || "The aggregate expressions"} produces values for the grouped or selected rows.`
      };

    case "SQL_PROJECT":
      return {
        title: "Project the selected columns",
        description: `The result keeps ${Array.isArray(payload.columns) ? payload.columns.join(", ") : "the selected expressions"}.`
      };

    case "SQL_DISTINCT":
      return {
        title: "Remove duplicate rows",
        description: `${payload.removedRows ?? 0} duplicate rows are removed from the logical result.`
      };

    case "SQL_SORT":
      return {
        title: "Sort the result rows",
        description: `${payload.expression || payload.column || "The ORDER BY expression"} arranges the current rows in ${payload.direction || "the requested"} order.`
      };

    case "SQL_LIMIT":
      return {
        title: "Limit the result set",
        description: `LIMIT ${payload.limit ?? ""} keeps ${payload.rowCount ?? payload.rows?.length ?? 0} result rows.`
      };

    case "SQL_RESULT":
      return {
        title: "Generate the verified result",
        description: `SQLite returns ${payload.rowCount ?? payload.rows?.length ?? 0} rows after the logical transformations.`
      };

    case "STATEMENT_EXECUTE":
      return {
        title: "Execute the current statement",
        description: `The program reaches line ${event.source?.line || "unknown"}.`
      };

    case "VARIABLE_DECLARE":
      return {
        title: `Declare ${name || "a variable"}`,
        description: `${name || "The variable"} is initialized to ${formatValue(value)}.`
      };

    case "VARIABLE_ASSIGN":
    case "VARIABLE_UPDATE":
      return {
        title: `Update ${name || "a variable"}`,
        description: `${name || "The variable"} changes from ${formatValue(payload.previousValue)} to ${formatValue(value)}.`
      };

    case "VARIABLE_READ":
      return {
        title: `Read ${name || "a variable"}`,
        description: `The program reads ${name || "the variable"} with value ${formatValue(value)}.`
      };

    case "ARRAY_CREATE":
      return {
        title: `Create ${name || "an array"}`,
        description: `${name || "The array"} starts with ${formatValue(payload.values || [])}.`
      };

    case "ARRAY_ACCESS":
      return {
        title: `Read ${name || "array"}[${payload.index}]`,
        description: `Index ${payload.index} contains ${formatValue(value)}.`
      };

    case "ARRAY_UPDATE":
      return {
        title: `Update ${name || "array"}[${payload.index}]`,
        description: `Index ${payload.index} changes from ${formatValue(payload.previousValue)} to ${formatValue(value)}.`
      };

    case "ARRAY_INSERT":
      return {
        title: `Insert into ${name || "an array"}`,
        description: `${formatValue(value)} is inserted at index ${payload.index}.`
      };

    case "ARRAY_DELETE":
      return {
        title: `Remove from ${name || "an array"}`,
        description: `${formatValue(value)} is removed from index ${payload.index}.`
      };

    case "STACK_CREATE":
      return {
        title: `Create ${name || "a stack"}`,
        description: "An empty last-in, first-out structure is ready for stack operations."
      };

    case "STACK_PUSH":
      return {
        title: `Push ${formatValue(value)} onto ${name || "the stack"}`,
        description: `${formatValue(value)} becomes the new top stack element.`
      };

    case "STACK_POP":
      return {
        title: `Pop ${formatValue(value)} from ${name || "the stack"}`,
        description: "The top element is removed from the stack."
      };

    case "QUEUE_CREATE":
      return {
        title: `Create ${name || "a queue"}`,
        description: "A first-in, first-out structure is ready for queue operations."
      };

    case "QUEUE_ENQUEUE":
      return {
        title: `Enqueue ${formatValue(value)}`,
        description: `${formatValue(value)} is added to the back of ${name || "the queue"}.`
      };

    case "QUEUE_DEQUEUE":
      return {
        title: `Dequeue ${formatValue(value)}`,
        description: `The first element is removed from ${name || "the queue"}.`
      };

    case "QUEUE_PEEK":
      return {
        title: `Peek at ${name || "the queue"}`,
        description: `${formatValue(value)} is currently at the front; the queue is not changed.`
      };

    case "HASHMAP_CREATE":
      return {
        title: `Create ${name || "a hash map"}`,
        description: "A key-value collection is ready to store and retrieve entries by key."
      };

    case "HASHMAP_SET":
      return {
        title: `${payload.updated ? "Update" : "Add"} key ${formatValue(payload.key)}`,
        description: payload.updated
          ? `${formatValue(payload.key)} changes from ${formatValue(payload.previousValue)} to ${formatValue(value)}.`
          : `${formatValue(payload.key)} now maps to ${formatValue(value)}.`
      };

    case "HASHMAP_GET":
      return {
        title: `Look up key ${formatValue(payload.key)}`,
        description: `${name || "The map"} returns ${formatValue(value)} for ${formatValue(payload.key)}.`
      };

    case "HASHMAP_HAS":
      return {
        title: `Check key ${formatValue(payload.key)}`,
        description: `${formatValue(payload.key)} ${payload.result ? "exists in" : "is absent from"} ${name || "the map"}.`
      };

    case "HASHMAP_DELETE":
      return {
        title: `Remove key ${formatValue(payload.key)}`,
        description: `The entry ${formatValue(payload.key)} → ${formatValue(value)} is removed from ${name || "the map"}.`
      };

    case "TREE_CREATE":
      return {
        title: `Create ${name || "a binary search tree"}`,
        description: "An empty binary search tree is ready to organize smaller values left and larger values right."
      };

    case "TREE_INSERT":
      return {
        title: `${payload.inserted === false ? "Skip duplicate" : "Insert"} ${formatValue(payload.value)}`,
        description: payload.inserted === false
          ? `${formatValue(payload.value)} already exists, so the tree shape is unchanged.`
          : `${formatValue(payload.value)} follows ${payload.path?.length || 1} comparison step${payload.path?.length === 1 ? "" : "s"} to its BST position.`
      };

    case "TREE_SEARCH":
      return {
        title: `${payload.found ? "Found" : "Search for"} ${formatValue(payload.target)}`,
        description: `${formatValue(payload.target)} ${payload.found ? "is found" : "is not present"} after visiting ${payload.path?.length || 0} tree node${payload.path?.length === 1 ? "" : "s"}.`
      };

    case "TREE_TRAVERSE":
      return {
        title: `${payload.traversalType || "inorder"} traversal`,
        description: `The traversal visits the tree in order: ${formatValue(payload.order || [])}.`
      };

    case "HEAP_CREATE":
      return {
        title: `Create ${name || "a min heap"}`,
        description: "An empty min heap is ready to keep its smallest value at the root."
      };

    case "HEAP_INSERT":
      return {
        title: `Insert ${formatValue(value)} into ${name || "the heap"}`,
        description: `${formatValue(value)} enters at the next open position before heap-order restoration.`
      };

    case "HEAP_SWAP":
      return {
        title: `${payload.reason === "bubble-down" ? "Bubble down" : "Bubble up"} through the heap`,
        description: `Indexes ${payload.fromIndex} and ${payload.toIndex} swap to restore the min-heap property.`
      };

    case "HEAP_PEEK":
      return {
        title: `Peek at the minimum value`,
        description: `${formatValue(value)} is at the root; the heap remains unchanged.`
      };

    case "HEAP_EXTRACT":
      return {
        title: `Extract minimum ${formatValue(value)}`,
        description: `The root is removed and the remaining values prepare to restore heap order.`
      };

    case "LINKED_LIST_CREATE":
      return {
        title: `Create ${name || "a linked list"}`,
        description: "An empty linked list begins with its head reference pointing to null."
      };

    case "NODE_CREATE":
      return {
        title: `Create node ${formatValue(value)}`,
        description: "A new node stores its value and a reference to the next node."
      };

    case "NODE_INSERT":
      return {
        title: `Insert ${formatValue(value)} at position ${payload.index}`,
        description: `The new node joins ${name || "the linked list"} and adjacent references are reconnected.`
      };

    case "NODE_DELETE":
      return {
        title: `Remove node ${formatValue(value)}`,
        description: `The node at position ${payload.index} leaves ${name || "the linked list"}; its predecessor points to the next node.`
      };

    case "NODE_VISIT":
      return {
        title: `Visit node ${formatValue(value)}`,
        description: `Traversal reaches node ${payload.index} by following the linked references.`
      };

    case "REFERENCE_UPDATE":
      return {
        title: payload.reference === "head" ? "Move the head reference" : "Reconnect the next reference",
        description: payload.targetNodeId
          ? `${payload.reference || "next"} now points to ${payload.targetNodeId}.`
          : `${payload.reference || "next"} now points to null.`
      };

    case "LOOP_START":
      return {
        title: "Enter the loop",
        description: `A ${payload.loopType || "loop"} begins checking its execution condition.`
      };

    case "LOOP_CONDITION":
      return {
        title: `Loop condition is ${payload.result ? "true" : "false"}`,
        description: `${payload.expression || "The loop condition"} evaluates to ${String(Boolean(payload.result)).toUpperCase()}.`
      };

    case "LOOP_ITERATION":
      return {
        title: `Start iteration ${payload.iteration ?? ""}`.trim(),
        description: `The loop begins iteration ${payload.iteration ?? "unknown"}.`
      };

    case "LOOP_END":
      return {
        title: "Exit the loop",
        description: `The loop finishes after ${payload.iterations ?? 0} iterations.`
      };

    case "CONDITION_EVALUATE":
      return {
        title: `Condition is ${payload.result ? "true" : "false"}`,
        description: `${payload.expression || "The condition"} evaluates to ${String(Boolean(payload.result)).toUpperCase()}.`
      };

    case "BRANCH_ENTER":
      return {
        title: `Enter the ${payload.branch || "selected"} branch`,
        description: payload.reason || "Execution follows the branch selected by the condition."
      };

    case "FUNCTION_CALL":
      return {
        title: `Call ${name || "a function"}`,
        description: `The program invokes ${name || "the selected function"}.`
      };

    case "FUNCTION_ENTER":
      return {
        title: `Enter ${name || "a function"}`,
        description: `A new call-stack frame is created for ${name || "the function"}.`
      };

    case "FUNCTION_RETURN":
      return {
        title: `Return from ${name || "a function"}`,
        description: `${name || "The function"} returns ${formatValue(payload.returnValue ?? value)}.`
      };

    case "OUTPUT":
      return {
        title: "Write console output",
        description: payload.text || payload.message || "The program produces console output."
      };

    case "ERROR":
      return {
        title: payload.name || payload.errorType || "Execution error",
        description: payload.message || state.errors?.at(-1)?.message || "Program execution failed."
      };

    default:
      return {
        title: readableEventName(event.type),
        description: payload.message || `The execution engine recorded ${readableEventName(event.type).toLowerCase()}.`
      };
  }
}

function selectArray(state, event) {
  const arrays = state.arrays || {};
  const stackNames = new Set(Object.keys(state.stacks || {}));
  const queueNames = new Set(Object.keys(state.queues || {}));
  const hashMapNames = new Set(Object.keys(state.hashMaps || {}));
  const linkedListNames = new Set(Object.keys(state.linkedLists || {}));
  const treeNames = new Set(Object.keys(state.trees || {}));
  const heapNames = new Set(Object.keys(state.heaps || {}));
  const eventArray = event.payload?.arrayName || event.payload?.name;

  const visibleNames = Object.keys(arrays).filter(
    (name) => (
      !stackNames.has(name) &&
      !queueNames.has(name) &&
      !hashMapNames.has(name) &&
      !linkedListNames.has(name) &&
      !treeNames.has(name) &&
      !heapNames.has(name) &&
      !(
        ["args", "argv"].includes(name.toLowerCase()) &&
        Array.isArray(arrays[name]) &&
        arrays[name].length === 0
      )
    )
  );

  const selectedName = visibleNames.includes(eventArray)
    ? eventArray
    : visibleNames.find(
      (name) => Array.isArray(arrays[name]) && arrays[name].length > 0
    ) || visibleNames.find(
      (name) => !["args", "argv"].includes(name.toLowerCase())
    ) || visibleNames[0];

  if (!selectedName || !Array.isArray(arrays[selectedName])) {
    return null;
  }

  const eventTouchesSelectedArray = eventArray === selectedName;
  const activeIndex = eventTouchesSelectedArray && Number.isInteger(event.payload?.index)
    ? event.payload.index
    : null;

  return {
    name: selectedName,
    values: arrays[selectedName],
    activeIndex
  };
}

function selectVariables(state) {
  const variables = {
    ...(state.variables || {})
  };

  // A language runtime may expose a collection variable as an opaque object
  // reference while the normalized trace separately contains its verified
  // logical contents. Present the normalized contents to the learner.
  for (const [name, values] of Object.entries(state.stacks || {})) {
    variables[name] = values;
  }

  for (const [name, values] of Object.entries(state.queues || {})) {
    variables[name] = values;
  }

  for (const [name, linkedList] of Object.entries(state.linkedLists || {})) {
    variables[name] = (linkedList.nodes || []).map((node) => node.value);
  }

  for (const [name, hashMap] of Object.entries(state.hashMaps || {})) {
    variables[name] = Object.fromEntries(
      (hashMap.entries || []).map((entry) => [String(entry.key), entry.value])
    );
  }

  for (const [name, tree] of Object.entries(state.trees || {})) {
    variables[name] = treeValuesInorder(tree);
  }

  for (const [name, heap] of Object.entries(state.heaps || {})) {
    variables[name] = Array.isArray(heap.values) ? heap.values : [];
  }

  return variables;
}

function treeValuesInorder(tree) {
  if (Array.isArray(tree.traversalOrder) && tree.traversalOrder.length > 0) {
    return tree.traversalOrder;
  }

  const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const values = [];

  function visit(nodeId) {
    const node = byId.get(nodeId);

    if (!node) {
      return;
    }

    visit(node.leftId);
    values.push(node.value);
    visit(node.rightId);
  }

  visit(tree.rootId);
  return values;
}

function selectTree(state, event) {
  const trees = state.trees || {};
  const eventTree = event.payload?.treeName || event.payload?.name;
  const selectedName = Object.hasOwn(trees, eventTree)
    ? eventTree
    : Object.keys(trees)[0];

  if (!selectedName || !Array.isArray(trees[selectedName]?.nodes)) {
    return null;
  }

  const tree = trees[selectedName];
  const isTreeEvent = eventTree === selectedName && event.type.startsWith("TREE_");

  return {
    name: selectedName,
    nodes: tree.nodes,
    rootId: tree.rootId,
    activeNodeId: isTreeEvent ? tree.activeNodeId : null,
    visitedIds: isTreeEvent && Array.isArray(tree.visitedIds) ? tree.visitedIds : [],
    traversalOrder: Array.isArray(tree.traversalOrder) ? tree.traversalOrder : [],
    searchResult: tree.searchResult,
    operation: isTreeEvent ? event.type : null
  };
}

function selectHeap(state, event) {
  const heaps = state.heaps || {};
  const eventHeap = event.payload?.heapName || event.payload?.name;
  const selectedName = Object.hasOwn(heaps, eventHeap)
    ? eventHeap
    : Object.keys(heaps)[0];

  if (!selectedName || !Array.isArray(heaps[selectedName]?.values)) {
    return null;
  }

  const heap = heaps[selectedName];
  const isHeapEvent = eventHeap === selectedName && event.type.startsWith("HEAP_");

  return {
    name: selectedName,
    heapType: heap.heapType || "min",
    values: heap.values,
    activeIndices: isHeapEvent && Array.isArray(heap.activeIndices)
      ? heap.activeIndices
      : [],
    swap: isHeapEvent ? heap.swap : null,
    peekedValue: heap.peekedValue,
    extractedValue: heap.extractedValue,
    operation: isHeapEvent ? event.type : null
  };
}

function selectStack(state, event) {
  const stacks = state.stacks || {};
  const eventStack = event.payload?.name;
  const selectedName = Object.hasOwn(stacks, eventStack)
    ? eventStack
    : Object.keys(stacks)[0];

  if (!selectedName || !Array.isArray(stacks[selectedName])) {
    return null;
  }

  return {
    name: selectedName,
    values: stacks[selectedName]
  };
}

function selectQueue(state, event) {
  const queues = state.queues || {};
  const eventQueue = event.payload?.name;
  const selectedName = Object.hasOwn(queues, eventQueue)
    ? eventQueue
    : Object.keys(queues)[0];

  if (!selectedName || !Array.isArray(queues[selectedName])) {
    return null;
  }

  return {
    name: selectedName,
    values: queues[selectedName],
    operation: eventQueue === selectedName && event.type.startsWith("QUEUE_")
      ? event.type
      : null,
    activeValue: eventQueue === selectedName
      ? event.payload?.value
      : undefined
  };
}

function selectLinkedList(state, event) {
  const linkedLists = state.linkedLists || {};
  const eventList = event.payload?.listName || event.payload?.name;
  const selectedName = Object.hasOwn(linkedLists, eventList)
    ? eventList
    : Object.keys(linkedLists)[0];

  if (!selectedName || !Array.isArray(linkedLists[selectedName]?.nodes)) {
    return null;
  }

  const linkedList = linkedLists[selectedName];

  return {
    name: selectedName,
    nodes: linkedList.nodes,
    headId: linkedList.headId,
    tailId: linkedList.tailId,
    activeNodeId: eventList === selectedName ? linkedList.activeNodeId : null,
    pendingNode: linkedList.pendingNode,
    operation: eventList === selectedName && (
      event.type.startsWith("NODE_") ||
      event.type === "REFERENCE_UPDATE" ||
      event.type === "LINKED_LIST_CREATE"
    ) ? event.type : null
  };
}

function selectHashMap(state, event) {
  const hashMaps = state.hashMaps || {};
  const eventMap = event.payload?.mapName || event.payload?.name;
  const selectedName = Object.hasOwn(hashMaps, eventMap)
    ? eventMap
    : Object.keys(hashMaps)[0];

  if (!selectedName || !Array.isArray(hashMaps[selectedName]?.entries)) {
    return null;
  }

  const hashMap = hashMaps[selectedName];
  const activeOperation = eventMap === selectedName && event.type.startsWith("HASHMAP_");

  return {
    name: selectedName,
    entries: hashMap.entries,
    size: hashMap.entries.length,
    activeKey: activeOperation ? hashMap.activeKey : null,
    operation: activeOperation ? event.type : null,
    lastResult: hashMap.lastResult
  };
}

function selectControlFlow(state, event) {
  const loops = Object.values(state.controlFlow?.loops || {});
  const eventLoop = loops.find((loop) => loop.id === event.payload?.loopId);
  const activeLoop = eventLoop || [...loops].reverse().find((loop) => loop.active);
  const directCondition = event.type === "CONDITION_EVALUATE" || event.type === "LOOP_CONDITION"
    ? {
      expression: event.payload?.expression || "condition",
      result: Boolean(event.payload?.result)
    }
    : null;

  return {
    iteration: activeLoop?.iteration ?? null,
    condition: directCondition || activeLoop?.condition || state.controlFlow?.lastCondition || null
  };
}

function selectSql(state, event, context) {
  const payload = event.payload || {};
  const query = state.query || {};
  const payloadRows = Array.isArray(payload.rows) ? payload.rows : null;
  const currentRows = Array.isArray(query.currentRows) ? query.currentRows : [];

  if (typeof payload.table === "string" && payload.table) {
    context.table = payload.table;
  }

  if (Array.isArray(payload.columns) && payload.columns.length > 0) {
    context.columns = [...payload.columns];
  } else if (Array.isArray(query.columns) && query.columns.length > 0) {
    context.columns = [...query.columns];
  }

  if (event.type === "SQL_SCAN") {
    context.displayRows = payloadRows || currentRows;
    context.rejectedIds = [];
  } else if (event.type === "SQL_FILTER") {
    context.displayRows = Array.isArray(payload.displayRows)
      ? payload.displayRows
      : context.displayRows.length > 0
        ? context.displayRows
        : payloadRows || currentRows;

    if (Array.isArray(payload.rejectedIds)) {
      context.rejectedIds = [...payload.rejectedIds];
    }
  } else if (
    event.type.startsWith("SQL_") &&
    !["SQL_QUERY_START", "SQL_QUERY_END"].includes(event.type) &&
    payloadRows
  ) {
    context.displayRows = payloadRows;
    context.rejectedIds = [];
  }

  const rows = payloadRows || currentRows;
  const displayRows = context.displayRows.length > 0
    ? context.displayRows
    : rows;

  if (context.columns.length === 0) {
    const firstRow = displayRows[0] || rows[0];
    context.columns = firstRow && typeof firstRow === "object"
      ? Object.keys(firstRow)
      : [];
  }

  return {
    table: context.table || "Query workspace",
    rows,
    displayRows,
    columns: [...context.columns],
    rejectedIds: [...context.rejectedIds],
    activeRowIndex: Number.isInteger(payload.rowIndex) ? payload.rowIndex : null,
    activeRowResult: typeof payload.result === "boolean" ? payload.result : null,
    operation: payload.operation || readableEventName(event.type),
    scannedCount: query.scannedRowCount ?? payload.scannedRows ?? 0,
    matchingCount: query.matchingRowCount ?? payload.matchingRows ?? 0,
    rejectedCount: query.rejectedRowCount ?? payload.rejectedRows ?? 0
  };
}

export function createExecutionPresentation(result) {
  if (!result || typeof result !== "object") {
    throw new TypeError("Execution response must be an object.");
  }

  if (result.status !== "ok") {
    throw new Error(result.error?.message || "Execution did not complete successfully.");
  }

  if (!Array.isArray(result.trace?.events) || result.trace.events.length === 0) {
    throw new TypeError("Execution response does not contain trace events.");
  }

  if (!Array.isArray(result.states) || result.states.length !== result.trace.events.length) {
    throw new TypeError("Execution states do not match the trace-event count.");
  }

  const sqlContext = {
    table: null,
    columns: [],
    displayRows: [],
    rejectedIds: []
  };

  const steps = result.trace.events.map((event, index) => {
    const state = result.states[index];

    if (!state || state.step !== event.step) {
      throw new TypeError(`Execution state and trace event are not synchronized at step ${index}.`);
    }

    const narrative = describeEvent(event, state, result.language);
    const controlFlow = selectControlFlow(state, event);
    const line = event.source?.line || state.source?.line || null;

    return {
      id: event.id || `${result.trace.traceId || result.language}-${event.step}`,
      line,
      event: event.type,
      title: narrative.title,
      description: narrative.description,
      variables: selectVariables(state),
      array: selectArray(state, event),
      stack: selectStack(state, event),
      queue: selectQueue(state, event),
      linkedList: selectLinkedList(state, event),
      hashMap: selectHashMap(state, event),
      tree: selectTree(state, event),
      heap: selectHeap(state, event),
      callStack: (state.callStack || []).map((frame) => ({
        name: frame.name || frame.functionName || "anonymous",
        line: frame.source?.line || line
      })),
      console: Array.isArray(state.console) ? state.console : [],
      iteration: controlFlow.iteration,
      condition: controlFlow.condition,
      sql: result.language === "sql"
        ? selectSql(state, event, sqlContext)
        : null,
      status: state.status,
      error: state.errors?.at(-1) || null,
      payload: event.payload || {}
    };
  });

  return {
    language: result.language,
    executionStatus: result.executionStatus || result.trace.status,
    trace: result.trace,
    summary: result.summary || {},
    steps
  };
}

export function createIdleExecutionStep(language = "javascript") {
  const isSql = language === "sql";

  return {
    id: `${language}-idle`,
    line: null,
    event: isSql ? "SQL_QUERY_START" : "PROGRAM_START",
    title: isSql ? "Run your query to begin" : "Run your code to begin",
    description: isSql
      ? "Execute the current SQL query to create a verified relational trace."
      : "Execute the current editor contents to create a verified execution trace.",
    variables: {},
    array: null,
    stack: null,
    queue: null,
    linkedList: null,
    hashMap: null,
    tree: null,
    heap: null,
    callStack: [],
    console: [],
    iteration: null,
    condition: null,
    sql: isSql
      ? {
        table: "Query workspace",
        rows: [],
        displayRows: [],
        columns: [],
        rejectedIds: [],
        activeRowIndex: null,
        activeRowResult: null,
        operation: "Waiting for query",
        scannedCount: 0,
        matchingCount: 0,
        rejectedCount: 0
      }
      : null,
    status: "idle",
    error: null,
    payload: {}
  };
}
