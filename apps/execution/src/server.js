"use strict";

const http = require("node:http");

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

const DEFAULT_HOST = "127.0.0.1";

const DEFAULT_PORT = 4100;

const DEFAULT_MAX_SOURCE_BYTES = 32 * 1024;

const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;

const SERVICE_NAME = "codeflow-execution";

const SERVICE_VERSION = "0.3.0";

const EXECUTION_ENABLED_LANGUAGES = Object.freeze([
  LANGUAGES.JAVASCRIPT,
  LANGUAGES.PYTHON
]);

class ExecutionRequestError extends Error {
  constructor(
    message,
    statusCode,
    code
  ) {
    super(message);

    this.name = "ExecutionRequestError";

    this.statusCode = statusCode;

    this.code = code;
  }
}

function writeJson(
  response,
  statusCode,
  payload
) {
  const body = JSON.stringify(
    payload
  );

  response.writeHead(
    statusCode,

    {
      "content-type": (
        "application/json; charset=utf-8"
      ),

      "content-length": Buffer.byteLength(
        body,
        "utf8"
      ),

      "cache-control": "no-store",

      "x-content-type-options": "nosniff"
    }
  );

  response.end(
    body
  );
}

function createLanguageCapabilities() {
  return SUPPORTED_LANGUAGES.map(
    (language) => ({
      id: language,

      label: {
        [LANGUAGES.JAVASCRIPT]: "JavaScript",

        [LANGUAGES.PYTHON]: "Python",

        [LANGUAGES.JAVA]: "Java",

        [LANGUAGES.SQL]: "SQL"
      }[language],

      domain: getDomainForLanguage(
        language
      ),

      adapterValidated: true,

      executionEnabled: (
        EXECUTION_ENABLED_LANGUAGES.includes(
          language
        )
      ),

      visualizationMode: (
        language === LANGUAGES.SQL
          ? "logical-query"
          : "program-execution"
      )
    })
  );
}

function createHealthResponse() {
  return {
    status: "ok",

    service: SERVICE_NAME,

    version: SERVICE_VERSION,

    environment: "development",

    languages: SUPPORTED_LANGUAGES,

    executionEnabledLanguages: [
      ...EXECUTION_ENABLED_LANGUAGES
    ],

    domains: [
      TRACE_DOMAINS.PROGRAM,

      TRACE_DOMAINS.QUERY
    ],

    security: {
      mode: "local-trusted-development",

      dedicatedExecutionProcess: true,

      dedicatedJavaScriptChildProcess: true,

      dedicatedPythonChildProcess: true,

      productionSandboxAvailable: false,

      acceptsUntrustedCode: false,

      networkIsolationEnforced: false,

      filesystemIsolationEnforced: false
    }
  };
}

async function readJsonBody(
  request,
  maximumBytes
) {
  const chunks = [];

  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;

    if (
      totalBytes > maximumBytes
    ) {
      throw new ExecutionRequestError(
        (
          "Request body exceeds "
          + "the maximum permitted size."
        ),

        413,

        "REQUEST_TOO_LARGE"
      );
    }

    chunks.push(
      chunk
    );
  }

  if (
    chunks.length === 0
  ) {
    throw new ExecutionRequestError(
      "Request body is required.",

      400,

      "REQUEST_BODY_REQUIRED"
    );
  }

  let body;

  try {
    body = JSON.parse(
      Buffer.concat(
        chunks
      ).toString("utf8")
    );
  } catch {
    throw new ExecutionRequestError(
      (
        "Request body must contain "
        + "valid JSON."
      ),

      400,

      "INVALID_JSON"
    );
  }

  if (
    body === null
    || typeof body !== "object"
    || Array.isArray(body)
  ) {
    throw new ExecutionRequestError(
      (
        "Request body must be "
        + "a JSON object."
      ),

      400,

      "INVALID_REQUEST_BODY"
    );
  }

  return body;
}

function validateExecutionRequest(
  body,
  maximumSourceBytes
) {
  const {
    language,
    source
  } = body;

  if (
    typeof language !== "string"
    || !SUPPORTED_LANGUAGES.includes(
      language
    )
  ) {
    throw new ExecutionRequestError(
      (
        "A supported execution language "
        + "is required."
      ),

      400,

      "UNSUPPORTED_LANGUAGE"
    );
  }

  if (
    typeof source !== "string"
    || source.trim().length === 0
  ) {
    throw new ExecutionRequestError(
      (
        "Source code must be "
        + "a non-empty string."
      ),

      400,

      "INVALID_SOURCE"
    );
  }

  const sourceBytes = Buffer.byteLength(
    source,
    "utf8"
  );

  if (
    sourceBytes > maximumSourceBytes
  ) {
    throw new ExecutionRequestError(
      (
        "Source code exceeds "
        + "the maximum permitted size."
      ),

      413,

      "SOURCE_TOO_LARGE"
    );
  }

  return {
    language,

    source,

    sourceBytes
  };
}

