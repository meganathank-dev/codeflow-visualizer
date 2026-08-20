"use strict";

const {
  createHash,
  timingSafeEqual,
} = require("node:crypto");

const {
  validateTrace,
} = require("./trace-validator");

const TRACE_ENVELOPE_FORMAT = "codeflow-trace";
const TRACE_ENVELOPE_VERSION = "1.0.0";
const DEFAULT_MAX_SERIALIZED_BYTES = 5 * 1024 * 1024;

class TraceSerializationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TraceSerializationError";
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return value;
}

function validateMaximumBytes(maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError(
      "maxBytes must be a positive integer."
    );
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value !== null && typeof value === "object") {
    const sortedObject = {};

    for (const key of Object.keys(value).sort()) {
      sortedObject[key] = canonicalize(value[key]);
    }

    return sortedObject;
  }

  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function calculateChecksum(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function checksumsMatch(expected, actual) {
  if (
    typeof expected !== "string" ||
    typeof actual !== "string" ||
    !/^[a-f0-9]{64}$/i.test(expected) ||
    !/^[a-f0-9]{64}$/i.test(actual)
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    actualBuffer
  );
}

function serializeTrace(
  trace,
  {
    maxBytes = DEFAULT_MAX_SERIALIZED_BYTES,
    validationLimits,
  } = {}
) {
  validateMaximumBytes(maxBytes);
  validateTrace(trace, validationLimits);

  const traceCopy = structuredClone(trace);
  const canonicalTrace = canonicalStringify(traceCopy);
  const checksum = calculateChecksum(canonicalTrace);

  const envelope = {
    format: TRACE_ENVELOPE_FORMAT,
    formatVersion: TRACE_ENVELOPE_VERSION,
    checksumAlgorithm: "sha256",
    checksum,
    trace: traceCopy,
  };

  const serializedEnvelope = JSON.stringify(envelope);
  const serializedBytes = Buffer.byteLength(
    serializedEnvelope,
    "utf8"
  );

  if (serializedBytes > maxBytes) {
    throw new TraceSerializationError(
      `Serialized trace size ${serializedBytes} bytes exceeds the maximum of ${maxBytes} bytes.`
    );
  }

  return serializedEnvelope;
}

function deserializeTrace(
  serializedEnvelope,
  {
    maxBytes = DEFAULT_MAX_SERIALIZED_BYTES,
    validationLimits,
  } = {}
) {
  validateMaximumBytes(maxBytes);

  if (typeof serializedEnvelope !== "string") {
    throw new TypeError(
      "serializedEnvelope must be a string."
    );
  }

  const serializedBytes = Buffer.byteLength(
    serializedEnvelope,
    "utf8"
  );

  if (serializedBytes > maxBytes) {
    throw new TraceSerializationError(
      `Serialized trace size ${serializedBytes} bytes exceeds the maximum of ${maxBytes} bytes.`
    );
  }

  let envelope;

  try {
    envelope = JSON.parse(serializedEnvelope);
  } catch (error) {
    throw new TraceSerializationError(
      `Trace envelope contains invalid JSON: ${error.message}`
    );
  }

  if (
    envelope === null ||
    typeof envelope !== "object" ||
    Array.isArray(envelope)
  ) {
    throw new TraceSerializationError(
      "Trace envelope must be an object."
    );
  }

  if (envelope.format !== TRACE_ENVELOPE_FORMAT) {
    throw new TraceSerializationError(
      `Unsupported trace envelope format "${envelope.format}".`
    );
  }

  if (
    envelope.formatVersion !==
    TRACE_ENVELOPE_VERSION
  ) {
    throw new TraceSerializationError(
      `Unsupported trace envelope version "${envelope.formatVersion}".`
    );
  }

  if (envelope.checksumAlgorithm !== "sha256") {
    throw new TraceSerializationError(
      `Unsupported checksum algorithm "${envelope.checksumAlgorithm}".`
    );
  }

  if (
    envelope.trace === null ||
    typeof envelope.trace !== "object" ||
    Array.isArray(envelope.trace)
  ) {
    throw new TraceSerializationError(
      "Trace envelope does not contain a valid trace object."
    );
  }

  const canonicalTrace = canonicalStringify(
    envelope.trace
  );

  const calculatedChecksum =
    calculateChecksum(canonicalTrace);

  if (
    !checksumsMatch(
      envelope.checksum,
      calculatedChecksum
    )
  ) {
    throw new TraceSerializationError(
      "Trace checksum validation failed. The trace may be corrupted or modified."
    );
  }

  validateTrace(
    envelope.trace,
    validationLimits
  );

  return deepFreeze(
    structuredClone(envelope.trace)
  );
}

module.exports = {
  DEFAULT_MAX_SERIALIZED_BYTES,
  TRACE_ENVELOPE_FORMAT,
  TRACE_ENVELOPE_VERSION,
  TraceSerializationError,
  canonicalStringify,
  deserializeTrace,
  serializeTrace,
};