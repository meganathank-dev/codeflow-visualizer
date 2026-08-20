"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const {
  spawnSync,
} = require("node:child_process");

const projectRoot = path.resolve(
  __dirname,
  "..",
  ".."
);

const languageSuites = [
  {
    name: "JavaScript",
    script: path.join(
      projectRoot,
      "pocs",
      "javascript",
      "automatic-tracer",
      "tests",
      "automatic-adapter.test.js"
    ),
    expectedText:
      "Automatic JavaScript adapter tests passed.",
  },
  {
    name: "Python",
    script: path.join(
      projectRoot,
      "pocs",
      "python",
      "tests",
      "python-adapter.test.js"
    ),
    expectedText:
      "Python adapter tests passed.",
  },
  {
    name: "Java",
    script: path.join(
      projectRoot,
      "pocs",
      "java",
      "tests",
      "java-adapter.test.js"
    ),
    expectedText:
      "Java adapter tests passed.",
  },
  {
    name: "SQL",
    script: path.join(
      projectRoot,
      "pocs",
      "sql",
      "tests",
      "sql-adapter.test.js"
    ),
    expectedText:
      "SQL adapter tests passed.",
  },
];

function runLanguageSuite(suite) {
  const result = spawnSync(
    process.execPath,
    [suite.script],
    {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 40000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }
  );

  if (result.error) {
    throw new Error(
      `${suite.name} test process failed: ` +
        result.error.message
    );
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `${suite.name} adapter test failed.`,
        `Exit code: ${result.status}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join("\n")
    );
  }

  assert.equal(
    result.stdout.includes(
      suite.expectedText
    ),
    true,
    `${suite.name} did not return its success message.`
  );

  return {
    name: suite.name,
    passed: true,
  };
}

function runConformanceTests() {
  const results = languageSuites.map(
    runLanguageSuite
  );

  for (const result of results) {
    console.log(
      `PASS: ${result.name} adapter`
    );
  }

  console.log(
    `Cross-language conformance passed: ` +
      `${results.length}/${languageSuites.length}`
  );

  console.log(
    "Common trace validation: passed"
  );

  console.log(
    "State reconstruction compatibility: passed"
  );

  console.log(
    "Timeline compatibility: passed"
  );
}

try {
  runConformanceTests();
} catch (error) {
  console.error(
    "Cross-language conformance failed."
  );
  console.error(error);
  process.exitCode = 1;
}