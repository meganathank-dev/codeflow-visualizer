"use strict";

const path = require("node:path");

const {
  randomUUID
} = require("node:crypto");

const {
  spawn
} = require("node:child_process");

const {
  assertValidTrace
} = require("@codeflow/execution-trace");

const {
  StateReconstructor
} = require("@codeflow/visualizer-core");

const DEFAULT_PROCESS_TIMEOUT_MS = 10_000;

const DEFAULT_VM_TIMEOUT_MS = 800;

const DEFAULT_MAX_TRACE_EVENTS = 1_000;

const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024;

const DEFAULT_MAX_RESULT_BYTES = 2 * 1024 * 1024;

const DEFAULT_MAX_OLD_SPACE_MB = 128;

class JavaScriptExecutionError extends Error {
  constructor(
    message,

    statusCode,

    code
  ) {
    super(message);

    this.name = "JavaScriptExecutionError";

    this.statusCode = statusCode;

    this.code = code;
  }
}

function createWorkerEnvironment() {
  const environment = {
    NODE_ENV: "development"
  };

  if (process.platform === "win32") {
    for (const variableName of [
      "SystemRoot",

      "WINDIR",

      "ComSpec",

      "TEMP",

      "TMP"
    ]) {
      if (
        process.env[variableName]
      ) {
        environment[variableName] = (
          process.env[variableName]
        );
      }
    }
  }

  return environment;
}

function runWorker(
  payload,

  options
) {
  return new Promise(
    (
      resolve,

      reject
    ) => {
      const workerPath = path.join(
        __dirname,

        "worker.js"
      );

      let settled = false;

      let timedOut = false;

      let exceededResultLimit = false;

      let stdoutBytes = 0;

      let stderrBytes = 0;

      const stdoutChunks = [];

      const stderrChunks = [];

      const child = spawn(
        process.execPath,

        [
          `--max-old-space-size=${options.maximumOldSpaceMb}`,

          workerPath
        ],

        {
          windowsHide: true,

          stdio: [
            "pipe",

            "pipe",

            "pipe"
          ],

          env: createWorkerEnvironment()
        }
      );

      const timeoutId = setTimeout(
        () => {
          timedOut = true;

          child.kill("SIGKILL");
        },

        options.processTimeoutMs
      );

      function settle(
        callback,

        value
      ) {
        if (settled) {
          return;
        }

        settled = true;

        clearTimeout(
          timeoutId
        );

        callback(
          value
        );
      }

      child.stdout.on(
        "data",

        (chunk) => {
          stdoutBytes += chunk.length;

          if (
            stdoutBytes > options.maximumResultBytes
          ) {
            exceededResultLimit = true;

            child.kill("SIGKILL");

            return;
          }

          stdoutChunks.push(
            chunk
          );
        }
      );

      child.stderr.on(
        "data",

        (chunk) => {
          if (
            stderrBytes >= 8 * 1024
          ) {
            return;
          }

          stderrBytes += chunk.length;

          stderrChunks.push(
            chunk
          );
        }
      );

      child.stdin.on(
        "error",

        () => {}
      );

      child.on(
        "error",

        (error) => {
          settle(
            reject,

            new JavaScriptExecutionError(
              `JavaScript worker could not start: ${error.message}`,

              500,

              "WORKER_START_FAILED"
            )
          );
        }
      );

      child.on(
        "close",

        (exitCode) => {
          if (timedOut) {
            settle(
              reject,

              new JavaScriptExecutionError(
                "JavaScript execution exceeded the process timeout.",

                408,

                "EXECUTION_TIMEOUT"
              )
            );

            return;
          }

          if (exceededResultLimit) {
            settle(
              reject,

              new JavaScriptExecutionError(
                "JavaScript execution exceeded the maximum trace-response size.",

                413,

                "TRACE_RESPONSE_TOO_LARGE"
              )
            );

            return;
          }

          const stdout = Buffer.concat(
            stdoutChunks
          ).toString("utf8");

          const stderr = Buffer.concat(
            stderrChunks
          ).toString("utf8");

          if (exitCode !== 0) {
            settle(
              reject,

              new JavaScriptExecutionError(
                stderr.trim() ||
                "JavaScript execution worker exited unsuccessfully.",

                500,

                "WORKER_EXECUTION_FAILED"
              )
            );

            return;
          }

          let result;

          try {
            result = JSON.parse(
              stdout
            );
          } catch {
            settle(
              reject,

              new JavaScriptExecutionError(
                "JavaScript worker returned an invalid execution response.",

                502,

                "INVALID_WORKER_RESPONSE"
              )
            );

            return;
          }

          settle(
            resolve,

            result
          );
        }
      );

      child.stdin.end(
        JSON.stringify(payload)
      );
    }
  );
}

