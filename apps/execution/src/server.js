"use strict";

const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");

const {
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  TRACE_DOMAINS,
  getDomainForLanguage
} = require("@codeflow/execution-trace");

const {
  JavaScriptExecutionError,
  executeJavaScript
} = require("./javascript/adapter");

const {
  PythonExecutionError,
  executePython
} = require("./python/adapter");

const {
  JavaExecutionError,
  executeJava
} = require("./java/adapter");

const {
  SqlExecutionError,
  executeSql
} = require("./sql/adapter");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4100;
const DEFAULT_MAX_SOURCE_BYTES = 32 * 1024;
const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;
const DEFAULT_MAX_INPUT_ITEMS = 20;
const DEFAULT_MAX_INPUT_ITEM_BYTES = 512;
const DEFAULT_MAX_INPUT_BYTES = 4 * 1024;
const SERVICE_NAME = "codeflow-execution";
const SERVICE_VERSION = "0.6.0";

const EXECUTION_ENABLED_LANGUAGES = Object.freeze([
  LANGUAGES.JAVASCRIPT,
  LANGUAGES.PYTHON,
  LANGUAGES.JAVA,
  LANGUAGES.SQL
]);

class ExecutionRequestError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "ExecutionRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body, "utf8"),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });

  response.end(body);
}

