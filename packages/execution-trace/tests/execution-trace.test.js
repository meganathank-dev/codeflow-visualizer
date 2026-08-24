"use strict";

const assert = require("node:assert/strict");

const {
  TRACE_SCHEMA_VERSION,

  LANGUAGES,
  SUPPORTED_LANGUAGES,

  TRACE_DOMAINS,
  TRACE_STATUSES,

  EVENT_TYPES,

  TraceRecorder,

  TraceValidationError,
  TraceSerializationError,

  getDomainForLanguage,
  isEventAllowedForDomain,

  validateTrace,
  assertValidTrace,

  calculateTraceChecksum,

  serializeTrace,
  deserializeTrace
} = require("../src");

function createProgramTrace() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT,

    traceId: "javascript-shared-package-test",

    metadata: {
      adapter: "javascript",
      fixture: "basic-program"
    }
  });

  recorder.start(
    {
      filename: "basic-program.js"
    },
    {
      source: {
        line: 1,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.VARIABLE_DECLARE,
    {
      name: "a",
      value: 10
    },
    {
      source: {
        line: 1,
        column: 1
      },

      scopeId: "global",

      stateDelta: {
        variables: {
          a: 10
        }
      }
    }
  );

  recorder.record(
    EVENT_TYPES.VARIABLE_DECLARE,
    {
      name: "b",
      value: 5
    },
    {
      source: {
        line: 2,
        column: 1
      },

      scopeId: "global"
    }
  );

  recorder.record(
    EVENT_TYPES.OPERATION_RESULT,
    {
      operator: "+",
      operands: [10, 5],
      result: 15
    },
    {
      source: {
        line: 3,
        column: 13
      }
    }
  );

  recorder.record(
    EVENT_TYPES.VARIABLE_ASSIGN,
    {
      name: "total",
      previousValue: null,
      value: 15
    },
    {
      source: {
        line: 3,
        column: 1
      },

      stateDelta: {
        variables: {
          total: 15
        }
      }
    }
  );

  recorder.record(
    EVENT_TYPES.CONDITION_EVALUATE,
    {
      expression: "total > 10",
      result: true
    },
    {
      source: {
        line: 5,
        column: 5
      }
    }
  );

  recorder.record(
    EVENT_TYPES.BRANCH_ENTER,
    {
      branch: "if"
    },
    {
      source: {
        line: 5,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.LOOP_START,
    {
      loopType: "for"
    },
    {
      source: {
        line: 6,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.LOOP_ITERATION,
    {
      iteration: 0,
      index: 0
    },
    {
      source: {
        line: 6,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.ARRAY_CREATE,
    {
      name: "numbers",
      values: [10, 20, 30]
    },
    {
      source: {
        line: 8,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.ARRAY_UPDATE,
    {
      name: "numbers",
      index: 1,
      previousValue: 20,
      value: 25
    },
    {
      source: {
        line: 9,
        column: 1
      },

      stateDelta: {
        arrays: {
          numbers: [10, 25, 30]
        }
      }
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_CALL,
    {
      name: "printTotal",
      arguments: [15]
    },
    {
      source: {
        line: 11,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_ENTER,
    {
      name: "printTotal",
      parameters: {
        value: 15
      }
    },
    {
      source: {
        line: 13,
        column: 1
      },

      scopeId: "printTotal:1"
    }
  );

  recorder.record(
    EVENT_TYPES.FUNCTION_RETURN,
    {
      name: "printTotal",
      value: 15
    },
    {
      source: {
        line: 14,
        column: 3
      },

      scopeId: "printTotal:1"
    }
  );

  recorder.record(
    EVENT_TYPES.OUTPUT,
    {
      channel: "stdout",
      text: "15"
    },
    {
      source: {
        line: 14,
        column: 3
      }
    }
  );

  recorder.finish({
    exitCode: 0
  });

  return recorder.toJSON();
}

function createSqlTrace() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.SQL,

    traceId: "sql-shared-package-test",

    metadata: {
      adapter: "sql",
      fixture: "students-query"
    }
  });

  recorder.start(
    {
      query: (
        "SELECT name FROM students WHERE marks > 80 ORDER BY marks DESC"
      )
    },
    {
      source: {
        line: 1,
        column: 1
      }
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_SCAN,
    {
      table: "students",
      scannedRows: 5
    },
    {
      source: {
        line: 1,
        column: 18
      }
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_FILTER,
    {
      condition: "marks > 80",

      inputRows: 5,

      matchingRows: 3,

      rejectedRows: 2
    },
    {
      source: {
        line: 1,
        column: 32
      }
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_PROJECT,
    {
      columns: ["name"]
    },
    {
      source: {
        line: 1,
        column: 8
      }
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_SORT,
    {
      column: "marks",
      direction: "DESC"
    },
    {
      source: {
        line: 1,
        column: 47
      }
    }
  );

  recorder.record(
    EVENT_TYPES.SQL_RESULT,
    {
      rows: [
        {
          name: "Divya"
        },
        {
          name: "Nila"
        },
        {
          name: "Kavin"
        }
      ]
    }
  );

  recorder.finish({
    rowCount: 3
  });

  return recorder.toJSON();
}

function testSupportedLanguages() {
  assert.deepEqual(
    SUPPORTED_LANGUAGES,
    [
      "javascript",
      "python",
      "java",
      "sql"
    ]
  );

  assert.equal(
    getDomainForLanguage(LANGUAGES.JAVASCRIPT),
    TRACE_DOMAINS.PROGRAM
  );

  assert.equal(
    getDomainForLanguage(LANGUAGES.PYTHON),
    TRACE_DOMAINS.PROGRAM
  );

  assert.equal(
    getDomainForLanguage(LANGUAGES.JAVA),
    TRACE_DOMAINS.PROGRAM
  );

  assert.equal(
    getDomainForLanguage(LANGUAGES.SQL),
    TRACE_DOMAINS.QUERY
  );

  assert.throws(
    () => getDomainForLanguage("c"),
    /Unsupported execution language/
  );
}

function testProgramTrace(trace) {
  assert.equal(
    trace.schemaVersion,
    TRACE_SCHEMA_VERSION
  );

  assert.equal(
    trace.language,
    LANGUAGES.JAVASCRIPT
  );

  assert.equal(
    trace.domain,
    TRACE_DOMAINS.PROGRAM
  );

  assert.equal(
    trace.status,
    TRACE_STATUSES.COMPLETED
  );

  assert.equal(
    trace.eventCount,
    16
  );

  assert.equal(
    trace.events[0].type,
    EVENT_TYPES.PROGRAM_START
  );

  assert.equal(
    trace.events.at(-1).type,
    EVENT_TYPES.PROGRAM_END
  );

  assert.equal(
    trace.events[0].id,
    "javascript-shared-package-test:event:0000"
  );

  assert.equal(
    trace.events[10].id,
    "javascript-shared-package-test:event:0010"
  );

  assert.equal(
    trace.events[1].source.line,
    1
  );

  assert.equal(
    trace.events[1].scopeId,
    "global"
  );

  assert.deepEqual(
    trace.events[1].stateDelta,
    {
      variables: {
        a: 10
      }
    }
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.CONDITION_EVALUATE
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.LOOP_ITERATION
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.FUNCTION_ENTER
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.ARRAY_UPDATE
    ),
    true
  );

  assert.equal(
    validateTrace(trace).valid,
    true
  );
}

function testSqlTrace(trace) {
  assert.equal(
    trace.language,
    LANGUAGES.SQL
  );

  assert.equal(
    trace.domain,
    TRACE_DOMAINS.QUERY
  );

  assert.equal(
    trace.status,
    TRACE_STATUSES.COMPLETED
  );

  assert.equal(
    trace.eventCount,
    7
  );

  assert.equal(
    trace.events[0].type,
    EVENT_TYPES.SQL_QUERY_START
  );

  assert.equal(
    trace.events.at(-1).type,
    EVENT_TYPES.SQL_QUERY_END
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.SQL_FILTER
    ),
    true
  );

  assert.equal(
    trace.events.some(
      (event) => event.type === EVENT_TYPES.SQL_PROJECT
    ),
    true
  );

  const resultEvent = trace.events.find(
    (event) => event.type === EVENT_TYPES.SQL_RESULT
  );

  assert.equal(
    resultEvent.payload.rows.length,
    3
  );

  assert.equal(
    validateTrace(trace).valid,
    true
  );
}

function testDomainRestrictions() {
  assert.equal(
    isEventAllowedForDomain(EVENT_TYPES.HASHMAP_SET, TRACE_DOMAINS.PROGRAM),
    true
  );

  assert.equal(
    isEventAllowedForDomain(EVENT_TYPES.HASHMAP_SET, TRACE_DOMAINS.QUERY),
    false
  );

  assert.equal(
    isEventAllowedForDomain(EVENT_TYPES.TREE_INSERT, TRACE_DOMAINS.PROGRAM),
    true
  );

  assert.equal(
    isEventAllowedForDomain(EVENT_TYPES.TREE_INSERT, TRACE_DOMAINS.QUERY),
    false
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.LINKED_LIST_CREATE,
      TRACE_DOMAINS.PROGRAM
    ),
    true
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.LINKED_LIST_CREATE,
      TRACE_DOMAINS.QUERY
    ),
    false
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.ARRAY_UPDATE,
      TRACE_DOMAINS.PROGRAM
    ),
    true
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.ARRAY_UPDATE,
      TRACE_DOMAINS.QUERY
    ),
    false
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.SQL_FILTER,
      TRACE_DOMAINS.QUERY
    ),
    true
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.SQL_FILTER,
      TRACE_DOMAINS.PROGRAM
    ),
    false
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.ERROR,
      TRACE_DOMAINS.PROGRAM
    ),
    true
  );

  assert.equal(
    isEventAllowedForDomain(
      EVENT_TYPES.ERROR,
      TRACE_DOMAINS.QUERY
    ),
    true
  );

  const sqlRecorder = new TraceRecorder({
    language: LANGUAGES.SQL
  });

  assert.throws(
    () => {
      sqlRecorder.record(
        EVENT_TYPES.ARRAY_CREATE,
        {
          name: "numbers",
          values: [1, 2, 3]
        }
      );
    },
    /invalid for domain/
  );

  const programRecorder = new TraceRecorder({
    language: LANGUAGES.PYTHON
  });

  assert.throws(
    () => {
      programRecorder.record(
        EVENT_TYPES.SQL_FILTER,
        {
          condition: "marks > 80"
        }
      );
    },
    /invalid for domain/
  );
}

function testEventLimit() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVA,

    maxEvents: 2
  });

  recorder.start();

  recorder.record(
    EVENT_TYPES.VARIABLE_DECLARE,
    {
      name: "count",
      value: 1
    }
  );

  assert.throws(
    () => {
      recorder.record(
        EVENT_TYPES.VARIABLE_UPDATE,
        {
          name: "count",
          value: 2
        }
      );
    },
    /maximum of 2 events/
  );
}

function testFailureTrace() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.PYTHON,

    traceId: "python-error-test"
  });

  recorder.start();

  recorder.fail(
    {
      name: "ZeroDivisionError",

      message: "division by zero"
    },
    {
      source: {
        line: 4,
        column: 5
      }
    }
  );

  const trace = recorder.toJSON();

  assert.equal(
    trace.status,
    TRACE_STATUSES.FAILED
  );

  assert.equal(
    trace.events.at(-1).type,
    EVENT_TYPES.ERROR
  );

  assert.notEqual(
    trace.completedAt,
    null
  );

  assert.throws(
    () => {
      recorder.record(
        EVENT_TYPES.OUTPUT,
        {
          text: "unreachable"
        }
      );
    },
    /Cannot append events to a failed trace/
  );
}

