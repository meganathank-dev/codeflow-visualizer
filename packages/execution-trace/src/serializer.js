"use strict";

const {
  createHash,
  timingSafeEqual
} = require("node:crypto");

const {
  TRACE_FORMAT,
  TRACE_FORMAT_VERSION,

  DEFAULT_MAX_SERIALIZED_BYTES
} = require("./constants");

const {
  assertValidTrace
} = require("./validator");

class TraceSerializationError extends Error {
  constructor(message) {
    super(message);

    this.name = "TraceSerializationError";
  }
}

function normalizeForStableSerialization(value) {
  if (Array.isArray(value)) {
    return value.map(
      normalizeForStableSerialization
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          normalizeForStableSerialization(
            value[key]
          )
        ])
    );
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(
    normalizeForStableSerialization(value)
  );
}

function calculateTraceChecksum(trace) {
  assertValidTrace(
    trace
  );

  return createHash("sha256")
    .update(
      stableStringify(trace),
      "utf8"
    )
    .digest("hex");
}

function normalizeMaximumBytes(value) {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new TypeError(
      "maxBytes must be a positive integer"
    );
  }

  return value;
}

function assertWithinMaximumSize(value, maxBytes) {
  const actualBytes = Buffer.byteLength(
    value,
    "utf8"
  );

  if (actualBytes > maxBytes) {
    throw new TraceSerializationError(
      `Serialized trace exceeds maximum size: ${actualBytes} > ${maxBytes} bytes`
    );
  }
}

function serializeTrace(trace, options = {}) {
  const {
    pretty = false,

    maxBytes = DEFAULT_MAX_SERIALIZED_BYTES
  } = options;

  const normalizedMaximumBytes = normalizeMaximumBytes(
    maxBytes
  );

  assertValidTrace(
    trace
  );

  const envelope = {
    format: TRACE_FORMAT,

    formatVersion: TRACE_FORMAT_VERSION,

    checksumAlgorithm: "sha256",

    checksum: calculateTraceChecksum(
      trace
    ),

    trace
  };

  const serialized = pretty
    ? JSON.stringify(envelope, null, 2)
    : JSON.stringify(envelope);

  assertWithinMaximumSize(
    serialized,
    normalizedMaximumBytes
  );

  return serialized;
}

function verifyChecksum(actualChecksum, expectedChecksum) {
  if (
    typeof actualChecksum !== "string" ||
    !/^[a-f0-9]{64}$/i.test(actualChecksum)
  ) {
    throw new TraceSerializationError(
      "Trace checksum must be a valid SHA-256 hexadecimal value"
    );
  }

  const actualBuffer = Buffer.from(
    actualChecksum,
    "hex"
  );

  const expectedBuffer = Buffer.from(
    expectedChecksum,
    "hex"
  );

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(
      actualBuffer,
      expectedBuffer
    )
  ) {
    throw new TraceSerializationError(
      "Trace checksum mismatch: serialized trace may have been modified"
    );
  }
}

function deserializeTrace(serialized, options = {}) {
  const {
    maxBytes = DEFAULT_MAX_SERIALIZED_BYTES
  } = options;

  const normalizedMaximumBytes = normalizeMaximumBytes(
    maxBytes
  );

  if (
    typeof serialized !== "string" ||
    serialized.trim().length === 0
  ) {
    throw new TraceSerializationError(
      "Serialized trace must be a non-empty string"
    );
  }

  assertWithinMaximumSize(
    serialized,
    normalizedMaximumBytes
  );

  let envelope;

  try {
    envelope = JSON.parse(
      serialized
    );
  } catch {
    throw new TraceSerializationError(
      "Serialized trace contains invalid JSON"
    );
  }

  if (
    envelope === null ||
    typeof envelope !== "object" ||
    Array.isArray(envelope)
  ) {
    throw new TraceSerializationError(
      "Serialized trace envelope must be an object"
    );
  }

  if (envelope.format !== TRACE_FORMAT) {
    throw new TraceSerializationError(
      `Unsupported trace format: ${String(envelope.format)}`
    );
  }

  if (envelope.formatVersion !== TRACE_FORMAT_VERSION) {
    throw new TraceSerializationError(
      `Unsupported trace format version: ${String(envelope.formatVersion)}`
    );
  }

  if (envelope.checksumAlgorithm !== "sha256") {
    throw new TraceSerializationError(
      `Unsupported checksum algorithm: ${String(envelope.checksumAlgorithm)}`
    );
  }

  assertValidTrace(
    envelope.trace
  );

  const expectedChecksum = calculateTraceChecksum(
    envelope.trace
  );

  verifyChecksum(
    envelope.checksum,
    expectedChecksum
  );

  return envelope.trace;
}

module.exports = {
  TraceSerializationError,

  stableStringify,

  calculateTraceChecksum,

  serializeTrace,
  deserializeTrace
};