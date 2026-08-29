"use strict";

const express = require("express");

const { SUPPORTED_LANGUAGES } = require("@codeflow/execution-trace");
const { createVerifiedExplanationService } = require("./ai/verified-explanation-service");
const { createMemoryUserRepository } = require("./user-platform/memory-repository");
const { createUserPlatform } = require("./user-platform/platform");

const DEFAULT_EXECUTION_SERVICE_URL = "http://127.0.0.1:4100";
// Keep the API timeout above the execution-service process timeout. Java must
// compile and start its JDI debugger before producing a trace, so its cold
// execution path can legitimately take longer than JavaScript or Python.
const DEFAULT_REQUEST_TIMEOUT_MS = 50_000;
const DEFAULT_MAX_SOURCE_BYTES = 32 * 1024;
const DEFAULT_MAX_INPUT_ITEMS = 20;
const DEFAULT_MAX_INPUT_ITEM_BYTES = 512;
const DEFAULT_MAX_INPUT_BYTES = 4 * 1024;
const DEFAULT_ACCESS_TOKEN_SECRET = "codeflow-local-access-secret-change-me";
const DEFAULT_REFRESH_TOKEN_SECRET = "codeflow-local-refresh-secret-change-me";

class ApiRequestError extends Error {
  constructor(message, statusCode, code) {
    super(message);

    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeExecutionServiceUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("executionServiceUrl must be a non-empty string");
  }

  return value.replace(/\/+$/, "");
}

function createExecutionClient(options) {
  const executionServiceUrl = normalizeExecutionServiceUrl(
    options.executionServiceUrl
  );

  async function request(pathname, requestOptions = {}) {
    let response;

    try {
      response = await fetch(`${executionServiceUrl}${pathname}`, {
        ...requestOptions,
        headers: {
          "content-type": "application/json",
          ...requestOptions.headers
        },
        signal: AbortSignal.timeout(options.requestTimeoutMs)
      });
    } catch (error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new ApiRequestError(
          "Execution service exceeded the request timeout",
          504,
          "EXECUTION_SERVICE_TIMEOUT"
        );
      }

      throw new ApiRequestError(
        "Execution service is unavailable",
        503,
        "EXECUTION_SERVICE_UNAVAILABLE"
      );
    }

    let body;

    try {
      body = await response.json();
    } catch {
      throw new ApiRequestError(
        "Execution service returned an invalid response",
        502,
        "INVALID_EXECUTION_SERVICE_RESPONSE"
      );
    }

    return { status: response.status, body };
  }

  return { request };
}

function validateExecutionRequest(body, maximumSourceBytes) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiRequestError(
      "Request body must be a JSON object",
      400,
      "INVALID_REQUEST_BODY"
    );
  }

  const { language, source } = body;
  const inputs = body.inputs ?? [];

  if (typeof language !== "string" || !SUPPORTED_LANGUAGES.includes(language)) {
    throw new ApiRequestError(
      "A supported execution language is required",
      400,
      "UNSUPPORTED_LANGUAGE"
    );
  }

  if (typeof source !== "string" || source.trim().length === 0) {
    throw new ApiRequestError(
      "Source code must be a non-empty string",
      400,
      "INVALID_SOURCE"
    );
  }

  if (Buffer.byteLength(source, "utf8") > maximumSourceBytes) {
    throw new ApiRequestError(
      "Source code exceeds the maximum permitted size",
      413,
      "SOURCE_TOO_LARGE"
    );
  }

  if (!Array.isArray(inputs) || inputs.some((value) => typeof value !== "string")) {
    throw new ApiRequestError(
      "Program inputs must be an array of strings",
      400,
      "INVALID_INPUTS"
    );
  }

  if (inputs.length > DEFAULT_MAX_INPUT_ITEMS) {
    throw new ApiRequestError(
      `Program input is limited to ${DEFAULT_MAX_INPUT_ITEMS} lines`,
      413,
      "INPUT_LIMIT_EXCEEDED"
    );
  }

  if (inputs.some((value) => Buffer.byteLength(value, "utf8") > DEFAULT_MAX_INPUT_ITEM_BYTES)) {
    throw new ApiRequestError(
      `Each program input line is limited to ${DEFAULT_MAX_INPUT_ITEM_BYTES} bytes`,
      413,
      "INPUT_LINE_TOO_LARGE"
    );
  }

  if (Buffer.byteLength(inputs.join("\n"), "utf8") > DEFAULT_MAX_INPUT_BYTES) {
    throw new ApiRequestError(
      `Program input is limited to ${DEFAULT_MAX_INPUT_BYTES} bytes`,
      413,
      "INPUT_TOO_LARGE"
    );
  }

  if (language === "sql" && inputs.length > 0) {
    throw new ApiRequestError(
      "SQL execution does not accept program input",
      400,
      "INPUT_NOT_SUPPORTED"
    );
  }

  return { language, source, inputs: [...inputs] };
}

