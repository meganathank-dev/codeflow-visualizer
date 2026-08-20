"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  instrumentSource,
} = require("./instrumenter");

const {
  createRuntime,
} = require("./runtime");

function executeControlledFixture(sourcePath) {
  const absoluteSourcePath =
    path.resolve(sourcePath);

  if (!fs.existsSync(absoluteSourcePath)) {
    throw new Error(
      `JavaScript fixture not found: ${absoluteSourcePath}`
    );
  }

  const sourceCode = fs.readFileSync(
    absoluteSourcePath,
    "utf8"
  );

  const instrumentedCode =
    instrumentSource(sourceCode);

  const javascriptPocDirectory =
    path.resolve(__dirname, "..");

  const sourceFile = path
    .relative(
      javascriptPocDirectory,
      absoluteSourcePath
    )
    .replaceAll("\\", "/");

  const runtime = createRuntime({
    traceId: "javascript-automatic-basic-flow-001",
    sourceFile,
  });

  runtime.start();

  try {
    const execute = new Function(
      "__trace",
      [
        '"use strict";',
        instrumentedCode,
        `//# sourceURL=${sourceFile}`,
      ].join("\n")
    );

    execute(runtime);
    runtime.end("completed");
  } catch (error) {
    runtime.error(error, 1);
    runtime.end("error");
  }

  return runtime.getTrace();
}

function main() {
  if (process.argv.length !== 3) {
    throw new Error(
      "Usage: node runner-child.js " +
        "<controlled-fixture.js>"
    );
  }

  const trace = executeControlledFixture(
    process.argv[2]
  );

  process.stdout.write(JSON.stringify(trace));
}

try {
  main();
} catch (error) {
  console.error(
    `Automatic JavaScript runner failed: ${
      error.message
    }`
  );

  process.exitCode = 1;
}