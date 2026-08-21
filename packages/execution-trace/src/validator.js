"use strict";

const {
  TRACE_SCHEMA_VERSION,
  TRACE_DOMAINS,
  TRACE_STATUSES,

  isSupportedLanguage,
  getDomainForLanguage,
  isKnownEventType,
  isEventAllowedForDomain
} = require("./constants");

class TraceValidationError extends Error {
  constructor(errors) {
    const normalizedErrors = Array.isArray(errors)
      ? errors
      : [String(errors)];

    super(
      `Execution trace validation failed: ${normalizedErrors.join("; ")}`
    );

    this.name = "TraceValidationError";
    this.errors = normalizedErrors;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function collectJsonCompatibilityErrors(
  value,
  path,
  errors,
  ancestors = new WeakSet()
) {
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
      errors.push(
        `${path} must contain a finite JSON-compatible number`
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
    errors.push(
      `${path} contains unsupported JSON value type: ${valueType}`
    );

    return;
  }

  if (ancestors.has(value)) {
    errors.push(
      `${path} contains a circular reference`
    );

    return;
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectJsonCompatibilityErrors(
        item,
        `${path}[${index}]`,
        errors,
        ancestors
      );
    });

    ancestors.delete(value);

    return;
  }

  if (!isPlainObject(value)) {
    errors.push(
      `${path} must contain only plain JSON-compatible objects`
    );

    ancestors.delete(value);

    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    collectJsonCompatibilityErrors(
      nestedValue,
      `${path}.${key}`,
      errors,
      ancestors
    );
  });

  ancestors.delete(value);
}

function assertJsonCompatible(value, path = "value") {
  const errors = [];

  collectJsonCompatibilityErrors(
    value,
    path,
    errors
  );

  if (errors.length > 0) {
    throw new TypeError(errors.join("; "));
  }
}

function validateSourceLocation(source, path, errors) {
  if (source === null) {
    return;
  }

  if (!isPlainObject(source)) {
    errors.push(
      `${path} must be null or a source-location object`
    );

    return;
  }

  if (!Number.isInteger(source.line) || source.line < 1) {
    errors.push(
      `${path}.line must be a positive integer`
    );
  }

  if (
    source.column !== null &&
    (!Number.isInteger(source.column) || source.column < 1)
  ) {
    errors.push(
      `${path}.column must be null or a positive integer`
    );
  }

  if (
    source.endLine !== null &&
    (!Number.isInteger(source.endLine) || source.endLine < 1)
  ) {
    errors.push(
      `${path}.endLine must be null or a positive integer`
    );
  }

  if (
    source.endColumn !== null &&
    (!Number.isInteger(source.endColumn) || source.endColumn < 1)
  ) {
    errors.push(
      `${path}.endColumn must be null or a positive integer`
    );
  }

  if (
    Number.isInteger(source.line) &&
    Number.isInteger(source.endLine) &&
    source.endLine < source.line
  ) {
    errors.push(
      `${path}.endLine cannot occur before ${path}.line`
    );
  }
}

function validateEvent(
  event,
  index,
  trace,
  errors
) {
  const path = `events[${index}]`;

  if (!isPlainObject(event)) {
    errors.push(
      `${path} must be an object`
    );

    return;
  }

  if (!isNonEmptyString(event.id)) {
    errors.push(
      `${path}.id must be a non-empty string`
    );
  } else if (isNonEmptyString(trace.traceId)) {
    const expectedId = (
      `${trace.traceId}:event:${String(index).padStart(4, "0")}`
    );

    if (event.id !== expectedId) {
      errors.push(
        `${path}.id must equal "${expectedId}"`
      );
    }
  }

  if (!Number.isInteger(event.step) || event.step !== index) {
    errors.push(
      `${path}.step must equal its zero-based event position`
    );
  }

  if (!isKnownEventType(event.type)) {
    errors.push(
      `${path}.type is not a supported execution event`
    );
  } else if (
    !isEventAllowedForDomain(
      event.type,
      trace.domain
    )
  ) {
    errors.push(
      `${path}.type "${event.type}" is invalid for domain "${trace.domain}"`
    );
  }

  if (event.language !== trace.language) {
    errors.push(
      `${path}.language must match the parent trace language`
    );
  }

  if (event.domain !== trace.domain) {
    errors.push(
      `${path}.domain must match the parent trace domain`
    );
  }

  if (!isValidTimestamp(event.timestamp)) {
    errors.push(
      `${path}.timestamp must be a valid timestamp`
    );
  }

  validateSourceLocation(
    event.source,
    `${path}.source`,
    errors
  );

  if (
    event.scopeId !== null &&
    !isNonEmptyString(event.scopeId)
  ) {
    errors.push(
      `${path}.scopeId must be null or a non-empty string`
    );
  }

  if (!isPlainObject(event.payload)) {
    errors.push(
      `${path}.payload must be a plain object`
    );
  } else {
    collectJsonCompatibilityErrors(
      event.payload,
      `${path}.payload`,
      errors
    );
  }

  if (
    event.stateDelta !== null &&
    !isPlainObject(event.stateDelta)
  ) {
    errors.push(
      `${path}.stateDelta must be null or a plain object`
    );
  } else if (event.stateDelta !== null) {
    collectJsonCompatibilityErrors(
      event.stateDelta,
      `${path}.stateDelta`,
      errors
    );
  }

  if (!isPlainObject(event.metadata)) {
    errors.push(
      `${path}.metadata must be a plain object`
    );
  } else {
    collectJsonCompatibilityErrors(
      event.metadata,
      `${path}.metadata`,
      errors
    );
  }
}