function testTraceValidation(trace) {
  const invalidStepTrace = structuredClone(
    trace
  );

  invalidStepTrace.events[1].step = 99;

  const invalidStepResult = validateTrace(
    invalidStepTrace
  );

  assert.equal(
    invalidStepResult.valid,
    false
  );

  assert.equal(
    invalidStepResult.errors.some(
      (message) => message.includes("zero-based event position")
    ),
    true
  );

  assert.throws(
    () => assertValidTrace(invalidStepTrace),
    TraceValidationError
  );

  const invalidLanguageTrace = structuredClone(
    trace
  );

  invalidLanguageTrace.language = "c";

  assert.equal(
    validateTrace(invalidLanguageTrace).valid,
    false
  );

  const invalidDomainTrace = structuredClone(
    trace
  );

  invalidDomainTrace.domain = TRACE_DOMAINS.QUERY;

  assert.equal(
    validateTrace(invalidDomainTrace).valid,
    false
  );

  const invalidCountTrace = structuredClone(
    trace
  );

  invalidCountTrace.eventCount = 500;

  assert.equal(
    validateTrace(invalidCountTrace).valid,
    false
  );
}

function testJsonCompatibility() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT
  });

  assert.throws(
    () => {
      recorder.record(
        EVENT_TYPES.VARIABLE_DECLARE,
        {
          value: undefined
        }
      );
    },
    /unsupported JSON value type/
  );

  assert.throws(
    () => {
      recorder.record(
        EVENT_TYPES.VARIABLE_DECLARE,
        {
          value: Number.POSITIVE_INFINITY
        }
      );
    },
    /finite JSON-compatible number/
  );

  const circularPayload = {};

  circularPayload.self = circularPayload;

  assert.throws(
    () => {
      recorder.record(
        EVENT_TYPES.VARIABLE_DECLARE,
        circularPayload
      );
    },
    /circular reference/
  );
}

