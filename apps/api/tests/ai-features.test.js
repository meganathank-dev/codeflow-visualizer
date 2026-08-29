"use strict";

const assert = require("node:assert/strict");

const {
  EXPLANATION_MODES,
  createVerifiedExplanationService,
  extractOpenAiText
} = require("../src/ai/verified-explanation-service");

function createVerifiedRun() {
  return {
    status: "ok",
    executionStatus: "completed",
    trace: {
      traceId: "phase-10-ai-test",
      events: [
        { type: "PROGRAM_START", source: { line: 1 }, data: {} },
        { type: "LOOP_CONDITION", source: { line: 2 }, data: { result: true } },
        { type: "OUTPUT", source: { line: 3 }, data: { text: "4" } },
        { type: "PROGRAM_END", source: { line: 4 }, data: {} }
      ]
    }
  };
}

async function runTests() {
  const service = createVerifiedExplanationService({ openAiApiKey: "" });
  const verification = service.register({
    language: "javascript",
    source: "for (const value of [4]) {\n console.log(value);\n}"
  }, createVerifiedRun());

  assert.equal(typeof verification.id, "string");
  assert.equal(EXPLANATION_MODES.length, 6);

  for (const mode of EXPLANATION_MODES) {
    const result = await service.explain({
      verificationId: verification.id,
      mode,
      eventIndex: 2,
      ...(mode === "tutor" ? { question: "Why is 4 printed?" } : {})
    });
    assert.equal(result.verified, true);
    assert.equal(result.traceId, "phase-10-ai-test");
    assert.equal(result.provider, "verified-local");
    assert.ok(result.explanation.length > 20);
  }

  await assert.rejects(
    service.explain({ verificationId: "unknown", mode: "program" }),
    (error) => error.code === "VERIFIED_TRACE_EXPIRED"
  );
  assert.equal(
    extractOpenAiText({ output: [{ content: [{ type: "output_text", text: "Verified answer" }] }] }),
    "Verified answer"
  );

  console.log("Phase 10 verified AI feature tests passed.");
  console.log("Program, step, error, debugging, complexity, and tutor modes: passed");
  console.log("Expired-trace rejection and provider response parsing: passed");
}

runTests().catch((error) => {
  console.error("Phase 10 verified AI feature tests failed.");
  console.error(error);
  process.exitCode = 1;
});
