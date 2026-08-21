import assert from "node:assert/strict";

import {
  createExecutionPresentation,
  createIdleExecutionStep
} from "../src/utils/execution-presentation.js";

function createState(step, overrides = {}) {
  return {
    step,
    status: "running",
    source: { line: step + 1 },
    variables: {},
    arrays: {},
    stacks: {},
    queues: {},
    callStack: [],
    console: [],
    errors: [],
    controlFlow: {
      lastCondition: null,
      loops: {}
    },
    query: {
      text: null,
      tables: {},
      currentRows: [],
      resultRows: [],
      columns: [],
      operations: [],
      scannedRowCount: 0,
      matchingRowCount: 0,
      rejectedRowCount: 0
    },
    ...overrides
  };
}

function createResult(language = "javascript") {
  const events = [
    {
      id: "event-0",
      step: 0,
      type: "PROGRAM_START",
      source: { line: 1 },
      payload: {}
    },
    {
      id: "event-1",
      step: 1,
      type: "ARRAY_CREATE",
      source: { line: 1 },
      payload: { name: "numbers", values: [4, 8, 12] }
    },
    {
      id: "event-2",
      step: 2,
      type: "ARRAY_ACCESS",
      source: { line: 5 },
      payload: { name: "numbers", arrayName: "numbers", index: 1, value: 8 }
    },
    {
      id: "event-3",
      step: 3,
      type: "STACK_PUSH",
      source: { line: 6 },
      payload: { name: "stack", value: 8 }
    },
    {
      id: "event-4",
      step: 4,
      type: "FUNCTION_ENTER",
      source: { line: 8 },
      payload: { name: "double" }
    },
    {
      id: "event-5",
      step: 5,
      type: "LOOP_CONDITION",
      source: { line: 4 },
      payload: { loopId: "line:4", expression: "i < numbers.length", result: true }
    },
    {
      id: "event-6",
      step: 6,
      type: "OUTPUT",
      source: { line: 10 },
      payload: { text: "Total: 24" }
    }
  ];

  const states = [
    createState(0),
    createState(1, {
      variables: { numbers: [4, 8, 12] },
      arrays: { numbers: [4, 8, 12] }
    }),
    createState(2, {
      variables: { numbers: [4, 8, 12] },
      arrays: { numbers: [4, 8, 12] }
    }),
    createState(3, {
      variables: { numbers: [4, 8, 12], stack: [8] },
      arrays: { numbers: [4, 8, 12], stack: [8] },
      stacks: { stack: [8] }
    }),
    createState(4, {
      variables: { numbers: [4, 8, 12], stack: [8] },
      arrays: { numbers: [4, 8, 12], stack: [8] },
      stacks: { stack: [8] },
      callStack: [{ name: "double", source: { line: 8 } }]
    }),
    createState(5, {
      arrays: { numbers: [4, 8, 12] },
      controlFlow: {
        lastCondition: null,
        loops: {
          "line:4": {
            id: "line:4",
            active: true,
            iteration: 2,
            condition: { expression: "i < numbers.length", result: true }
          }
        }
      }
    }),
    createState(6, {
      status: "completed",
      variables: { total: 24 },
      console: [{ channel: "stdout", text: "Total: 24" }]
    })
  ];

  return {
    status: "ok",
    language,
    executionStatus: "completed",
    trace: {
      traceId: "presentation-test",
      status: "completed",
      events
    },
    states,
    summary: { eventCount: events.length }
  };
}

