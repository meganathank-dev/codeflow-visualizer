import assert from "node:assert/strict";

const requests = [];
let releaseRequest;

globalThis.fetch = (url, options) => {
  requests.push({ url, options });
  return new Promise((resolve) => {
    releaseRequest = () => resolve({ type: "opaque" });
  });
};

const { wakeExecutionService } = await import(
  "../src/utils/execution-reliability.js"
);

const firstWake = wakeExecutionService("https://execution.example/health");
const sharedWake = wakeExecutionService("https://execution.example/health");

assert.equal(requests.length, 1);
assert.equal(requests[0].url, "https://execution.example/health");
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.mode, "no-cors");
assert.equal(requests[0].options.credentials, "omit");

releaseRequest();

assert.equal(await firstWake, true);
assert.equal(await sharedWake, true);

console.log("Execution-service wake-up tests passed.");
console.log("Direct cross-origin wake request: passed");
console.log("Concurrent wake request sharing: passed");
console.log("Service credential isolation: passed");
