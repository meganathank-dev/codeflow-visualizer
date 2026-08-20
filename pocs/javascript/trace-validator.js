"use strict";

const DEFAULT_VALIDATION_LIMITS = Object.freeze({
  maxEvents: 100000,
  maxObjectDepth: 64,
});

const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([
  "0.1.0",
]);

const SUPPORTED_DOMAINS = Object.freeze([
  "PROGRAM_EXECUTION",
  "QUERY_EXECUTION",
]);

class TraceValidationError extends Error {
  constructor(message, path = "trace") {
    super(`${path}: ${message}`);
    this.name = "TraceValidationError";
    this.path = path;
  }
}

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function requirePlainObject(value, path) {
  if (!isPlainObject(value)) {
    throw new TraceValidationError(
      "must be a plain object.",
      path
    );
  }
}

function requireNonEmptyString(value, path) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new TraceValidationError(
      "must be a non-empty string.",
      path
    );
  }
}

function requirePositiveIntegerOrNull(value, path) {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 1)
  ) {
    throw new TraceValidationError(
      "must be a positive integer or null.",
      path
    );
  }
}

function assertJsonSafe(
  value,
  path,
  activeObjects,
  depth,
  maxDepth
) {
  if (depth > maxDepth) {
    throw new TraceValidationError(
      `exceeds the maximum object depth of ${maxDepth}.`,
      path
    );
  }

  if (value === null) {
    return;
  }

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "boolean"
  ) {
    return;
  }

  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new TraceValidationError(
        "must not contain NaN or Infinity.",
        path
      );
    }

    return;
  }

  if (
    valueType === "undefined" ||
    valueType === "function" ||
    valueType === "symbol" ||
    valueType === "bigint"
  ) {
    throw new TraceValidationError(
      `contains unsupported JSON value type "${valueType}".`,
      path
    );
  }

  if (valueType !== "object") {
    throw new TraceValidationError(
      `contains unsupported value type "${valueType}".`,
      path
    );
  }

  if (activeObjects.has(value)) {
    throw new TraceValidationError(
      "contains a circular reference.",
      path
    );
  }

  activeObjects.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonSafe(
        item,
        `${path}[${index}]`,
        activeObjects,
        depth + 1,
        maxDepth
      );
    });
  } else {
    requirePlainObject(value, path);

    for (const [key, childValue] of Object.entries(value)) {
      assertJsonSafe(
        childValue,
        `${path}.${key}`,
        activeObjects,
        depth + 1,
        maxDepth
      );
    }
  }

  activeObjects.delete(value);
}

function validateSourceLocation(source, path) {
  requirePlainObject(source, path);
  requireNonEmptyString(source.file, `${path}.file`);

  requirePositiveIntegerOrNull(
    source.line,
    `${path}.line`
  );

  requirePositiveIntegerOrNull(
    source.column,
    `${path}.column`
  );

  requirePositiveIntegerOrNull(
    source.endLine,
    `${path}.endLine`
  );

  requirePositiveIntegerOrNull(
    source.endColumn,
    `${path}.endColumn`
  );
}