function testSerialization(trace) {
  const serialized = serializeTrace(
    trace
  );

  const restored = deserializeTrace(
    serialized
  );

  assert.deepEqual(
    restored,
    trace
  );

  const prettySerialized = serializeTrace(
    trace,
    {
      pretty: true
    }
  );

  assert.equal(
    prettySerialized.includes("\n"),
    true
  );

  assert.deepEqual(
    deserializeTrace(prettySerialized),
    trace
  );

  const checksum = calculateTraceChecksum(
    trace
  );

  assert.match(
    checksum,
    /^[a-f0-9]{64}$/
  );

  const tamperedEnvelope = JSON.parse(
    serialized
  );

  tamperedEnvelope.trace.events[1].payload.value = 999;

  assert.throws(
    () => {
      deserializeTrace(
        JSON.stringify(tamperedEnvelope)
      );
    },
    /Trace checksum mismatch/
  );

  assert.throws(
    () => {
      deserializeTrace(
        "{invalid json"
      );
    },
    TraceSerializationError
  );

  assert.throws(
    () => {
      serializeTrace(
        trace,
        {
          maxBytes: 32
        }
      );
    },
    /exceeds maximum size/
  );
}

function testRecorderIsolation() {
  const recorder = new TraceRecorder({
    language: LANGUAGES.JAVASCRIPT
  });

  recorder.start();

  const payload = {
    name: "numbers",
    values: [1, 2, 3]
  };

  recorder.record(
    EVENT_TYPES.ARRAY_CREATE,
    payload
  );

  payload.values.push(999);

  assert.deepEqual(
    recorder.events[1].payload.values,
    [1, 2, 3]
  );

  const exposedEvents = recorder.events;

  exposedEvents[1].payload.values.push(500);

  assert.deepEqual(
    recorder.events[1].payload.values,
    [1, 2, 3]
  );
}

function runTests() {
  testSupportedLanguages();

  const programTrace = createProgramTrace();

  testProgramTrace(
    programTrace
  );

  const sqlTrace = createSqlTrace();

  testSqlTrace(
    sqlTrace
  );

  testDomainRestrictions();

  testEventLimit();

  testFailureTrace();

  testTraceValidation(
    programTrace
  );

  testJsonCompatibility();

  testSerialization(
    programTrace
  );

  testSerialization(
    sqlTrace
  );

  testRecorderIsolation();

  console.log(
    "Execution trace package tests passed."
  );

  console.log(
    `Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}`
  );

  console.log(
    `Program trace events: ${programTrace.eventCount}`
  );

  console.log(
    `SQL trace events: ${sqlTrace.eventCount}`
  );

  console.log(
    "Domain validation: passed"
  );

  console.log(
    "Checksum integrity: passed"
  );

  console.log(
    "Trace serialization: passed"
  );
}

try {
  runTests();
} catch (error) {
  console.error(
    "Execution trace package tests failed."
  );

  console.error(
    error
  );

  process.exitCode = 1;
}
