"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");

const {
  EVENT_TYPES,
  TraceRecorder,
  assertValidTrace
} = require("@codeflow/execution-trace");

const { StateReconstructor } = require("@codeflow/visualizer-core");

const DEFAULT_PYTHON_EXECUTABLE = "python";
const DEFAULT_PROCESS_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TRACE_EVENTS = 1_000;
const DEFAULT_MAX_RESULT_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_RESULT_ROWS = 100;

class SqlExecutionError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "SqlExecutionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function createWorkerEnvironment() {
  const environment = {};

  for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "ComSpec", "TEMP", "TMP"]) {
    if (process.env[name]) {
      environment[name] = process.env[name];
    }
  }

  return environment;
}

function runSqlWorker(payload, options) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "worker.py");
    const stdoutChunks = [];
    const stderrChunks = [];

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    let exceededResultLimit = false;

    const child = spawn(
      options.pythonExecutable,
      ["-I", "-B", workerPath],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: createWorkerEnvironment()
      }
    );

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.processTimeoutMs);

    function settle(callback, value) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    }

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;

      if (stdoutBytes > options.maximumResultBytes) {
        exceededResultLimit = true;
        child.kill("SIGKILL");
        return;
      }

      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk) => {
      if (stderrBytes >= 8 * 1024) {
        return;
      }

      stderrBytes += chunk.length;
      stderrChunks.push(chunk);
    });

    child.stdin.on("error", () => {});

    child.on("error", (error) => {
      settle(
        reject,
        new SqlExecutionError(
          `SQL worker could not start: ${error.message}`,
          500,
          "SQL_WORKER_START_FAILED"
        )
      );
    });

    child.on("close", (exitCode) => {
      if (timedOut) {
        settle(
          reject,
          new SqlExecutionError(
            "SQL execution exceeded the process timeout.",
            408,
            "EXECUTION_TIMEOUT"
          )
        );

        return;
      }

      if (exceededResultLimit) {
        settle(
          reject,
          new SqlExecutionError(
            "SQL execution exceeded the maximum trace-response size.",
            413,
            "TRACE_RESPONSE_TOO_LARGE"
          )
        );

        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (exitCode !== 0) {
        settle(
          reject,
          new SqlExecutionError(
            stderr.trim() || "SQL execution worker exited unsuccessfully.",
            500,
            "SQL_WORKER_EXECUTION_FAILED"
          )
        );

        return;
      }

      try {
        settle(resolve, JSON.parse(stdout));
      } catch {
        settle(
          reject,
          new SqlExecutionError(
            "SQL worker returned an invalid execution response.",
            502,
            "INVALID_WORKER_RESPONSE"
          )
        );
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

function createProductionTrace(workerResult, traceId, maximumTraceEvents) {
  if (!Array.isArray(workerResult.events)) {
    throw new SqlExecutionError(
      "SQL worker returned an incomplete event list.",
      502,
      "INVALID_WORKER_RESPONSE"
    );
  }

  const recorder = new TraceRecorder({
    language: "sql",
    traceId,
    maxEvents: maximumTraceEvents,
    metadata: {
      adapter: "sqlite-logical-query",
      sourceFile: "query.sql",
      executionMode: "local-trusted-child-process",
      database: "private-in-memory-sqlite",
      visualizationMode: "educational-logical-query"
    }
  });

  const firstLine = Number.isInteger(workerResult.selectLine)
    ? workerResult.selectLine
    : 1;

  recorder.start(
    {
      query: workerResult.query || "",
      mode: "educational-logical-query",
      database: "sqlite-memory",
      message: "SQL query execution started."
    },
    { source: { line: firstLine } }
  );

  let lastLine = firstLine;

  for (const rawEvent of workerResult.events) {
    const line = Number.isInteger(rawEvent.line) && rawEvent.line > 0
      ? rawEvent.line
      : lastLine;

    lastLine = line;

    if (rawEvent.type === EVENT_TYPES.ERROR) {
      recorder.fail(rawEvent.payload || {}, { source: { line } });
      break;
    }

    recorder.record(
      rawEvent.type,
      rawEvent.payload || {},
      { source: { line } }
    );
  }

  if (recorder.status !== "failed") {
    const resultEvent = workerResult.events.find(
      (event) => event.type === EVENT_TYPES.SQL_RESULT
    );

    recorder.finish(
      {
        status: "completed",
        rowCount: resultEvent?.payload?.rowCount || 0,
        message: "SQL query execution completed."
      },
      { source: { line: lastLine } }
    );
  }

  const trace = recorder.toJSON();
  assertValidTrace(trace);
  return trace;
}

async function executeSql(source, options = {}) {
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new SqlExecutionError(
      "SQL source must be a non-empty string.",
      400,
      "INVALID_SOURCE"
    );
  }

  const startedAt = Date.now();

  const configuration = {
    pythonExecutable:
      options.pythonExecutable ||
      process.env.CODEFLOW_PYTHON_EXECUTABLE ||
      DEFAULT_PYTHON_EXECUTABLE,
    processTimeoutMs: options.processTimeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS,
    maximumTraceEvents: options.maximumTraceEvents ?? DEFAULT_MAX_TRACE_EVENTS,
    maximumResultBytes: options.maximumResultBytes ?? DEFAULT_MAX_RESULT_BYTES,
    maximumRows: options.maximumRows ?? DEFAULT_MAX_RESULT_ROWS
  };

  const workerResult = await runSqlWorker(
    {
      source,
      maximumTraceEvents: configuration.maximumTraceEvents,
      maximumRows: configuration.maximumRows
    },
    configuration
  );

  if (workerResult.status === "error") {
    throw new SqlExecutionError(
      workerResult.error?.message || "SQL query was rejected.",
      400,
      workerResult.error?.code || "SOURCE_POLICY_VIOLATION"
    );
  }

  if (workerResult.status !== "ok") {
    throw new SqlExecutionError(
      "SQL worker returned an incomplete execution response.",
      502,
      "INVALID_WORKER_RESPONSE"
    );
  }

  const trace = createProductionTrace(
    workerResult,
    options.traceId || `sql:${randomUUID()}`,
    configuration.maximumTraceEvents
  );

  const reconstructor = new StateReconstructor(trace, {
    checkpointInterval: 10
  });

  const states = reconstructor.reconstructAll();
  const finalState = states.at(-1);

  return {
    status: "ok",
    language: "sql",
    executionStatus: trace.status,
    trace,
    states,
    summary: {
      eventCount: trace.eventCount,
      executionTimeMs: Date.now() - startedAt,
      outputCount: finalState?.console?.length ?? 0,
      errorCount: finalState?.errors?.length ?? 0,
      finalStep: finalState?.step ?? -1,
      rowCount: finalState?.query?.resultRows?.length ?? 0,
      scannedRowCount: finalState?.query?.scannedRowCount ?? 0,
      matchingRowCount: finalState?.query?.matchingRowCount ?? 0,
      rejectedRowCount: finalState?.query?.rejectedRowCount ?? 0
    },
    security: {
      mode: "local-trusted-development",
      dedicatedChildProcess: true,
      privateInMemoryDatabase: true,
      readOnlyQueries: true,
      productionSandboxAvailable: false
    }
  };
}

module.exports = {
  DEFAULT_PYTHON_EXECUTABLE,
  DEFAULT_PROCESS_TIMEOUT_MS,
  DEFAULT_MAX_TRACE_EVENTS,
  DEFAULT_MAX_RESULT_BYTES,
  DEFAULT_MAX_RESULT_ROWS,
  SqlExecutionError,
  executeSql
};