async function executeJavaScript(
  source,

  options = {}
) {
  if (
    typeof source !== "string" ||
    source.trim().length === 0
  ) {
    throw new JavaScriptExecutionError(
      "JavaScript source must be a non-empty string.",

      400,

      "INVALID_SOURCE"
    );
  }

  const startedAt = Date.now();

  const configuration = {
    processTimeoutMs: (
      options.processTimeoutMs ??
      DEFAULT_PROCESS_TIMEOUT_MS
    ),

    vmTimeoutMs: (
      options.vmTimeoutMs ??
      DEFAULT_VM_TIMEOUT_MS
    ),

    maximumTraceEvents: (
      options.maximumTraceEvents ??
      DEFAULT_MAX_TRACE_EVENTS
    ),

    maximumOutputBytes: (
      options.maximumOutputBytes ??
      DEFAULT_MAX_OUTPUT_BYTES
    ),

    maximumResultBytes: (
      options.maximumResultBytes ??
      DEFAULT_MAX_RESULT_BYTES
    ),

    maximumOldSpaceMb: (
      options.maximumOldSpaceMb ??
      DEFAULT_MAX_OLD_SPACE_MB
    )
  };

  const traceId = (
    options.traceId ||
    `javascript:${randomUUID()}`
  );

  const workerResult = await runWorker(
    {
      source,

      traceId,

      maximumTraceEvents: configuration.maximumTraceEvents,

      maximumOutputBytes: configuration.maximumOutputBytes,

      vmTimeoutMs: configuration.vmTimeoutMs
    },

    configuration
  );

  if (
    workerResult.status === "error"
  ) {
    throw new JavaScriptExecutionError(
      workerResult.error?.message ||
      "JavaScript source was rejected.",

      400,

      workerResult.error?.code ||
      "SOURCE_POLICY_VIOLATION"
    );
  }

  if (
    workerResult.status !== "ok" ||
    !workerResult.trace
  ) {
    throw new JavaScriptExecutionError(
      "JavaScript worker returned an incomplete trace.",

      502,

      "INVALID_WORKER_RESPONSE"
    );
  }

  const trace = workerResult.trace;

  assertValidTrace(
    trace
  );

  const reconstructor = new StateReconstructor(
    trace,

    {
      checkpointInterval: 10
    }
  );

  const states = reconstructor.reconstructAll();

  const finalState = states.at(-1);

  return {
    status: "ok",

    language: "javascript",

    executionStatus: trace.status,

    trace,

    states,

    summary: {
      eventCount: trace.eventCount,

      executionTimeMs: (
        Date.now() - startedAt
      ),

      outputCount: (
        finalState?.console?.length ??
        0
      ),

      errorCount: (
        finalState?.errors?.length ??
        0
      ),

      finalStep: (
        finalState?.step ??
        -1
      )
    },

    security: {
      mode: "local-trusted-development",

      dedicatedChildProcess: true,

      productionSandboxAvailable: false
    }
  };
}

module.exports = {
  DEFAULT_PROCESS_TIMEOUT_MS,

  DEFAULT_VM_TIMEOUT_MS,

  DEFAULT_MAX_TRACE_EVENTS,

  DEFAULT_MAX_OUTPUT_BYTES,

  DEFAULT_MAX_RESULT_BYTES,

  DEFAULT_MAX_OLD_SPACE_MB,

  JavaScriptExecutionError,

  executeJavaScript
};