function validateEvent(
  event,
  expectedSequence,
  trace,
  eventIds,
  maxObjectDepth
) {
  const path = `trace.events[${expectedSequence}]`;

  requirePlainObject(event, path);

  if (event.schemaVersion !== trace.schemaVersion) {
    throw new TraceValidationError(
      "schemaVersion does not match the trace.",
      `${path}.schemaVersion`
    );
  }

  if (event.traceId !== trace.traceId) {
    throw new TraceValidationError(
      "traceId does not match the trace.",
      `${path}.traceId`
    );
  }

  if (event.domain !== trace.domain) {
    throw new TraceValidationError(
      "domain does not match the trace.",
      `${path}.domain`
    );
  }

  if (event.language !== trace.language) {
    throw new TraceValidationError(
      "language does not match the trace.",
      `${path}.language`
    );
  }

  if (event.sequence !== expectedSequence) {
    throw new TraceValidationError(
      `expected sequence ${expectedSequence}, received ${event.sequence}.`,
      `${path}.sequence`
    );
  }

  requireNonEmptyString(
    event.eventId,
    `${path}.eventId`
  );

  if (eventIds.has(event.eventId)) {
    throw new TraceValidationError(
      `duplicate event ID "${event.eventId}".`,
      `${path}.eventId`
    );
  }

  eventIds.add(event.eventId);

  requireNonEmptyString(event.type, `${path}.type`);

  validateSourceLocation(
    event.source,
    `${path}.source`
  );

  requirePlainObject(
    event.payload,
    `${path}.payload`
  );

  requirePlainObject(
    event.stateDelta,
    `${path}.stateDelta`
  );

  assertJsonSafe(
    event.payload,
    `${path}.payload`,
    new Set(),
    0,
    maxObjectDepth
  );

  assertJsonSafe(
    event.stateDelta,
    `${path}.stateDelta`,
    new Set(),
    0,
    maxObjectDepth
  );
}

function validateTrace(
  trace,
  limits = DEFAULT_VALIDATION_LIMITS
) {
  const {
    maxEvents = DEFAULT_VALIDATION_LIMITS.maxEvents,
    maxObjectDepth =
      DEFAULT_VALIDATION_LIMITS.maxObjectDepth,
  } = limits;

  if (
    !Number.isInteger(maxEvents) ||
    maxEvents < 1
  ) {
    throw new RangeError(
      "maxEvents must be a positive integer."
    );
  }

  if (
    !Number.isInteger(maxObjectDepth) ||
    maxObjectDepth < 1
  ) {
    throw new RangeError(
      "maxObjectDepth must be a positive integer."
    );
  }

  requirePlainObject(trace, "trace");

  requireNonEmptyString(
    trace.schemaVersion,
    "trace.schemaVersion"
  );

  if (
    !SUPPORTED_SCHEMA_VERSIONS.includes(
      trace.schemaVersion
    )
  ) {
    throw new TraceValidationError(
      `unsupported schema version "${trace.schemaVersion}".`,
      "trace.schemaVersion"
    );
  }

  requireNonEmptyString(
    trace.traceId,
    "trace.traceId"
  );

  requireNonEmptyString(
    trace.domain,
    "trace.domain"
  );

  if (!SUPPORTED_DOMAINS.includes(trace.domain)) {
    throw new TraceValidationError(
      `unsupported trace domain "${trace.domain}".`,
      "trace.domain"
    );
  }

  requireNonEmptyString(
    trace.language,
    "trace.language"
  );

  requireNonEmptyString(
    trace.sourceFile,
    "trace.sourceFile"
  );

  if (!Number.isInteger(trace.eventCount)) {
    throw new TraceValidationError(
      "must be an integer.",
      "trace.eventCount"
    );
  }

  if (!Array.isArray(trace.events)) {
    throw new TraceValidationError(
      "must be an array.",
      "trace.events"
    );
  }

  if (trace.events.length !== trace.eventCount) {
    throw new TraceValidationError(
      `eventCount is ${trace.eventCount}, but events contains ${trace.events.length} items.`,
      "trace.eventCount"
    );
  }

  if (trace.events.length > maxEvents) {
    throw new TraceValidationError(
      `contains ${trace.events.length} events, exceeding the limit of ${maxEvents}.`,
      "trace.events"
    );
  }

  const eventIds = new Set();

  trace.events.forEach((event, index) => {
    validateEvent(
      event,
      index,
      trace,
      eventIds,
      maxObjectDepth
    );
  });

  assertJsonSafe(
    trace,
    "trace",
    new Set(),
    0,
    maxObjectDepth
  );

  return true;
}

module.exports = {
  DEFAULT_VALIDATION_LIMITS,
  SUPPORTED_DOMAINS,
  SUPPORTED_SCHEMA_VERSIONS,
  TraceValidationError,
  validateTrace,
};