"use strict";

const express = require("express");

const {
  PRACTICE_PROBLEMS,
  findPracticeProblem,
  listPracticeProblems,
  presentProblem
} = require("./catalog");

const LANGUAGES = Object.freeze(["javascript", "python", "java", "sql"]);
const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
const MAX_SOURCE_BYTES = 32 * 1024;

class PracticePlatformError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_PRACTICE_REQUEST") {
    super(message);
    this.name = "PracticePlatformError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function cleanFilter(value, allowed, field) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new PracticePlatformError(`${field} filter is invalid`, 400, "INVALID_PRACTICE_FILTER");
  }
  return value;
}

function validateSolution(problem, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PracticePlatformError("Request body must be a JSON object", 400, "INVALID_REQUEST_BODY");
  }
  const { language, source } = body;
  if (!LANGUAGES.includes(language) || !problem.languages.includes(language)) {
    throw new PracticePlatformError("Select a language supported by this problem", 400, "INVALID_PRACTICE_LANGUAGE");
  }
  if (typeof source !== "string" || !source.trim()) {
    throw new PracticePlatformError("Solution source cannot be empty", 400, "INVALID_PRACTICE_SOURCE");
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    throw new PracticePlatformError("Solution source exceeds 32 KB", 413, "PRACTICE_SOURCE_TOO_LARGE");
  }
  return { language, source };
}

function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function consoleOutput(execution) {
  const items = execution.states?.at?.(-1)?.console || [];
  return normalizeOutput(items.map((item) => item.text).filter((value) => value !== undefined).join("\n"));
}