function createSqlResult() {
  const allRows = [
    { id: 1, name: "Arun", marks: 72 },
    { id: 2, name: "Divya", marks: 92 },
    { id: 3, name: "Nila", marks: 88 },
    { id: 4, name: "Kavin", marks: 84 },
    { id: 5, name: "Manoj", marks: 65 }
  ];
  const matchingRows = allRows.filter((row) => row.marks > 80);
  const projectedRows = matchingRows.map(({ name, marks }) => ({ name, marks }));
  const queryText = "SELECT name, marks FROM students WHERE marks > 80 ORDER BY marks DESC LIMIT 3";

  const event = (step, type, line, payload = {}) => ({
    id: `sql-event-${step}`,
    step,
    type,
    source: { line },
    payload
  });

  const queryState = (step, overrides = {}) => createState(step, {
    source: { line: overrides.line || 1 },
    query: {
      text: queryText,
      tables: { students: allRows },
      currentRows: overrides.currentRows || [],
      resultRows: overrides.resultRows || [],
      columns: overrides.columns || [],
      operations: [],
      scannedRowCount: overrides.scannedRowCount ?? 0,
      matchingRowCount: overrides.matchingRowCount ?? 0,
      rejectedRowCount: overrides.rejectedRowCount ?? 0
    },
    console: overrides.console || [],
    status: overrides.status || "running"
  });

  const events = [
    event(0, "SQL_QUERY_START", 1, { query: queryText }),
    event(1, "SQL_SCAN", 2, {
      table: "students",
      columns: ["id", "name", "marks"],
      rows: allRows,
      scannedRows: 5,
      operation: "Scan students"
    }),
    event(2, "SQL_FILTER", 3, {
      table: "students",
      condition: "marks > 80",
      row: allRows[1],
      rowIndex: 1,
      result: true,
      rows: [allRows[1]],
      displayRows: allRows,
      rejectedIds: [1],
      matchingRows: 1,
      rejectedRows: 1,
      columns: ["id", "name", "marks"],
      operation: "WHERE marks > 80"
    }),
    event(3, "SQL_PROJECT", 1, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      operation: "SELECT name, marks"
    }),
    event(4, "SQL_SORT", 4, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      expression: "marks DESC",
      direction: "DESC",
      operation: "ORDER BY marks DESC"
    }),
    event(5, "SQL_LIMIT", 5, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      limit: "3",
      rowCount: 3,
      operation: "LIMIT 3"
    }),
    event(6, "SQL_RESULT", 1, {
      table: "students",
      columns: ["name", "marks"],
      rows: projectedRows,
      rowCount: 3,
      operation: "Final query result"
    }),
    event(7, "OUTPUT", 1, { channel: "result", text: "3 rows returned" }),
    event(8, "SQL_QUERY_END", 1, { rowCount: 3 })
  ];

  const states = [
    queryState(0),
    queryState(1, { currentRows: allRows, columns: ["id", "name", "marks"], scannedRowCount: 5 }),
    queryState(2, {
      currentRows: [allRows[1]],
      columns: ["id", "name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 1,
      rejectedRowCount: 1
    }),
    queryState(3, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(4, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(5, {
      currentRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(6, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2
    }),
    queryState(7, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2,
      console: [{ channel: "result", text: "3 rows returned" }]
    }),
    queryState(8, {
      currentRows: projectedRows,
      resultRows: projectedRows,
      columns: ["name", "marks"],
      scannedRowCount: 5,
      matchingRowCount: 3,
      rejectedRowCount: 2,
      console: [{ channel: "result", text: "3 rows returned" }],
      status: "completed"
    })
  ];

  return {
    status: "ok",
    language: "sql",
    executionStatus: "completed",
    trace: {
      traceId: "sql-presentation-test",
      status: "completed",
      events
    },
    states,
    summary: { eventCount: events.length, rowCount: 3 }
  };
}

function runTests() {
  const presentation = createExecutionPresentation(createResult());

  assert.equal(presentation.language, "javascript");
  assert.equal(presentation.steps.length, 7);
  assert.equal(presentation.steps[2].line, 5);
  assert.equal(presentation.steps[2].array.name, "numbers");
  assert.equal(presentation.steps[2].array.activeIndex, 1);
  assert.deepEqual(presentation.steps[3].stack.values, [8]);
  assert.equal(presentation.steps[3].array.name, "numbers");
  assert.equal(presentation.steps[4].callStack[0].name, "double");
  assert.equal(presentation.steps[5].iteration, 2);
  assert.equal(presentation.steps[5].condition.result, true);
  assert.equal(presentation.steps[6].console[0].text, "Total: 24");
  assert.equal(presentation.steps[6].variables.total, 24);

  const pythonPresentation = createExecutionPresentation(createResult("python"));
  assert.equal(pythonPresentation.language, "python");
  assert.match(pythonPresentation.steps[0].description, /Python execution/);
  assert.deepEqual(pythonPresentation.steps[3].stack.values, [8]);
  assert.equal(pythonPresentation.steps[5].condition.result, true);

  const javaResult = createResult("java");
  const javaFinalState = javaResult.states.at(-1);

  javaFinalState.variables = {
    args: [],
    numbers: [4, 8, 12],
    stack: { $type: "object", display: "java.util.ArrayDeque" },
    total: 24
  };
  javaFinalState.arrays = {
    args: [],
    numbers: [4, 8, 12]
  };
  javaFinalState.stacks = {
    stack: [4, 8, 12]
  };

  const javaPresentation = createExecutionPresentation(javaResult);
  assert.equal(javaPresentation.language, "java");
  assert.match(javaPresentation.steps[0].description, /Java execution/);
  assert.deepEqual(javaPresentation.steps[3].stack.values, [8]);
  assert.equal(javaPresentation.steps[4].callStack[0].name, "double");
  assert.equal(javaPresentation.steps[5].condition.result, true);
  assert.equal(javaPresentation.steps.at(-1).array.name, "numbers");
  assert.deepEqual(
    javaPresentation.steps.at(-1).variables.stack,
    [4, 8, 12]
  );

  const sqlPresentation = createExecutionPresentation(createSqlResult());
  assert.equal(sqlPresentation.language, "sql");
  assert.equal(sqlPresentation.steps.length, 9);
  assert.equal(sqlPresentation.steps.every((step) => step.sql !== null), true);
  assert.equal(sqlPresentation.steps[1].sql.table, "students");
  assert.equal(sqlPresentation.steps[1].sql.scannedCount, 5);
  assert.equal(sqlPresentation.steps[2].sql.activeRowIndex, 1);
  assert.equal(sqlPresentation.steps[2].sql.activeRowResult, true);
  assert.deepEqual(sqlPresentation.steps[2].sql.rejectedIds, [1]);
  assert.equal(sqlPresentation.steps[2].sql.displayRows.length, 5);
  assert.deepEqual(sqlPresentation.steps[3].sql.columns, ["name", "marks"]);
  assert.deepEqual(sqlPresentation.steps[6].sql.rows, [
    { name: "Divya", marks: 92 },
    { name: "Nila", marks: 88 },
    { name: "Kavin", marks: 84 }
  ]);
  assert.equal(sqlPresentation.steps[7].console[0].text, "3 rows returned");
  assert.match(sqlPresentation.steps[0].description, /SQLite/);

  const idle = createIdleExecutionStep();
  assert.equal(idle.status, "idle");
  assert.deepEqual(idle.variables, {});

  const idleSql = createIdleExecutionStep("sql");
  assert.equal(idleSql.event, "SQL_QUERY_START");
  assert.equal(idleSql.sql.table, "Query workspace");

  assert.throws(
    () => createExecutionPresentation(null),
    /must be an object/
  );

  const mismatchedResult = createResult();
  mismatchedResult.states.pop();

  assert.throws(
    () => createExecutionPresentation(mismatchedResult),
    /do not match/
  );

  const unsynchronizedResult = createResult();
  unsynchronizedResult.states[2].step = 99;

  assert.throws(
    () => createExecutionPresentation(unsynchronizedResult),
    /not synchronized/
  );

  console.log("Frontend execution presentation tests passed.");
  console.log(`Presented execution steps: ${presentation.steps.length}`);
  console.log("Array highlighting: passed");
  console.log("Stack synchronization: passed");
  console.log("Call-stack presentation: passed");
  console.log("Loop and condition presentation: passed");
  console.log("Trace-state synchronization: passed");
  console.log("Python presentation compatibility: passed");
  console.log("Java presentation compatibility: passed");
  console.log("Java collection presentation: passed");
  console.log("SQL relational presentation: passed");
  console.log("SQL row-filter highlighting: passed");
  console.log("SQL result synchronization: passed");
}

runTests();
