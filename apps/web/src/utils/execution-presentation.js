import { selectVisibleRuntimeVariables } from "./value-presentation.js";

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
  const graphNodes = payload.nodes || state.graphs?.[payload.graphName || name]?.nodes || [];
  const graphSourceValue = payload.sourceValue
    ?? graphNodes.find((node) => node.id === payload.sourceId)?.value;
  const graphTargetValue = payload.targetValue
    ?? graphNodes.find((node) => node.id === payload.targetId)?.value;

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

    case "SEARCH_START":
      return {
        title: `Start ${payload.algorithm === "binary" ? "binary" : "linear"} search`,
        description: `${payload.algorithm === "binary" ? "Binary" : "Linear"} search looks for ${formatValue(payload.target)} in ${payload.arrayName || "the array"}.`
      };

    case "SEARCH_COMPARE":
      return {
        title: `Compare ${payload.arrayName || "values"}[${payload.index}] with ${formatValue(payload.target)}`,
        description: `${formatValue(payload.value)} ${payload.matched ? "matches" : "does not match"} the target ${formatValue(payload.target)}.`
      };

    case "SEARCH_RANGE_UPDATE":
      return {
        title: payload.algorithm === "binary"
          ? "Narrow the binary search range"
          : "Advance to the next array index",
        description: payload.algorithm === "binary"
          ? `LOW ${payload.low}, HIGH ${payload.high}${Number.isInteger(payload.middle) ? `, MID ${payload.middle}` : ""}; eliminated indices are no longer searched.`
          : `Move to index ${payload.low} after checking index ${payload.previousIndex}.`
      };

    case "SEARCH_FOUND":
      return {
        title: `Found ${formatValue(payload.target)} at index ${payload.foundIndex ?? payload.index}`,
        description: `${payload.algorithm === "binary" ? "Binary" : "Linear"} search found its target after ${payload.comparisonCount} comparisons.`
      };

    case "SEARCH_NOT_FOUND":
      return {
        title: `${formatValue(payload.target)} was not found`,
        description: `The search exhausted its candidate range after ${payload.comparisonCount} comparisons.`
      };

    case "SEARCH_END":
      return {
        title: `${payload.algorithm === "binary" ? "Binary" : "Linear"} search completed`,
        description: payload.found
          ? `Return index ${payload.foundIndex} after ${payload.comparisonCount} comparisons.`
          : `Return -1 because ${formatValue(payload.target)} is absent after ${payload.comparisonCount} comparisons.`
      };

    case "SORT_START":
      return {
        title: `Start ${payload.algorithm} sort`,
        description: `${payload.algorithm.charAt(0).toUpperCase() + payload.algorithm.slice(1)} sort begins arranging ${payload.arrayName || "the array"} in ascending order.`
      };

    case "SORT_SPLIT":
      return {
        title: `Split range ${payload.rangeStart}–${payload.rangeEnd}`,
        description: `Merge sort divides the active range at index ${payload.middle} before recursively sorting both halves.`
      };

    case "SORT_MERGE":
      return {
        title: `Merge range ${payload.rangeStart}–${payload.rangeEnd}`,
        description: `The ordered left and right halves are combined into one sorted range.`
      };

    case "SORT_PIVOT":
      return {
        title: `Choose pivot ${formatValue(payload.pivotValue)}`,
        description: `Quick sort partitions range ${payload.rangeStart}–${payload.rangeEnd} around the pivot at index ${payload.pivotIndex}.`
      };

    case "SORT_PARTITION":
      return {
        title: `Pivot settled at index ${payload.partitionIndex}`,
        description: `Values smaller than or equal to ${formatValue(payload.pivotValue)} are on the left; larger values remain on the right.`
      };

    case "SORT_COMPARE":
      return {
        title: `Compare positions ${(payload.compareIndices || []).join(" and ")}`,
        description: payload.candidateChanged
          ? `Position ${payload.minIndex} becomes the new smallest candidate in selection sort.`
          : `Compare ${formatValue(payload.leftValue)} with ${formatValue(payload.rightValue)} to determine their correct order.`
      };

    case "SORT_SWAP":
      return {
        title: `Swap positions ${(payload.swapIndices || []).join(" and ")}`,
        description: `${payload.algorithm.charAt(0).toUpperCase() + payload.algorithm.slice(1)} sort exchanges two out-of-order values; ${payload.swapCount} swap${payload.swapCount === 1 ? "" : "s"} so far.`
      };

    case "SORT_WRITE":
      return {
        title: payload.action === "merge"
          ? `Write ${formatValue(payload.value)} at position ${payload.writeIndex}`
          : payload.action === "shift"
          ? `Shift a value into position ${payload.writeIndex}`
          : `Insert ${formatValue(payload.value)} at position ${payload.writeIndex}`,
        description: payload.action === "merge"
          ? "Merge sort writes the next smallest value from the two ordered halves."
          : payload.action === "shift"
          ? `Move ${formatValue(payload.value)} one position right to open space for ${formatValue(payload.key)}.`
          : `${formatValue(payload.value)} is placed into its ordered position in the sorted prefix.`
      };

    case "SORT_MARK_SORTED":
      return {
        title: `Confirm ${(payload.sortedIndices || []).length} ordered position${(payload.sortedIndices || []).length === 1 ? "" : "s"}`,
        description: `The highlighted positions now satisfy the ordering established by ${payload.algorithm} sort.`
      };

    case "SORT_PASS":
      return {
        title: `Complete ${payload.algorithm} sort pass ${payload.pass}`,
        description: `${payload.comparisonCount} comparison${payload.comparisonCount === 1 ? "" : "s"} and ${payload.swapCount || payload.writeCount || 0} array changes have been recorded.`
      };

    case "SORT_END":
      return {
        title: `${payload.algorithm.charAt(0).toUpperCase() + payload.algorithm.slice(1)} sort completed`,
        description: `${payload.arrayName || "The array"} is sorted after ${payload.comparisonCount} comparisons, ${payload.swapCount} swaps, and ${payload.writeCount} writes.`
      };

    case "DP_START":
      return {
        title: `Start ${String(payload.algorithm || "dynamic programming").replaceAll("-", " ")}`,
        description: `${payload.dimension === "2d" ? "A two-dimensional" : "A one-dimensional"} table stores solved subproblems for reuse.`
      };

    case "DP_CACHE_HIT":
      return {
        title: `Reuse cached state ${formatValue(payload.stateKey)}`,
        description: `The memoized value ${formatValue(payload.value)} is returned without recomputing the subproblem.`
      };

    case "DP_CACHE_MISS":
      return {
        title: `Solve uncached state ${formatValue(payload.stateKey)}`,
        description: "This subproblem is not cached yet, so its dependencies must be evaluated."
      };

    case "DP_STATE_READ":
      return {
        title: `Read ${payload.readCells?.length || 0} previous DP state${payload.readCells?.length === 1 ? "" : "s"}`,
        description: `Use ${formatValue(payload.values || [])} to calculate cell [${payload.activeRow}, ${payload.activeColumn}].`
      };

    case "DP_CHOICE":
      return {
        title: `Choose ${String(payload.decision || "best transition").replaceAll("-", " ")}`,
        description: `Compare ${formatValue(payload.candidates || [])} and select ${formatValue(payload.chosenValue)} for the active state.`
      };

    case "DP_STATE_WRITE":
      return {
        title: `Write ${formatValue(payload.value)} to DP cell [${payload.activeRow}, ${payload.activeColumn}]`,
        description: `The solved subproblem is stored for later transitions; ${payload.writeCount} write${payload.writeCount === 1 ? "" : "s"} recorded.`
      };

    case "DP_ROW_COMPLETE":
      return {
        title: `Complete DP row ${payload.completedRow}`,
        description: "Every state in this row is now available to later subproblems."
      };

    case "DP_END":
      return {
        title: `${String(payload.algorithm || "Dynamic programming").replaceAll("-", " ")} completed`,
        description: `The final result is ${formatValue(payload.result)} after ${payload.readCount} reads, ${payload.writeCount} writes, and ${payload.choiceCount} decisions.`
      };

    case "HANOI_START":
      return {
        title: `Start Tower of Hanoi with ${payload.diskCount} disks`,
        description: `Move the complete tower from peg ${payload.source} to peg ${payload.target} in exactly ${payload.expectedMoves} legal moves.`
      };

    case "HANOI_CALL":
      return {
        title: `Solve ${payload.disk} disk${payload.disk === 1 ? "" : "s"}: ${payload.from} → ${payload.to}`,
        description: `Push recursion depth ${payload.depth}; peg ${payload.auxiliary} is the auxiliary workspace.`
      };

    case "HANOI_MOVE":
      return {
        title: `Move ${payload.moveNumber}/${payload.expectedMoves}: disk ${payload.disk}, ${payload.from} → ${payload.to}`,
        description: `The smallest exposed disk moves legally from peg ${payload.from} to peg ${payload.to}.`
      };

    case "HANOI_RETURN":
      return {
        title: `Return from ${payload.disk}-disk subproblem`,
        description: `The ${payload.from} → ${payload.to} subproblem is complete and its recursion frame unwinds.`
      };

    case "HANOI_END":
      return {
        title: "Tower of Hanoi completed",
        description: `All ${payload.diskCount} disks reached peg ${payload.target} in the optimal ${payload.moveNumber} moves.`
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

    case "GRAPH_CREATE":
      return {
        title: `Create ${name || "a graph"}`,
        description: `An empty ${payload.directed ? "directed" : "undirected"} graph is ready to connect related nodes.`
      };

    case "GRAPH_NODE_ADD":
      return {
        title: `Add graph node ${formatValue(payload.node?.value ?? value)}`,
        description: `${formatValue(payload.node?.value ?? value)} joins ${name || "the graph"} as an independent vertex.`
      };

    case "GRAPH_EDGE_ADD":
      return {
        title: `Connect ${formatValue(graphSourceValue)} to ${formatValue(graphTargetValue)}`,
        description: `A${payload.directed ? " directed" : "n undirected"} edge connects the two graph vertices.`
      };

    case "GRAPH_EDGE_TRAVERSE":
      return {
        title: `Follow ${formatValue(graphSourceValue)} → ${formatValue(graphTargetValue)}`,
        description: `${String(payload.traversalType || "graph").toUpperCase()} follows an existing connection to discover the next vertex.`
      };

    case "GRAPH_VISIT":
      return {
        title: `Visit node ${formatValue(payload.nodeValue ?? value)}`,
        description: `${String(payload.traversalType || "graph").toUpperCase()} marks ${formatValue(payload.nodeValue ?? value)} as visited.`
      };

    case "GRAPH_TRAVERSE":
      return {
        title: `${String(payload.traversalType || "graph").toUpperCase()} traversal completed`,
        description: `The traversal visits connected vertices in this order: ${formatValue(payload.order || [])}.`
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
        title: payload.recursive
          ? `Recurse into ${name || "the function"}`
          : `Call ${name || "a function"}`,
        description: payload.recursive
          ? `${name || "The function"} calls itself at recursion depth ${payload.recursionDepth ?? "unknown"}.`
          : `The program invokes ${name || "the selected function"}.`
      };

    case "FUNCTION_ENTER":
      return {
        title: payload.recursive
          ? `Push recursive frame ${payload.recursionDepth ?? ""}`.trim()
          : `Enter ${name || "a function"}`,
        description: `A new call-stack frame is created for ${name || "the function"}${payload.recursive ? ` with depth ${payload.recursionDepth}` : ""}.`
      };

    case "FUNCTION_RETURN":
      return {
        title: payload.baseCase
          ? `Base case returns ${formatValue(payload.returnValue ?? value)}`
          : `Return from ${name || "a function"}`,
        description: payload.baseCase
          ? `${name || "The function"} reaches the deepest recursive frame and starts stack unwinding.`
          : `${name || "The function"} returns ${formatValue(payload.returnValue ?? value)}${payload.unwinding ? " while the recursive call stack unwinds" : ""}.`
      };

    case "OUTPUT":
      return {
        title: "Write console output",
        description: payload.text || payload.message || "The program produces console output."
      };

    case "INPUT":
      return {
        title: `Read program input ${payload.inputNumber ?? ""}`.trim(),
        description: `${payload.prompt ? `${payload.prompt} receives ` : "The program receives "}${formatValue(payload.rawValue ?? payload.value)}. ${payload.remaining ?? 0} queued input value${payload.remaining === 1 ? " remains" : "s remain"}.`
      };

    case "EXCEPTION_THROW":
      return {
        title: `${payload.name || payload.errorType || "Exception"} was thrown`,
        description: payload.message || "Program execution raised an exception."
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
  const graphNames = new Set(Object.keys(state.graphs || {}));
  const eventArray = event.payload?.arrayName || event.payload?.name;

  const visibleNames = Object.keys(arrays).filter(
    (name) => (
      !stackNames.has(name) &&
      !queueNames.has(name) &&
      !hashMapNames.has(name) &&
      !linkedListNames.has(name) &&
      !treeNames.has(name) &&
      !heapNames.has(name) &&
      !graphNames.has(name) &&
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

function selectVariables(state, language) {
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

  for (const [name, graph] of Object.entries(state.graphs || {})) {
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const adjacency = Object.fromEntries(
      nodes.map((node) => [String(node.value), []])
    );

    for (const edge of graph.edges || []) {
      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);

      if (!source || !target) {
        continue;
      }

      adjacency[String(source.value)].push(target.value);

      if (!graph.directed && source.id !== target.id) {
        adjacency[String(target.value)].push(source.value);
      }
    }

    variables[name] = adjacency;
  }

  return selectVisibleRuntimeVariables(variables, language);
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

function selectGraph(state, event) {
  const graphs = state.graphs || {};
  const eventGraph = event.payload?.graphName || event.payload?.name;
  const selectedName = Object.hasOwn(graphs, eventGraph)
    ? eventGraph
    : Object.keys(graphs)[0];

  if (!selectedName || !Array.isArray(graphs[selectedName]?.nodes)) {
    return null;
  }

  const graph = graphs[selectedName];
  const isGraphEvent = eventGraph === selectedName && event.type.startsWith("GRAPH_");

  return {
    name: selectedName,
    directed: Boolean(graph.directed),
    nodes: graph.nodes,
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    activeNodeId: isGraphEvent ? graph.activeNodeId : null,
    activeEdgeId: isGraphEvent ? graph.activeEdgeId : null,
    visitedIds: Array.isArray(graph.visitedIds) ? graph.visitedIds : [],
    traversalOrder: Array.isArray(graph.traversalOrder) ? graph.traversalOrder : [],
    traversalType: graph.traversalType || null,
    operation: isGraphEvent ? event.type : null
  };
}

function selectSearch(state, event) {
  const searches = state.searches || {};
  const eventSearchId = event.payload?.searchId;
  const selectedId = Object.hasOwn(searches, eventSearchId)
    ? eventSearchId
    : Object.keys(searches).at(-1);

  if (!selectedId || !Array.isArray(searches[selectedId]?.values)) {
    return null;
  }

  const search = searches[selectedId];

  return {
    ...search,
    comparedIndices: Array.isArray(search.comparedIndices) ? search.comparedIndices : [],
    eliminatedIndices: Array.isArray(search.eliminatedIndices) ? search.eliminatedIndices : [],
    operation: eventSearchId === selectedId && event.type.startsWith("SEARCH_")
      ? event.type
      : null
  };
}

function selectSort(state, event) {
  const sorts = state.sorts || {};
  const eventSortId = event.payload?.sortId;
  const selectedId = Object.hasOwn(sorts, eventSortId)
    ? eventSortId
    : Object.keys(sorts).at(-1);

  if (!selectedId || !Array.isArray(sorts[selectedId]?.values)) {
    return null;
  }

  const sort = sorts[selectedId];

  return {
    ...sort,
    initialValues: Array.isArray(sort.initialValues) ? sort.initialValues : sort.values,
    compareIndices: Array.isArray(sort.compareIndices) ? sort.compareIndices : [],
    swapIndices: Array.isArray(sort.swapIndices) ? sort.swapIndices : [],
    sortedIndices: Array.isArray(sort.sortedIndices) ? sort.sortedIndices : [],
    leftRange: Array.isArray(sort.leftRange) ? sort.leftRange : null,
    rightRange: Array.isArray(sort.rightRange) ? sort.rightRange : null,
    operation: eventSortId === selectedId && event.type.startsWith("SORT_")
      ? event.type
      : null
  };
}

function selectDynamicProgramming(state, event) {
  const dynamicPrograms = state.dynamicPrograms || {};
  const eventDpId = event.payload?.dpId;
  const selectedId = Object.hasOwn(dynamicPrograms, eventDpId)
    ? eventDpId
    : Object.keys(dynamicPrograms).at(-1);

  if (!selectedId || !Array.isArray(dynamicPrograms[selectedId]?.table)) {
    return null;
  }

  const dynamicProgram = dynamicPrograms[selectedId];
  return {
    ...dynamicProgram,
    table: dynamicProgram.table.map((row) => Array.isArray(row) ? row : []),
    rowLabels: Array.isArray(dynamicProgram.rowLabels) ? dynamicProgram.rowLabels : [],
    columnLabels: Array.isArray(dynamicProgram.columnLabels) ? dynamicProgram.columnLabels : [],
    readCells: Array.isArray(dynamicProgram.readCells) ? dynamicProgram.readCells : [],
    writtenCell: Array.isArray(dynamicProgram.writtenCell) ? dynamicProgram.writtenCell : null,
    completedRows: Array.isArray(dynamicProgram.completedRows) ? dynamicProgram.completedRows : [],
    resultCell: Array.isArray(dynamicProgram.resultCell) ? dynamicProgram.resultCell : null,
    candidates: Array.isArray(dynamicProgram.candidates) ? dynamicProgram.candidates : [],
    operation: eventDpId === selectedId && event.type.startsWith("DP_")
      ? event.type
      : null
  };
}

function selectHanoi(state, event) {
  const hanoiRuns = state.hanoiRuns || {};
  const eventHanoiId = event.payload?.hanoiId;
  const selectedId = Object.hasOwn(hanoiRuns, eventHanoiId)
    ? eventHanoiId
    : Object.keys(hanoiRuns).at(-1);

  if (!selectedId || !hanoiRuns[selectedId]?.pegs) {
    return null;
  }

  const hanoi = hanoiRuns[selectedId];
  return {
    ...hanoi,
    pegs: {
      A: Array.isArray(hanoi.pegs.A) ? hanoi.pegs.A : [],
      B: Array.isArray(hanoi.pegs.B) ? hanoi.pegs.B : [],
      C: Array.isArray(hanoi.pegs.C) ? hanoi.pegs.C : []
    },
    frames: Array.isArray(hanoi.frames) ? hanoi.frames : [],
    operation: eventHanoiId === selectedId && event.type.startsWith("HANOI_")
      ? event.type
      : null
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

function selectRecursion(state, event, language) {
  const recursion = state.recursion || {};
  const payload = event.payload || {};
  const isRecursiveExecution = (
    (recursion.maxDepth || 0) > 1 ||
    payload.recursive === true ||
    payload.baseCase === true ||
    payload.unwinding === true
  );

  if (!isRecursiveExecution) {
    return null;
  }

  const mapFrame = (frame) => ({
    id: frame.id || frame.frameId || frame.scopeId,
    name: frame.name || frame.functionName || "anonymous",
    depth: frame.depth ?? null,
    recursionDepth: frame.recursionDepth ?? 1,
    parameters: frame.parameters || {},
    locals: selectVisibleRuntimeVariables(
      state.scopes?.[frame.scopeId]?.variables || {},
      language
    ),
    sourceLine: frame.source?.line || null,
    recursive: Boolean(frame.recursive),
    returnValue: frame.returnValue,
    baseCase: Boolean(frame.baseCase)
  });

  return {
    functionName: recursion.functionName || payload.functionName || payload.name || "recursive function",
    active: Boolean(recursion.active),
    depth: recursion.depth || 0,
    maxDepth: recursion.maxDepth || payload.recursionDepth || 1,
    frames: Array.isArray(recursion.frames)
      ? recursion.frames.map(mapFrame)
      : [],
    baseCase: recursion.baseCase ? mapFrame(recursion.baseCase) : null,
    lastReturn: recursion.lastReturn ? mapFrame(recursion.lastReturn) : null,
    unwinding: Boolean(recursion.unwinding || payload.unwinding),
    operation: event.type
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
    const search = selectSearch(state, event);
    const sort = selectSort(state, event);
    const dynamicProgramming = selectDynamicProgramming(state, event);
    const hanoi = selectHanoi(state, event);
    const array = selectArray(state, event);

    return {
      id: event.id || `${result.trace.traceId || result.language}-${event.step}`,
      line,
      event: event.type,
      title: narrative.title,
      description: narrative.description,
      language: result.language,
      variables: selectVariables(state, result.language),
      array: dynamicProgramming || sort || (search && array?.name === search.arrayName)
        ? null
        : array,
      search,
      sort,
      dynamicProgramming,
      hanoi,
      stack: selectStack(state, event),
      queue: selectQueue(state, event),
      linkedList: selectLinkedList(state, event),
      hashMap: selectHashMap(state, event),
      tree: selectTree(state, event),
      heap: selectHeap(state, event),
      graph: selectGraph(state, event),
      callStack: (state.callStack || []).map((frame) => ({
        id: frame.id || frame.scopeId,
        name: frame.name || frame.functionName || "anonymous",
        line: frame.source?.line || line,
        depth: frame.depth ?? null,
        recursionDepth: frame.recursionDepth ?? 1,
        recursive: Boolean(frame.recursive),
        parameters: frame.parameters || {},
        locals: selectVisibleRuntimeVariables(
          state.scopes?.[frame.scopeId]?.variables || {},
          result.language
        ),
        callerFrameId: frame.callerFrameId || null,
        enteredAtStep: frame.enteredAtStep ?? null,
        status: frame.status || "active"
      })),
      functionHistory: (state.functionHistory || []).map((frame) => ({
        id: frame.id || frame.scopeId,
        name: frame.name || frame.functionName || "anonymous",
        returnValue: frame.returnValue,
        returnStep: frame.returnStep,
        durationSteps: frame.durationSteps,
        recursionDepth: frame.recursionDepth ?? 1,
        status: frame.status || "returned"
      })),
      input: state.input ? {
        current: state.input.current,
        history: Array.isArray(state.input.history) ? state.input.history : [],
        consumed: state.input.consumed || 0,
        remaining: state.input.remaining || 0
      } : null,
      recursion: selectRecursion(state, event, result.language),
      console: Array.isArray(state.console) ? state.console : [],
      iteration: controlFlow.iteration,
      condition: controlFlow.condition,
      sql: result.language === "sql"
        ? selectSql(state, event, sqlContext)
        : null,
      status: state.status,
      error: state.errors?.at(-1) || state.lastException || null,
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
    language,
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
    graph: null,
    search: null,
    sort: null,
    dynamicProgramming: null,
    hanoi: null,
    callStack: [],
    functionHistory: [],
    input: null,
    recursion: null,
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