function hasValidServiceSecret(request, serviceSecret) {
  if (!serviceSecret) return true;
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(serviceSecret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function createLanguageCapabilities() {
  return SUPPORTED_LANGUAGES.map((language) => ({
    id: language,
    label: {
      [LANGUAGES.JAVASCRIPT]: "JavaScript",
      [LANGUAGES.PYTHON]: "Python",
      [LANGUAGES.JAVA]: "Java",
      [LANGUAGES.SQL]: "SQL"
    }[language],
    domain: getDomainForLanguage(language),
    adapterValidated: true,
    executionEnabled: EXECUTION_ENABLED_LANGUAGES.includes(language),
    visualizationMode: language === LANGUAGES.SQL
      ? "logical-query"
      : "program-execution"
  }));
}

function normalizeIsolationCapabilities(capabilities = {}) {
  return {
    networkIsolationEnforced: capabilities.networkIsolationEnforced === true,
    filesystemIsolationEnforced: capabilities.filesystemIsolationEnforced === true,
    memoryLimitEnforced: capabilities.memoryLimitEnforced === true,
    cpuLimitEnforced: capabilities.cpuLimitEnforced === true,
    processLimitEnforced: capabilities.processLimitEnforced === true,
    ephemeralWorkspaceEnforced: capabilities.ephemeralWorkspaceEnforced === true
  };
}

function hasProductionIsolation(capabilities) {
  return Object.values(normalizeIsolationCapabilities(capabilities)).every(Boolean);
}

function assertProductionIsolation(options = {}) {
  const environment = options.environment || process.env.NODE_ENV || "development";
  if (environment !== "production") return;

  if (!hasProductionIsolation(options.sandboxCapabilities)) {
    throw new TypeError(
      "Production execution requires enforced network, filesystem, memory, CPU, process, and ephemeral-workspace isolation."
    );
  }
}

function createHealthResponse(options = {}) {
  const environment = options.environment || process.env.NODE_ENV || "development";
  const isolation = normalizeIsolationCapabilities(options.sandboxCapabilities);
  const productionSandboxAvailable = hasProductionIsolation(isolation);
  const restrictedDemoAvailable = options.restrictedDemo === true &&
    typeof options.serviceSecret === "string" &&
    options.serviceSecret.length >= 32;

  return {
    status: "ok",
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment,
    readiness: {
      ready: true,
      runtimes: {
        javascript: "ready",
        python: "ready",
        java: "cold-start-capable",
        sql: "ready"
      }
    },
    languages: SUPPORTED_LANGUAGES,
    executionEnabledLanguages: [...EXECUTION_ENABLED_LANGUAGES],
    domains: [TRACE_DOMAINS.PROGRAM, TRACE_DOMAINS.QUERY],
    security: {
      mode: productionSandboxAvailable
        ? "isolated-production-sandbox"
        : restrictedDemoAvailable
          ? "authenticated-restricted-demo"
          : "local-trusted-development",
      dedicatedExecutionProcess: true,
      dedicatedJavaScriptChildProcess: true,
      dedicatedPythonChildProcess: true,
      dedicatedJavaChildProcess: true,
      dedicatedSqlChildProcess: true,
      privateSqlDatabase: true,
      productionSandboxAvailable,
      acceptsUntrustedCode: environment === "production" && productionSandboxAvailable,
      restrictedDemoAvailable,
      requiresServiceAuthentication: Boolean(options.serviceSecret),
      ...isolation
    }
  };
}

async function readJsonBody(request, maximumBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;

    if (totalBytes > maximumBytes) {
      throw new ExecutionRequestError(
        "Request body exceeds the maximum permitted size.",
        413,
        "REQUEST_TOO_LARGE"
      );
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    throw new ExecutionRequestError(
      "Request body is required.",
      400,
      "REQUEST_BODY_REQUIRED"
    );
  }

  let body;

  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ExecutionRequestError(
      "Request body must contain valid JSON.",
      400,
      "INVALID_JSON"
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ExecutionRequestError(
      "Request body must be a JSON object.",
      400,
      "INVALID_REQUEST_BODY"
    );
  }

  return body;
}

function validateExecutionRequest(body, maximumSourceBytes) {
  const { language, source } = body;
  const inputs = body.inputs ?? [];

  if (typeof language !== "string" || !SUPPORTED_LANGUAGES.includes(language)) {
    throw new ExecutionRequestError(
      "A supported execution language is required.",
      400,
      "UNSUPPORTED_LANGUAGE"
    );
  }

  if (typeof source !== "string" || source.trim().length === 0) {
    throw new ExecutionRequestError(
      "Source code must be a non-empty string.",
      400,
      "INVALID_SOURCE"
    );
  }

  const sourceBytes = Buffer.byteLength(source, "utf8");

  if (sourceBytes > maximumSourceBytes) {
    throw new ExecutionRequestError(
      "Source code exceeds the maximum permitted size.",
      413,
      "SOURCE_TOO_LARGE"
    );
  }

  if (!Array.isArray(inputs) || inputs.some((value) => typeof value !== "string")) {
    throw new ExecutionRequestError(
      "Program inputs must be an array of strings.",
      400,
      "INVALID_INPUTS"
    );
  }

  if (inputs.length > DEFAULT_MAX_INPUT_ITEMS) {
    throw new ExecutionRequestError(
      `Program input is limited to ${DEFAULT_MAX_INPUT_ITEMS} lines.`,
      413,
      "INPUT_LIMIT_EXCEEDED"
    );
  }

  if (inputs.some((value) => Buffer.byteLength(value, "utf8") > DEFAULT_MAX_INPUT_ITEM_BYTES)) {
    throw new ExecutionRequestError(
      `Each program input line is limited to ${DEFAULT_MAX_INPUT_ITEM_BYTES} bytes.`,
      413,
      "INPUT_LINE_TOO_LARGE"
    );
  }

  if (Buffer.byteLength(inputs.join("\n"), "utf8") > DEFAULT_MAX_INPUT_BYTES) {
    throw new ExecutionRequestError(
      `Program input is limited to ${DEFAULT_MAX_INPUT_BYTES} bytes.`,
      413,
      "INPUT_TOO_LARGE"
    );
  }

  if (language === LANGUAGES.SQL && inputs.length > 0) {
    throw new ExecutionRequestError(
      "SQL execution does not accept program input.",
      400,
      "INPUT_NOT_SUPPORTED"
    );
  }

  return { language, source, sourceBytes, inputs: [...inputs] };
}

async function handleExecution(request, response, options) {
  const body = await readJsonBody(request, options.maximumRequestBytes);

  const executionRequest = validateExecutionRequest(
    body,
    options.maximumSourceBytes
  );

  if (!EXECUTION_ENABLED_LANGUAGES.includes(executionRequest.language)) {
    writeJson(response, 501, {
      status: "error",
      error: {
        code: "EXECUTION_NOT_IMPLEMENTED",
        message: `${executionRequest.language} execution has not been integrated yet.`
      },
      request: {
        language: executionRequest.language,
        sourceBytes: executionRequest.sourceBytes
      },
      security: {
        acceptsUntrustedCode: false,
        productionSandboxAvailable: false
      }
    });

    return;
  }

  let executionResult;

  if (executionRequest.language === LANGUAGES.JAVASCRIPT) {
    executionResult = await executeJavaScript(
      executionRequest.source,
      { ...options.javascript, inputs: executionRequest.inputs }
    );
  } else if (executionRequest.language === LANGUAGES.PYTHON) {
    executionResult = await executePython(
      executionRequest.source,
      { ...options.python, inputs: executionRequest.inputs }
    );
  } else if (executionRequest.language === LANGUAGES.JAVA) {
    executionResult = await executeJava(
      executionRequest.source,
      { ...options.java, inputs: executionRequest.inputs }
    );
  } else {
    executionResult = await executeSql(
      executionRequest.source,
      options.sql
    );
  }

  writeJson(response, 200, executionResult);
}

async function handleRequest(request, response, options) {
  if (!hasValidServiceSecret(request, options.serviceSecret)) {
    writeJson(response, 401, {
      status: "error",
      error: {
        code: "EXECUTION_SERVICE_AUTHENTICATION_REQUIRED",
        message: "Execution service authentication is required."
      }
    });
    return;
  }

  const requestUrl = new URL(request.url, "http://127.0.0.1");

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    writeJson(response, 200, createHealthResponse(options));
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/languages") {
    writeJson(response, 200, {
      status: "ok",
      languages: createLanguageCapabilities()
    });

    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/execute") {
    await handleExecution(request, response, options);
    return;
  }

  writeJson(response, 404, {
    status: "error",
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Execution service route was not found."
    }
  });
}

