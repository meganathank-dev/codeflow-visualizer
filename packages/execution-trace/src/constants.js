"use strict";

const TRACE_SCHEMA_VERSION = "1.0.0";

const TRACE_FORMAT = "codeflow.execution-trace";

const TRACE_FORMAT_VERSION = 1;

const DEFAULT_MAX_EVENTS = 10_000;

const DEFAULT_MAX_SERIALIZED_BYTES = 5 * 1024 * 1024;

const LANGUAGES = Object.freeze({
  JAVASCRIPT: "javascript",
  PYTHON: "python",
  JAVA: "java",
  SQL: "sql"
});

const SUPPORTED_LANGUAGES = Object.freeze(Object.values(LANGUAGES));

const TRACE_DOMAINS = Object.freeze({
  PROGRAM: "program",
  QUERY: "query"
});

const TRACE_STATUSES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
});

const PROGRAM_EVENT_NAMES = Object.freeze([
  "PROGRAM_START",
  "PROGRAM_END",

  "STATEMENT_EXECUTE",

  "VARIABLE_DECLARE",
  "VARIABLE_READ",
  "VARIABLE_ASSIGN",
  "VARIABLE_UPDATE",

  "EXPRESSION_START",
  "EXPRESSION_RESULT",

  "OPERATION_START",
  "OPERATION_RESULT",

  "CONDITION_EVALUATE",
  "BRANCH_ENTER",
  "BRANCH_EXIT",

  "LOOP_START",
  "LOOP_CONDITION",
  "LOOP_ITERATION",
  "LOOP_END",

  "FUNCTION_CALL",
  "FUNCTION_ENTER",
  "FUNCTION_RETURN",

  "SCOPE_ENTER",
  "SCOPE_EXIT",

  "ARRAY_CREATE",
  "ARRAY_ACCESS",
  "ARRAY_UPDATE",
  "ARRAY_INSERT",
  "ARRAY_DELETE",
  "ARRAY_SWAP",

  "STACK_CREATE",
  "STACK_PUSH",
  "STACK_POP",
  "STACK_PEEK",

  "QUEUE_CREATE",
  "QUEUE_ENQUEUE",
  "QUEUE_DEQUEUE",
  "QUEUE_PEEK",

  "HASHMAP_CREATE",
  "HASHMAP_SET",
  "HASHMAP_GET",
  "HASHMAP_DELETE",
  "HASHMAP_HAS",

  "TREE_CREATE",
  "TREE_INSERT",
  "TREE_SEARCH",
  "TREE_TRAVERSE",

  "HEAP_CREATE",
  "HEAP_INSERT",
  "HEAP_SWAP",
  "HEAP_PEEK",
  "HEAP_EXTRACT",

  "GRAPH_CREATE",
  "GRAPH_NODE_ADD",
  "GRAPH_EDGE_ADD",
  "GRAPH_EDGE_TRAVERSE",
  "GRAPH_VISIT",
  "GRAPH_TRAVERSE",

  "SEARCH_START",
  "SEARCH_COMPARE",
  "SEARCH_RANGE_UPDATE",
  "SEARCH_FOUND",
  "SEARCH_NOT_FOUND",
  "SEARCH_END",

  "SORT_START",
  "SORT_COMPARE",
  "SORT_SWAP",
  "SORT_WRITE",
  "SORT_SPLIT",
  "SORT_MERGE",
  "SORT_PIVOT",
  "SORT_PARTITION",
  "SORT_PASS",
  "SORT_MARK_SORTED",
  "SORT_END",

  "LINKED_LIST_CREATE",
  "NODE_CREATE",
  "NODE_INSERT",
  "NODE_DELETE",
  "NODE_VISIT",

  "REFERENCE_UPDATE",

  "OBJECT_CREATE",
  "PROPERTY_READ",
  "PROPERTY_WRITE",

  "INPUT",

  "EXCEPTION_THROW",
  "EXCEPTION_CATCH"
]);

const QUERY_EVENT_NAMES = Object.freeze([
  "SQL_QUERY_START",
  "SQL_QUERY_END",

  "SQL_SCAN",
  "SQL_FILTER",
  "SQL_PROJECT",

  "SQL_JOIN",
  "SQL_GROUP",
  "SQL_AGGREGATE",

  "SQL_SORT",
  "SQL_DISTINCT",
  "SQL_LIMIT",

  "SQL_RESULT"
]);

const SHARED_EVENT_NAMES = Object.freeze([
  "OUTPUT",
  "ERROR"
]);

const ALL_EVENT_NAMES = Object.freeze([
  ...PROGRAM_EVENT_NAMES,
  ...QUERY_EVENT_NAMES,
  ...SHARED_EVENT_NAMES
]);

const EVENT_TYPES = Object.freeze(
  Object.fromEntries(
    ALL_EVENT_NAMES.map((eventName) => [
      eventName,
      eventName
    ])
  )
);

const PROGRAM_EVENT_SET = new Set(PROGRAM_EVENT_NAMES);

const QUERY_EVENT_SET = new Set(QUERY_EVENT_NAMES);

const SHARED_EVENT_SET = new Set(SHARED_EVENT_NAMES);

function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

function getDomainForLanguage(language) {
  if (!isSupportedLanguage(language)) {
    throw new TypeError(
      `Unsupported execution language: ${String(language)}`
    );
  }

  if (language === LANGUAGES.SQL) {
    return TRACE_DOMAINS.QUERY;
  }

  return TRACE_DOMAINS.PROGRAM;
}

function isKnownEventType(eventType) {
  return Object.hasOwn(EVENT_TYPES, eventType);
}

function isEventAllowedForDomain(eventType, domain) {
  if (SHARED_EVENT_SET.has(eventType)) {
    return true;
  }

  if (domain === TRACE_DOMAINS.PROGRAM) {
    return PROGRAM_EVENT_SET.has(eventType);
  }

  if (domain === TRACE_DOMAINS.QUERY) {
    return QUERY_EVENT_SET.has(eventType);
  }

  return false;
}

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
  isEventAllowedForDomain
};