function relationalOutput(execution) {
  return execution.states?.at?.(-1)?.query?.resultRows || [];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function failureMessage(execution) {
  return execution.states?.at?.(-1)?.errors?.at?.(-1)?.message ||
    execution.error?.message ||
    "Execution did not complete successfully.";
}

async function evaluateTest(execute, solution, test, index) {
  const response = await execute({
    language: solution.language,
    source: solution.source,
    inputs: [...test.inputs]
  });
  const execution = response.body;
  const completed = response.status === 200 && execution?.status === "ok" && execution.executionStatus === "completed";
  let actual;
  let expected;
  let passed = false;

  if (completed && solution.language === "sql") {
    actual = relationalOutput(execution);
    expected = test.expectedRows;
    passed = stableJson(actual) === stableJson(expected);
  } else if (completed) {
    actual = consoleOutput(execution);
    expected = normalizeOutput(test.expectedOutput);
    passed = actual === expected;
  }

  return {
    index,
    label: test.label,
    visibility: test.visibility,
    passed,
    verdict: completed ? (passed ? "passed" : "wrong_answer") : "runtime_error",
    inputs: test.inputs,
    expected,
    actual,
    error: completed ? "" : failureMessage(execution),
    execution
  };
}

function presentTestResult(result) {
  if (result.visibility === "hidden") {
    return {
      index: result.index,
      label: `Hidden test ${result.index + 1}`,
      visibility: "hidden",
      passed: result.passed,
      verdict: result.verdict,
      ...(result.error ? { error: "The solution did not complete for this hidden test." } : {})
    };
  }

  return {
    index: result.index,
    label: result.label,
    visibility: "public",
    passed: result.passed,
    verdict: result.verdict,
    inputs: [...result.inputs],
    expected: structuredClone(result.expected),
    actual: structuredClone(result.actual),
    ...(result.error ? { error: result.error } : {})
  };
}

function overallVerdict(results) {
  if (results.every((result) => result.passed)) return "accepted";
  if (results.some((result) => result.verdict === "runtime_error")) return "runtime_error";
  return "wrong_answer";
}

function progressFromSubmissions(submissions) {
  const attempted = new Set(submissions.map((item) => item.problemSlug));
  const accepted = new Set(
    submissions.filter((item) => item.verdict === "accepted").map((item) => item.problemSlug)
  );
  const languages = {};
  for (const item of submissions) languages[item.language] = (languages[item.language] || 0) + 1;
  return {
    problemCount: PRACTICE_PROBLEMS.length,
    attemptedCount: attempted.size,
    solvedCount: accepted.size,
    submissionCount: submissions.length,
    completionPercent: PRACTICE_PROBLEMS.length
      ? Math.round((accepted.size / PRACTICE_PROBLEMS.length) * 100)
      : 0,
    solvedProblemSlugs: [...accepted],
    languages
  };
}

function createPracticePlatform(options) {
  const execute = options.execute;
  const repository = options.repository;
  const optionalAuth = options.optionalAuth;
  const requireAuth = options.requireAuth;
  const registerVerification = options.registerVerification || (() => null);
  if (typeof execute !== "function") throw new TypeError("practice execute function is required");
  if (!repository) throw new TypeError("practice repository is required");

  const router = express.Router();

  router.get("/problems", (request, response, next) => {
    try {
      const difficulty = cleanFilter(request.query.difficulty, DIFFICULTIES, "Difficulty");
      const language = cleanFilter(request.query.language, LANGUAGES, "Language");
      const topic = typeof request.query.topic === "string" ? request.query.topic.trim().toLowerCase() : "";
      response.json({ status: "ok", problems: listPracticeProblems({ difficulty, language, topic }) });
    } catch (error) { next(error); }
  });

  router.get("/problems/:slug", (request, response, next) => {
    try {
      const problem = findPracticeProblem(request.params.slug);
      if (!problem) throw new PracticePlatformError("Practice problem was not found", 404, "PRACTICE_PROBLEM_NOT_FOUND");
      response.json({ status: "ok", problem: presentProblem(problem) });
    } catch (error) { next(error); }
  });

  router.post("/problems/:slug/run", optionalAuth, async (request, response, next) => {
    try {
      const problem = findPracticeProblem(request.params.slug);
      if (!problem) throw new PracticePlatformError("Practice problem was not found", 404, "PRACTICE_PROBLEM_NOT_FOUND");
      const solution = validateSolution(problem, request.body);
      const tests = problem.tests.filter((test) => test.visibility === "public");
      const results = [];
      for (const [index, test] of tests.entries()) results.push(await evaluateTest(execute, solution, test, index));
      const visualizationResult = results[0]?.execution || null;
      if (visualizationResult?.status === "ok") {
        visualizationResult.verification = registerVerification(solution, visualizationResult);
      }
      response.json({
        status: "ok",
        mode: "run",
        verdict: overallVerdict(results),
        passedCount: results.filter((result) => result.passed).length,
        totalCount: results.length,
        results: results.map(presentTestResult),
        visualization: visualizationResult ? { language: solution.language, source: solution.source, execution: visualizationResult } : null
      });
    } catch (error) { next(error); }
  });

  router.post("/problems/:slug/submit", requireAuth, async (request, response, next) => {
    try {
      const problem = findPracticeProblem(request.params.slug);
      if (!problem) throw new PracticePlatformError("Practice problem was not found", 404, "PRACTICE_PROBLEM_NOT_FOUND");
      const solution = validateSolution(problem, request.body);
      const results = [];
      for (const [index, test] of problem.tests.entries()) results.push(await evaluateTest(execute, solution, test, index));
      const verdict = overallVerdict(results);
      const submission = await repository.createPracticeSubmission(request.authUser.id, {
        problemSlug: problem.slug,
        problemTitle: problem.title,
        difficulty: problem.difficulty,
        language: solution.language,
        source: solution.source,
        verdict,
        passedCount: results.filter((result) => result.passed).length,
        totalCount: results.length
      });
      const publicResult = results.find((result) => result.visibility === "public" && !result.passed) ||
        results.find((result) => result.visibility === "public") || null;
      const visualizationResult = publicResult?.execution || null;
      if (visualizationResult?.status === "ok") {
        visualizationResult.verification = registerVerification(solution, visualizationResult);
      }
      response.status(201).json({
        status: "ok",
        mode: "submit",
        submission: { ...submission, source: undefined },
        verdict,
        passedCount: submission.passedCount,
        totalCount: submission.totalCount,
        results: results.map(presentTestResult),
        visualization: visualizationResult ? { language: solution.language, source: solution.source, execution: visualizationResult } : null
      });
    } catch (error) { next(error); }
  });

  router.get("/submissions", requireAuth, async (request, response, next) => {
    try {
      const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 25));
      const submissions = await repository.listPracticeSubmissions(request.authUser.id, limit);
      response.json({ status: "ok", submissions: submissions.map(({ source, ...item }) => item) });
    } catch (error) { next(error); }
  });

  router.get("/progress", requireAuth, async (request, response, next) => {
    try {
      const submissions = await repository.listPracticeSubmissions(request.authUser.id, 1000);
      response.json({ status: "ok", progress: progressFromSubmissions(submissions) });
    } catch (error) { next(error); }
  });

  return { router, problemCount: PRACTICE_PROBLEMS.length };
}

module.exports = {
  MAX_SOURCE_BYTES,
  PracticePlatformError,
  createPracticePlatform,
  normalizeOutput,
  progressFromSubmissions,
  stableJson
};
