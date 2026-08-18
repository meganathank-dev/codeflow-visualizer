"use strict";

const TRACE_SCHEMA_VERSION = "0.1.0";

const TRACE_DOMAINS = Object.freeze({
  PROGRAM_EXECUTION: "PROGRAM_EXECUTION",
  QUERY_EXECUTION: "QUERY_EXECUTION",
});

const EVENT_TYPES = Object.freeze({
  PROGRAM_START: "PROGRAM_START",
  PROGRAM_END: "PROGRAM_END",

  STATEMENT_EXECUTE: "STATEMENT_EXECUTE",

  VARIABLE_DECLARE: "VARIABLE_DECLARE",
  VARIABLE_READ: "VARIABLE_READ",
  VARIABLE_UPDATE: "VARIABLE_UPDATE",

  EXPRESSION_START: "EXPRESSION_START",
  EXPRESSION_RESULT: "EXPRESSION_RESULT",

  CONDITION_EVALUATE: "CONDITION_EVALUATE",
  BRANCH_ENTER: "BRANCH_ENTER",

  LOOP_START: "LOOP_START",
  LOOP_CONDITION: "LOOP_CONDITION",
  LOOP_ITERATION: "LOOP_ITERATION",
  LOOP_END: "LOOP_END",

  FUNCTION_CALL: "FUNCTION_CALL",
  FUNCTION_ENTER: "FUNCTION_ENTER",
  FUNCTION_RETURN: "FUNCTION_RETURN",

  ARRAY_CREATE: "ARRAY_CREATE",
  ARRAY_ACCESS: "ARRAY_ACCESS",
  ARRAY_UPDATE: "ARRAY_UPDATE",

  OUTPUT: "OUTPUT",
  ERROR: "ERROR",
});

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

function validatePositiveIntegerOrNull(value, fieldName) {
  if (value !== null && (!Number.isInteger(value) || value < 1)) {
    throw new TypeError(
      `${fieldName} must be a positive integer or null.`
    );
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return value;
}

function cloneAndFreeze(value) {
  return deepFreeze(structuredClone(value));
}

class TraceRecorder {
  constructor({
    traceId,
    language,
    sourceFile,
    domain = TRACE_DOMAINS.PROGRAM_EXECUTION,
  }) {
    assertNonEmptyString(traceId, "traceId");
    assertNonEmptyString(language, "language");
    assertNonEmptyString(sourceFile, "sourceFile");

    if (!Object.values(TRACE_DOMAINS).includes(domain)) {
      throw new TypeError(`Unsupported trace domain: ${domain}`);
    }

    this.traceId = traceId;
    this.language = language;
    this.sourceFile = sourceFile;
    this.domain = domain;
    this.events = [];
    this.closed = false;
  }

  start({ line = null, column = null, payload = {} } = {}) {
    return this.record(EVENT_TYPES.PROGRAM_START, {
      line,
      column,
      payload,
    });
  }

  record(
    type,
    {
      line = null,
      column = null,
      endLine = null,
      endColumn = null,
      payload = {},
      stateDelta = {},
    } = {}
  ) {
    if (this.closed) {
      throw new Error("Cannot record an event after PROGRAM_END.");
    }

    assertNonEmptyString(type, "event type");

    validatePositiveIntegerOrNull(line, "line");
    validatePositiveIntegerOrNull(column, "column");
    validatePositiveIntegerOrNull(endLine, "endLine");
    validatePositiveIntegerOrNull(endColumn, "endColumn");

    const sequence = this.events.length;

    const event = cloneAndFreeze({
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: this.traceId,
      eventId: `${this.traceId}:event:${String(sequence).padStart(4, "0")}`,
      sequence,
      domain: this.domain,
      language: this.language,
      type,
      source: {
        file: this.sourceFile,
        line,
        column,
        endLine,
        endColumn,
      },
      payload,
      stateDelta,
    });

    this.events.push(event);

    if (type === EVENT_TYPES.PROGRAM_END) {
      this.closed = true;
    }

    return event;
  }

  end({ line = null, column = null, payload = {} } = {}) {
    return this.record(EVENT_TYPES.PROGRAM_END, {
      line,
      column,
      payload,
    });
  }

  getTrace() {
    return cloneAndFreeze({
      schemaVersion: TRACE_SCHEMA_VERSION,
      traceId: this.traceId,
      domain: this.domain,
      language: this.language,
      sourceFile: this.sourceFile,
      eventCount: this.events.length,
      events: this.events,
    });
  }
}

module.exports = {
  EVENT_TYPES,
  TRACE_DOMAINS,
  TRACE_SCHEMA_VERSION,
  TraceRecorder,
};

/*
 * This smoke test runs only when this file is executed directly.
 * It does not run when another file imports TraceRecorder.
 */
if (require.main === module) {
  const recorder = new TraceRecorder({
    traceId: "javascript-recorder-smoke-test",
    language: "javascript",
    sourceFile: "smoke-test.js",
  });

  recorder.start({
    line: 1,
    payload: {
      message: "Controlled JavaScript trace started.",
    },
  });

  recorder.record(EVENT_TYPES.VARIABLE_DECLARE, {
    line: 1,
    column: 1,
    payload: {
      name: "value",
      value: 10,
      valueType: "number",
    },
    stateDelta: {
      variables: {
        set: [
          {
            name: "value",
            value: 10,
            valueType: "number",
          },
        ],
      },
    },
  });

  recorder.end({
    line: 2,
    payload: {
      status: "completed",
    },
  });

  const trace = recorder.getTrace();

  console.log(`Trace events: ${trace.eventCount}`);
  console.log(trace.events.map((event) => event.type).join(" -> "));
  console.log(`First event ID: ${trace.events[0].eventId}`);
}