function validateTrace(trace) {
  const errors = [];

  if (!isPlainObject(trace)) {
    return {
      valid: false,
      errors: [
        "Trace must be a plain object"
      ]
    };
  }

  if (trace.schemaVersion !== TRACE_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must equal "${TRACE_SCHEMA_VERSION}"`
    );
  }

  if (!isNonEmptyString(trace.traceId)) {
    errors.push(
      "traceId must be a non-empty string"
    );
  }

  if (!isSupportedLanguage(trace.language)) {
    errors.push(
      `Unsupported trace language: ${String(trace.language)}`
    );
  }

  if (
    trace.domain !== TRACE_DOMAINS.PROGRAM &&
    trace.domain !== TRACE_DOMAINS.QUERY
  ) {
    errors.push(
      `Unsupported trace domain: ${String(trace.domain)}`
    );
  }

  if (isSupportedLanguage(trace.language)) {
    const expectedDomain = getDomainForLanguage(
      trace.language
    );

    if (trace.domain !== expectedDomain) {
      errors.push(
        `Language "${trace.language}" requires domain "${expectedDomain}"`
      );
    }
  }

  if (!Object.values(TRACE_STATUSES).includes(trace.status)) {
    errors.push(
      `Unsupported trace status: ${String(trace.status)}`
    );
  }

  if (!isValidTimestamp(trace.createdAt)) {
    errors.push(
      "createdAt must be a valid timestamp"
    );
  }

  if (
    trace.completedAt !== null &&
    !isValidTimestamp(trace.completedAt)
  ) {
    errors.push(
      "completedAt must be null or a valid timestamp"
    );
  }

  if (!isPlainObject(trace.metadata)) {
    errors.push(
      "metadata must be a plain object"
    );
  } else {
    collectJsonCompatibilityErrors(
      trace.metadata,
      "metadata",
      errors
    );
  }

  if (!Array.isArray(trace.events)) {
    errors.push(
      "events must be an array"
    );

    return {
      valid: false,
      errors
    };
  }

  if (trace.eventCount !== trace.events.length) {
    errors.push(
      "eventCount must equal the number of trace events"
    );
  }

  trace.events.forEach((event, index) => {
    validateEvent(
      event,
      index,
      trace,
      errors
    );
  });

  if (
    trace.status === TRACE_STATUSES.IDLE &&
    trace.events.length > 0
  ) {
    errors.push(
      "An idle trace cannot contain execution events"
    );
  }

  if (
    trace.status === TRACE_STATUSES.COMPLETED &&
    trace.completedAt === null
  ) {
    errors.push(
      "A completed trace must include completedAt"
    );
  }

  if (
    trace.status === TRACE_STATUSES.FAILED &&
    trace.completedAt === null
  ) {
    errors.push(
      "A failed trace must include completedAt"
    );
  }

  if (
    trace.status === TRACE_STATUSES.COMPLETED &&
    trace.events.length > 0
  ) {
    const lastEvent = trace.events.at(-1);

    const expectedLastEvent = (
      trace.domain === TRACE_DOMAINS.QUERY
        ? "SQL_QUERY_END"
        : "PROGRAM_END"
    );

    if (lastEvent.type !== expectedLastEvent) {
      errors.push(
        `A completed ${trace.domain} trace must end with "${expectedLastEvent}"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function assertValidTrace(trace) {
  const validation = validateTrace(trace);

  if (!validation.valid) {
    throw new TraceValidationError(
      validation.errors
    );
  }

  return trace;
}

module.exports = {
  TraceValidationError,

  assertJsonCompatible,

  validateTrace,
  assertValidTrace
};