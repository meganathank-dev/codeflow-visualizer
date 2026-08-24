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
