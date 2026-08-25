"use strict";

const vm = require("node:vm");

const {
  instrumentSource
} = require("./instrumenter");

const {
  SourcePolicyError,

  prepareSourceForInstrumentation
} = require("./source-policy");

const {
  createJavaScriptRuntime
} = require("./runtime");

const DEFAULT_VM_TIMEOUT_MS = 800;

const MAXIMUM_WORKER_INPUT_BYTES = 64 * 1024;

function normalizeErrorLine(error) {
  if (
    Number.isInteger(
      error?.loc?.line
    )
  ) {
    return error.loc.line;
  }

  const stack = String(
    error?.stack || ""
  );

  const match = stack.match(
    /codeflow-user-program\.js:(\d+)/
  );

  if (match) {
    return Number(
      match[1]
    );
  }

  return 1;
}

function writeResponse(payload) {
  process.stdout.write(
    JSON.stringify(payload)
  );
}

async function readWorkerInput() {
  const chunks = [];

  let totalBytes = 0;

  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;

    if (
      totalBytes > MAXIMUM_WORKER_INPUT_BYTES
    ) {
      throw new Error(
        "Execution worker input exceeded the maximum size."
      );
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    throw new Error(
      "Execution worker did not receive an input payload."
    );
  }

  const rawInput = Buffer.concat(
    chunks
  ).toString("utf8");

  let payload;

  try {
    payload = JSON.parse(
      rawInput
    );
  } catch {
    throw new Error(
      "Execution worker received invalid JSON."
    );
  }

  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "Execution worker input must be an object."
    );
  }

  return payload;
}

function executeSource(payload) {
  const {
    source,

    traceId,

    maximumTraceEvents,

    maximumOutputBytes,

    vmTimeoutMs = DEFAULT_VM_TIMEOUT_MS
  } = payload;

  const runtime = createJavaScriptRuntime({
    traceId,

    sourceFile: "main.js",

    maximumTraceEvents,

    maximumOutputBytes
  });

  runtime.start();

  let preparedSource;

  try {
    preparedSource = prepareSourceForInstrumentation(
      source
    );
  } catch (error) {
    if (
      error instanceof SourcePolicyError
    ) {
      return {
        status: "error",

        error: {
          code: error.code,

          name: error.name,

          message: error.message,

          line: error.line
        }
      };
    }

    runtime.fail(
      error,

      normalizeErrorLine(error)
    );

    return {
      status: "ok",

      trace: runtime.getTrace()
    };
  }

  try {
    const instrumentedCode = instrumentSource(
      preparedSource
    );

    const sandbox = Object.create(null);

    sandbox.__trace = runtime;
    sandbox.LinkedList = runtime.createLinkedListConstructor();
    sandbox.Map = runtime.createHashMapConstructor();
    sandbox.BinarySearchTree = runtime.createBinarySearchTreeConstructor();
    sandbox.MinHeap = runtime.createMinHeapConstructor();
    sandbox.Graph = runtime.createGraphConstructor();
    sandbox.SearchAlgorithms = runtime.createSearchAlgorithms();

    const context = vm.createContext(
      sandbox,

      {
        name: "CodeFlow JavaScript Preview",

        codeGeneration: {
          strings: false,

          wasm: false
        }
      }
    );

    const script = new vm.Script(
      instrumentedCode,

      {
        filename: "codeflow-user-program.js",

        displayErrors: true
      }
    );

    script.runInContext(
      context,

      {
        timeout: vmTimeoutMs,

        displayErrors: true
      }
    );

    runtime.end();
  } catch (error) {
    runtime.fail(
      error,

      normalizeErrorLine(error)
    );
  }

  return {
    status: "ok",

    trace: runtime.getTrace()
  };
}

async function main() {
  const payload = await readWorkerInput();

  const result = executeSource(
    payload
  );

  writeResponse(
    result
  );
}

main().catch((error) => {
  console.error(
    `JavaScript execution worker failed: ${error.message}`
  );

  process.exitCode = 1;
});