function createExecutionServer(options = {}) {
  const maximumSourceBytes = options.maximumSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const maximumRequestBytes = options.maximumRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  if (!Number.isInteger(maximumSourceBytes) || maximumSourceBytes < 1) {
    throw new TypeError("maximumSourceBytes must be a positive integer.");
  }

  if (!Number.isInteger(maximumRequestBytes) || maximumRequestBytes < 1) {
    throw new TypeError("maximumRequestBytes must be a positive integer.");
  }

  assertProductionIsolation(options);

  return http.createServer((request, response) => {
    handleRequest(request, response, {
      maximumSourceBytes,
      maximumRequestBytes,
      environment: options.environment || process.env.NODE_ENV || "development",
      sandboxCapabilities: options.sandboxCapabilities,
      serviceSecret: options.serviceSecret,
      restrictedDemo: options.restrictedDemo,
      javascript: options.javascript || {},
      python: options.python || {},
      java: options.java || {},
      sql: options.sql || {}
    }).catch((error) => {
      if (response.headersSent) {
        response.end();
        return;
      }

      if (
        error instanceof ExecutionRequestError ||
        error instanceof JavaScriptExecutionError ||
        error instanceof PythonExecutionError ||
        error instanceof JavaExecutionError ||
        error instanceof SqlExecutionError
      ) {
        writeJson(response, error.statusCode, {
          status: "error",
          error: {
            code: error.code,
            message: error.message
          }
        });

        return;
      }

      writeJson(response, 500, {
        status: "error",
        error: {
          code: "INTERNAL_EXECUTION_ERROR",
          message: "Execution service could not process the request."
        }
      });
    });
  });
}

function startExecutionServer(options = {}) {
  const host = options.host || process.env.EXECUTION_HOST || DEFAULT_HOST;

  const port = Number(
    options.port || process.env.EXECUTION_PORT || DEFAULT_PORT
  );

  const resolvedOptions = {
    ...options,
    environment: options.environment || process.env.NODE_ENV || "development",
    serviceSecret: options.serviceSecret || process.env.EXECUTION_SERVICE_SECRET,
    restrictedDemo: options.restrictedDemo ??
      process.env.EXECUTION_RESTRICTED_DEMO === "true"
  };
  if (
    resolvedOptions.restrictedDemo &&
    (typeof resolvedOptions.serviceSecret !== "string" || resolvedOptions.serviceSecret.length < 32)
  ) {
    throw new TypeError(
      "EXECUTION_SERVICE_SECRET must contain at least 32 characters for restricted demo execution."
    );
  }
  const server = createExecutionServer(resolvedOptions);
  const health = createHealthResponse(resolvedOptions);

  server.listen(port, host, () => {
    console.log(`CodeFlow execution service running at http://${host}:${port}`);
    console.log(`Security mode: ${health.security.mode}`);
    console.log("Real execution enabled: JavaScript, Python, Java, SQL");
    console.log("SQL database: isolated in-memory SQLite teaching dataset");
  });

  return server;
}

function installShutdownHandlers(server, label = "CodeFlow execution service") {
  let stopping = false;
  function stop(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`${label} received ${signal}; finishing active requests.`);
    const forcedExit = setTimeout(() => {
      console.error(`${label} shutdown exceeded 10 seconds.`);
      process.exitCode = 1;
    }, 10_000);
    forcedExit.unref();
    server.close((error) => {
      clearTimeout(forcedExit);
      if (error) {
        console.error(`${label} shutdown failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
  }
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}

if (require.main === module) {
  installShutdownHandlers(startExecutionServer());
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_MAX_SOURCE_BYTES,
  DEFAULT_MAX_REQUEST_BYTES,
  SERVICE_NAME,
  ExecutionRequestError,
  createLanguageCapabilities,
  createHealthResponse,
  normalizeIsolationCapabilities,
  hasProductionIsolation,
  assertProductionIsolation,
  installShutdownHandlers,
  createExecutionServer,
  startExecutionServer
};
