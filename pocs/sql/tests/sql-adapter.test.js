"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const {
  createInitialQueryState,
  reconstructAllQueryStates,
} = require("../query-state-reconstructor");

const {
  TimelineController,
} = require("../../javascript/timeline-controller");

const {
  validateTrace,
} = require("../../javascript/trace-validator");

function executeSqlAdapter() {
  const sqlDirectory = path.resolve(
    __dirname,
    ".."
  );

  const adapterPath = path.join(
    sqlDirectory,
    "sql-adapter.py"
  );

  const fixturePath = path.join(
    sqlDirectory,
    "fixtures",
    "students-query.sql"
  );

  const result = spawnSync(
    "python",
    [adapterPath, fixturePath],
    {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        "SQL adapter process failed.",
        `Exit code: ${result.status}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join("\n")
    );
  }

  if (result.stdout.trim() === "") {
    throw new Error(
      "SQL adapter returned an empty trace."
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      [
        "SQL adapter returned invalid JSON.",
        error.message,
        `stdout: ${result.stdout}`,
      ].join("\n")
    );
  }
}

function runTests() {
  const trace = executeSqlAdapter();

  assert.equal(validateTrace(trace), true);
  assert.equal(trace.language, "sql");
  assert.equal(
    trace.domain,
    "QUERY_EXECUTION"
  );
  assert.equal(trace.eventCount, 10);

  assert.equal(
    trace.events[0].type,
    "SQL_QUERY_START"
  );

  assert.equal(
    trace.events.at(-1).type,
    "SQL_RESULT"
  );

  assert.equal(
    trace.events.filter(
      (event) => event.type === "SQL_FILTER"
    ).length,
    5
  );

  const states = reconstructAllQueryStates(
    trace.events
  );

  const controller = new TimelineController({
    states,
    initialState:
      createInitialQueryState(),
    speed: 1,
    baseDelayMs: 10,
  });

  const finalSnapshot = controller.last();
  const finalState = finalSnapshot.state;

  assert.equal(finalState.status, "completed");
  assert.equal(finalState.scan.table, "students");
  assert.equal(finalState.scan.rowCount, 5);

  assert.equal(
    finalState.filter.evaluations.length,
    5
  );

  assert.equal(
    finalState.filter.matchingRows.length,
    3
  );

  assert.equal(
    finalState.filter.rejectedRows.length,
    2
  );

  assert.deepEqual(
    finalState.projection.columns,
    ["name", "marks"]
  );

  assert.equal(
    finalState.sort.column,
    "marks"
  );

  assert.equal(
    finalState.sort.direction,
    "DESC"
  );

  assert.deepEqual(
    finalState.result.columns,
    ["name", "marks"]
  );

  assert.deepEqual(
    finalState.result.rows,
    [
      {
        name: "Divya",
        marks: 92,
      },
      {
        name: "Nila",
        marks: 88,
      },
      {
        name: "Kavin",
        marks: 84,
      },
    ]
  );

  assert.equal(
    finalState.result.verification,
    "matched-sqlite-result"
  );

  assert.equal(finalState.errors.length, 0);

  const firstFilterEvent = trace.events.find(
    (event) => event.type === "SQL_FILTER"
  );

  const beforeFilter = controller.seek(
    firstFilterEvent.sequence - 1
  );

  const afterFilter = controller.seek(
    firstFilterEvent.sequence
  );

  assert.equal(
    beforeFilter.state.filter.evaluations.length,
    0
  );

  assert.equal(
    afterFilter.state.filter.evaluations.length,
    1
  );

  controller.destroy();

  console.log("SQL adapter tests passed.");
  console.log(`Language: ${trace.language}`);
  console.log(`Trace events: ${trace.eventCount}`);
  console.log(
    `Scanned rows: ${finalState.scan.rowCount}`
  );
  console.log(
    `Matching rows: ${
      finalState.filter.matchingRows.length
    }`
  );
  console.log(
    `Rejected rows: ${
      finalState.filter.rejectedRows.length
    }`
  );
  console.log(
    `Result: ${JSON.stringify(
      finalState.result.rows
    )}`
  );
  console.log(
    `Verification: ${
      finalState.result.verification
    }`
  );
}

try {
  runTests();
} catch (error) {
  console.error("SQL adapter tests failed.");
  console.error(error);
  process.exitCode = 1;
}