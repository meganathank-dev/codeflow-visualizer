"use strict";

const {
  TRACE_SCHEMA_VERSION,
  TRACE_FORMAT,
  TRACE_FORMAT_VERSION,

  DEFAULT_MAX_EVENTS,
  DEFAULT_MAX_SERIALIZED_BYTES,

  LANGUAGES,
  SUPPORTED_LANGUAGES,

  TRACE_DOMAINS,
  TRACE_STATUSES,

  PROGRAM_EVENT_NAMES,
  QUERY_EVENT_NAMES,
  SHARED_EVENT_NAMES,
  ALL_EVENT_NAMES,

  EVENT_TYPES,

  isSupportedLanguage,
  getDomainForLanguage,
  isKnownEventType,
  isEventAllowedForDomain
} = require("./constants");

const {
  TraceRecorder,
  createTraceRecorder
} = require("./trace-recorder");

const {
  TraceValidationError,

  assertJsonCompatible,

  validateTrace,
  assertValidTrace
} = require("./validator");

const {
  TraceSerializationError,

  stableStringify,

  calculateTraceChecksum,

  serializeTrace,
  deserializeTrace
} = require("./serializer");

module.exports = {
  TRACE_SCHEMA_VERSION,
  TRACE_FORMAT,
  TRACE_FORMAT_VERSION,

  DEFAULT_MAX_EVENTS,
  DEFAULT_MAX_SERIALIZED_BYTES,

  LANGUAGES,
  SUPPORTED_LANGUAGES,

  TRACE_DOMAINS,
  TRACE_STATUSES,

  PROGRAM_EVENT_NAMES,
  QUERY_EVENT_NAMES,
  SHARED_EVENT_NAMES,
  ALL_EVENT_NAMES,

  EVENT_TYPES,

  isSupportedLanguage,
  getDomainForLanguage,
  isKnownEventType,
  isEventAllowedForDomain,

  TraceRecorder,
  createTraceRecorder,

  TraceValidationError,

  assertJsonCompatible,
  validateTrace,
  assertValidTrace,

  TraceSerializationError,

  stableStringify,
  calculateTraceChecksum,
  serializeTrace,
  deserializeTrace
};