"use strict";

const { randomUUID } = require("node:crypto");

const {
  TRACE_SCHEMA_VERSION,
  DEFAULT_MAX_EVENTS,
  TRACE_DOMAINS,
  TRACE_STATUSES,
  EVENT_TYPES,
  isSupportedLanguage,
  getDomainForLanguage,
  isKnownEventType,
  isEventAllowedForDomain
} = require("./constants");

const {
  assertJsonCompatible,
  assertValidTrace
} = require("./validator");

function cloneJsonValue(value) {
  return structuredClone(value);
}

function normalizeTimestamp(value) {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      "Trace timestamp must be a valid date"
    );
  }

  return date.toISOString();
}

function normalizeSourceLocation(source) {
  if (source === null || source === undefined) {
    return null;
  }

  if (
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    throw new TypeError(
      "Source location must be an object"
    );
  }

  const normalized = {
    line: source.line,
    column: source.column ?? null,
    endLine: source.endLine ?? null,
    endColumn: source.endColumn ?? null
  };

  if (
    !Number.isInteger(normalized.line) ||
    normalized.line < 1
  ) {
    throw new TypeError(
      "Source line must be a positive integer"
    );
  }

  const optionalFields = [
    "column",
    "endLine",
    "endColumn"
  ];

  for (const field of optionalFields) {
    const value = normalized[field];

    if (
      value !== null &&
      (
        !Number.isInteger(value) ||
        value < 1
      )
    ) {
      throw new TypeError(
        `Source ${field} must be null or a positive integer`
      );
    }
  }

  if (
    normalized.endLine !== null &&
    normalized.endLine < normalized.line
  ) {
    throw new TypeError(
      "Source endLine cannot occur before source line"
    );
  }

  return normalized;
}

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `${label} must be an object`
    );
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw new TypeError(
      `${label} must be a plain object`
    );
  }

  assertJsonCompatible(
    value,
    label
  );
}

class TraceRecorder {
  constructor(options = {}) {
    const {
      language,
      traceId = randomUUID(),
      metadata = {},
      maxEvents = DEFAULT_MAX_EVENTS,
      clock = () => Date.now()
    } = options;

    if (!isSupportedLanguage(language)) {
      throw new TypeError(
        `Unsupported execution language: ${String(language)}`
      );
    }

    if (
      typeof traceId !== "string" ||
      traceId.trim().length === 0
    ) {
      throw new TypeError(
        "traceId must be a non-empty string"
      );
    }

    if (
      !Number.isInteger(maxEvents) ||
      maxEvents < 1
    ) {
      throw new TypeError(
        "maxEvents must be a positive integer"
      );
    }

    if (typeof clock !== "function") {
      throw new TypeError(
        "clock must be a function"
      );
    }

    assertPlainObject(
      metadata,
      "Trace metadata"
    );

    this.traceId = traceId;
    this.language = language;
    this.domain = getDomainForLanguage(language);
    this.maxEvents = maxEvents;
    this.clock = clock;

    this.createdAt = normalizeTimestamp(
      this.clock()
    );

    this.completedAt = null;
    this.status = TRACE_STATUSES.IDLE;

    this.metadata = cloneJsonValue(
      metadata
    );

    this._events = [];
  }

  get eventCount() {
    return this._events.length;
  }

  get events() {
    return cloneJsonValue(
      this._events
    );
  }

  start(payload = {}, options = {}) {
    if (this._events.length > 0) {
      throw new Error(
        "Execution trace has already started"
      );
    }

    const eventType = this.domain === TRACE_DOMAINS.QUERY
      ? EVENT_TYPES.SQL_QUERY_START
      : EVENT_TYPES.PROGRAM_START;

    return this.record(
      eventType,
      payload,
      options
    );
  }

  finish(payload = {}, options = {}) {
    const eventType = this.domain === TRACE_DOMAINS.QUERY
      ? EVENT_TYPES.SQL_QUERY_END
      : EVENT_TYPES.PROGRAM_END;

    return this.record(
      eventType,
      payload,
      options
    );
  }

  fail(payload = {}, options = {}) {
    return this.record(
      EVENT_TYPES.ERROR,
      payload,
      options
    );
  }

  record(eventType, payload = {}, options = {}) {
    if (
      this.status === TRACE_STATUSES.COMPLETED ||
      this.status === TRACE_STATUSES.FAILED
    ) {
      throw new Error(
        `Cannot append events to a ${this.status} trace`
      );
    }

    if (!isKnownEventType(eventType)) {
      throw new TypeError(
        `Unsupported execution event: ${String(eventType)}`
      );
    }

    if (
      !isEventAllowedForDomain(
        eventType,
        this.domain
      )
    ) {
      throw new TypeError(
        `Event "${eventType}" is invalid for domain "${this.domain}"`
      );
    }

    if (this._events.length >= this.maxEvents) {
      throw new RangeError(
        `Execution trace exceeded the maximum of ${this.maxEvents} events`
      );
    }

    assertPlainObject(
      payload,
      "Event payload"
    );

    const {
      source = null,
      scopeId = null,
      stateDelta = null,
      metadata = {}
    } = options;

    if (
      scopeId !== null &&
      (
        typeof scopeId !== "string" ||
        scopeId.trim().length === 0
      )
    ) {
      throw new TypeError(
        "scopeId must be null or a non-empty string"
      );
    }

    if (stateDelta !== null) {
      assertPlainObject(
        stateDelta,
        "Event stateDelta"
      );
    }

    assertPlainObject(
      metadata,
      "Event metadata"
    );

    const step = this._events.length;

    const timestamp = normalizeTimestamp(
      this.clock()
    );

    const event = {
      id: `${this.traceId}:event:${String(step).padStart(4, "0")}`,

      step,

      type: eventType,

      language: this.language,

      domain: this.domain,

      timestamp,

      source: normalizeSourceLocation(
        source
      ),

      scopeId,

      payload: cloneJsonValue(
        payload
      ),

      stateDelta: stateDelta === null
        ? null
        : cloneJsonValue(stateDelta),

      metadata: cloneJsonValue(
        metadata
      )
    };

    this._events.push(event);

    if (
      eventType === EVENT_TYPES.PROGRAM_END ||
      eventType === EVENT_TYPES.SQL_QUERY_END
    ) {
      this.status = TRACE_STATUSES.COMPLETED;
      this.completedAt = timestamp;
    } else if (eventType === EVENT_TYPES.ERROR) {
      this.status = TRACE_STATUSES.FAILED;
      this.completedAt = timestamp;
    } else {
      this.status = TRACE_STATUSES.RUNNING;
    }

    return cloneJsonValue(
      event
    );
  }

  toJSON() {
    const trace = {
      schemaVersion: TRACE_SCHEMA_VERSION,

      traceId: this.traceId,

      language: this.language,

      domain: this.domain,

      status: this.status,

      createdAt: this.createdAt,

      completedAt: this.completedAt,

      eventCount: this._events.length,

      metadata: cloneJsonValue(
        this.metadata
      ),

      events: cloneJsonValue(
        this._events
      )
    };

    assertValidTrace(
      trace
    );

    return trace;
  }
}

function createTraceRecorder(options) {
  return new TraceRecorder(
    options
  );
}

module.exports = {
  TraceRecorder,
  createTraceRecorder
};