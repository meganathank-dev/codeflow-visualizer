"use strict";

const { randomUUID } = require("node:crypto");

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,100}$/;

function createRequestObservability(options = {}) {
  const logger = options.logger || console;
  const structuredLogs = options.structuredLogs === true;
  const service = options.service || "codeflow-api";

  return function requestObservability(request, response, next) {
    const incomingId = request.get("x-request-id");
    const requestId = REQUEST_ID_PATTERN.test(incomingId || "") ? incomingId : randomUUID();
    const startedAt = process.hrtime.bigint();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    if (structuredLogs) {
      response.once("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        logger.info(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: response.statusCode >= 500 ? "error" : "info",
          service,
          event: "http_request",
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 100) / 100
        }));
      });
    }
    next();
  };
}

module.exports = { REQUEST_ID_PATTERN, createRequestObservability };
