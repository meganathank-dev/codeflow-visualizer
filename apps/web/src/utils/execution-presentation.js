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
  const eventArray = event.payload?.arrayName || event.payload?.name;

  const visibleNames = Object.keys(arrays).filter(
    (name) => !stackNames.has(name) && !queueNames.has(name)
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

  return variables;
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
      callStack: (state.callStack || []).map((frame) => ({
        name: frame.name || frame.functionName || "anonymous",
        line: frame.source?.line || line
      })),
      console: Array.isArray(state.console) ? state.console : [],
      iteration: controlFlow.iteration,
      condition: controlFlow.condition,
      sql: null,
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
  return {
    id: `${language}-idle`,
    line: null,
    event: "PROGRAM_START",
    title: "Run your code to begin",
    description: "Execute the current editor contents to create a verified execution trace.",
    variables: {},
    array: null,
    stack: null,
    callStack: [],
    console: [],
    iteration: null,
    condition: null,
    sql: null,
    status: "idle",
    error: null,
    payload: {}
  };
}