function createApiApp(options = {}) {
  const executionServiceUrl = normalizeExecutionServiceUrl(
    options.executionServiceUrl ||
    process.env.EXECUTION_SERVICE_URL ||
    DEFAULT_EXECUTION_SERVICE_URL
  );

  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maximumSourceBytes = options.maximumSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) {
    throw new TypeError("requestTimeoutMs must be a positive integer");
  }

  if (!Number.isInteger(maximumSourceBytes) || maximumSourceBytes < 1) {
    throw new TypeError("maximumSourceBytes must be a positive integer");
  }

  const executionClient = createExecutionClient({
    executionServiceUrl,
    requestTimeoutMs
  });

  const explanationService = options.explanationService || createVerifiedExplanationService({
    openAiApiKey: options.openAiApiKey,
    openAiModel: options.openAiModel,
    fetchImplementation: options.aiFetchImplementation
  });

  const configuredAccessSecret = options.accessTokenSecret || process.env.ACCESS_TOKEN_SECRET;
  const configuredRefreshSecret = options.refreshTokenSecret || process.env.REFRESH_TOKEN_SECRET;

  if (process.env.NODE_ENV === "production" && (!configuredAccessSecret || !configuredRefreshSecret)) {
    throw new TypeError("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET are required in production");
  }

  const userPlatform = createUserPlatform({
    repository: options.userRepository || createMemoryUserRepository(),
    accessTokenSecret: configuredAccessSecret || DEFAULT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: configuredRefreshSecret || DEFAULT_REFRESH_TOKEN_SECRET,
    secureCookies: options.secureCookies ?? process.env.NODE_ENV === "production",
    passwordResetDelivery: options.passwordResetDelivery,
    exposePasswordResetToken: options.exposePasswordResetToken ?? process.env.NODE_ENV !== "production"
  });

  const app = express();

  app.disable("x-powered-by");

  app.use((request, response, next) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    next();
  });

  app.use(express.json({ limit: "64kb", strict: true }));

  app.get("/api/health", async (request, response, next) => {
    try {
      const executionHealth = await executionClient.request("/health");
      const connected = executionHealth.status === 200;

      response.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "degraded",
        service: "codeflow-api",
        executionService: {
          connected,
          status: executionHealth.body.status,
          enabledLanguages: executionHealth.body.executionEnabledLanguages || [],
          security: executionHealth.body.security || null
        },
        languages: SUPPORTED_LANGUAGES,
        userPlatform: {
          connected: true,
          storage: userPlatform.repository.kind
        },
        ai: {
          verifiedTraceOnly: true,
          configured: explanationService.configured,
          provider: explanationService.provider
        }
      });
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        ["EXECUTION_SERVICE_UNAVAILABLE", "EXECUTION_SERVICE_TIMEOUT"].includes(error.code)
      ) {
        response.status(503).json({
          status: "degraded",
          service: "codeflow-api",
          executionService: {
            connected: false,
            status: "offline",
            enabledLanguages: [],
            security: null
          },
          languages: SUPPORTED_LANGUAGES,
          userPlatform: {
            connected: true,
            storage: userPlatform.repository.kind
          },
          ai: {
            verifiedTraceOnly: true,
            configured: explanationService.configured,
            provider: explanationService.provider
          }
        });

        return;
      }

      next(error);
    }
  });

  app.get("/api/languages", async (request, response, next) => {
    try {
      const languages = await executionClient.request("/languages");
      response.status(languages.status).json(languages.body);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/execute", userPlatform.optionalAuth, async (request, response, next) => {
    try {
      const requestStartedAt = Date.now();
      const executionRequest = validateExecutionRequest(
        request.body,
        maximumSourceBytes
      );

      const executionResult = await executionClient.request("/execute", {
        method: "POST",
        body: JSON.stringify(executionRequest)
      });

      if (executionResult.status === 200 && executionResult.body?.status === "ok") {
        const verification = explanationService.register(executionRequest, executionResult.body);
        if (verification) executionResult.body.verification = verification;
        executionResult.body.reliability = {
          apiDurationMs: Date.now() - requestStartedAt,
          timeoutMs: requestTimeoutMs,
          processStoppedSafely: false
        };
        await userPlatform.recordExecution(
          request.authUser,
          executionRequest,
          executionResult.body
        );
      }

      response.setHeader("x-codeflow-execution-ms", String(Date.now() - requestStartedAt));
      response.status(executionResult.status).json(executionResult.body);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/explain", userPlatform.optionalAuth, async (request, response, next) => {
    try {
      response.json({ status: "ok", ...(await explanationService.explain(request.body)) });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", userPlatform.router);

  app.use((request, response) => {
    response.status(404).json({
      status: "error",
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "API route was not found"
      }
    });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error.type === "entity.too.large") {
      response.status(413).json({
        status: "error",
        error: {
          code: "REQUEST_TOO_LARGE",
          message: "Request body exceeds the maximum permitted size"
        }
      });

      return;
    }

    if (error.type === "entity.parse.failed") {
      response.status(400).json({
        status: "error",
        error: {
          code: "INVALID_JSON",
          message: "Request body must contain valid JSON"
        }
      });

      return;
    }

    if (error instanceof ApiRequestError) {
      response.status(error.statusCode).json({
        status: "error",
        error: {
          code: error.code,
          message: error.message
        }
      });

      return;
    }

    if (Number.isInteger(error.statusCode) && typeof error.code === "string") {
      response.status(error.statusCode).json({
        status: "error",
        error: {
          code: error.code,
          message: error.message
        }
      });

      return;
    }

    if (error?.code === 11000) {
      response.status(409).json({
        status: "error",
        error: {
          code: "RESOURCE_ALREADY_EXISTS",
          message: "A record with this value already exists"
        }
      });

      return;
    }

    response.status(500).json({
      status: "error",
      error: {
        code: "INTERNAL_API_ERROR",
        message: "API could not process the request"
      }
    });
  });

  return app;
}

module.exports = {
  DEFAULT_EXECUTION_SERVICE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_SOURCE_BYTES,
  ApiRequestError,
  createApiApp
};