async function handleExecution(
  request,
  response,
  options
) {
  const body = await readJsonBody(
    request,

    options.maximumRequestBytes
  );

  const executionRequest = (
    validateExecutionRequest(
      body,

      options.maximumSourceBytes
    )
  );

  if (
    !EXECUTION_ENABLED_LANGUAGES.includes(
      executionRequest.language
    )
  ) {
    writeJson(
      response,

      501,

      {
        status: "error",

        error: {
          code: "EXECUTION_NOT_IMPLEMENTED",

          message: (
            `${executionRequest.language} execution `
            + "has not been integrated yet."
          )
        },

        request: {
          language: (
            executionRequest.language
          ),

          sourceBytes: (
            executionRequest.sourceBytes
          )
        },

        security: {
          acceptsUntrustedCode: false,

          productionSandboxAvailable: false
        }
      }
    );

    return;
  }

  const executionResult = (
    executionRequest.language === LANGUAGES.JAVASCRIPT
      ? await executeJavaScript(
        executionRequest.source,

        options.javascript
      )
      : await executePython(
        executionRequest.source,

        options.python
      )
  );

  writeJson(
    response,

    200,

    executionResult
  );
}

async function handleRequest(
  request,
  response,
  options
) {
  const requestUrl = new URL(
    request.url,

    "http://127.0.0.1"
  );

  if (
    request.method === "GET"
    && requestUrl.pathname === "/health"
  ) {
    writeJson(
      response,

      200,

      createHealthResponse()
    );

    return;
  }

  if (
    request.method === "GET"
    && requestUrl.pathname === "/languages"
  ) {
    writeJson(
      response,

      200,

      {
        status: "ok",

        languages: (
          createLanguageCapabilities()
        )
      }
    );

    return;
  }

  if (
    request.method === "POST"
    && requestUrl.pathname === "/execute"
  ) {
    await handleExecution(
      request,

      response,

      options
    );

    return;
  }

  writeJson(
    response,

    404,

    {
      status: "error",

      error: {
        code: "ROUTE_NOT_FOUND",

        message: (
          "Execution service route was not found."
        )
      }
    }
  );
}

function createExecutionServer(
  options = {}
) {
  const maximumSourceBytes = (
    options.maximumSourceBytes
    ?? DEFAULT_MAX_SOURCE_BYTES
  );

  const maximumRequestBytes = (
    options.maximumRequestBytes
    ?? DEFAULT_MAX_REQUEST_BYTES
  );

  if (
    !Number.isInteger(
      maximumSourceBytes
    )
    || maximumSourceBytes < 1
  ) {
    throw new TypeError(
      (
        "maximumSourceBytes must be "
        + "a positive integer."
      )
    );
  }

  if (
    !Number.isInteger(
      maximumRequestBytes
    )
    || maximumRequestBytes < 1
  ) {
    throw new TypeError(
      (
        "maximumRequestBytes must be "
        + "a positive integer."
      )
    );
  }

  return http.createServer(
    (
      request,
      response
    ) => {
      handleRequest(
        request,

        response,

        {
          maximumSourceBytes,

          maximumRequestBytes,

          javascript: (
            options.javascript
            || {}
          ),

          python: (
            options.python
            || {}
          )
        }
      ).catch(
        (error) => {
          if (
            response.headersSent
          ) {
            response.end();

            return;
          }

          if (
            error instanceof ExecutionRequestError
            || error instanceof JavaScriptExecutionError
            || error instanceof PythonExecutionError
          ) {
            writeJson(
              response,

              error.statusCode,

              {
                status: "error",

                error: {
                  code: error.code,

                  message: error.message
                }
              }
            );

            return;
          }

          writeJson(
            response,

            500,

            {
              status: "error",

              error: {
                code: "INTERNAL_EXECUTION_ERROR",

                message: (
                  "Execution service could not "
                  + "process the request."
                )
              }
            }
          );
        }
      );
    }
  );
}

function startExecutionServer(
  options = {}
) {
  const host = (
    options.host
    || process.env.EXECUTION_HOST
    || DEFAULT_HOST
  );

  const port = Number(
    options.port
    || process.env.EXECUTION_PORT
    || DEFAULT_PORT
  );

  const server = createExecutionServer(
    options
  );

  server.listen(
    port,

    host,

    () => {
      console.log(
        (
          "CodeFlow execution service running at "
          + `http://${host}:${port}`
        )
      );

      console.log(
        "Security mode: local trusted development only"
      );

      console.log(
        "Real execution enabled: JavaScript, Python"
      );

      console.log(
        "Pending execution integration: Java, SQL"
      );
    }
  );

  return server;
}

if (
  require.main === module
) {
  startExecutionServer();
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

  createExecutionServer,

  startExecutionServer
};