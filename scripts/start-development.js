"use strict";

const { spawn } = require("node:child_process");

const IS_WINDOWS = process.platform === "win32";
const children = [];
let stopping = false;

function createPnpmInvocation(filter, platform = process.platform, comspec = process.env.ComSpec) {
  if (platform === "win32") {
    return {
      command: comspec || "cmd.exe",
      args: ["/d", "/s", "/c", `pnpm --filter ${filter} dev`]
    };
  }

  return {
    command: "pnpm",
    args: ["--filter", filter, "dev"]
  };
}

function startWorkspace(name, filter) {
  const invocation = createPnpmInvocation(filter);
  const child = spawn(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: false
  });

  children.push(child);
  child.once("error", (error) => {
    if (!stopping) {
      console.error(`${name} could not start: ${error.message}`);
      stopAll(1);
    }
  });
  child.once("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`${name} stopped unexpectedly (${signal || `exit ${code}`}).`);
      stopAll(1);
    }
  });
  return child;
}

async function waitForUrl(name, url, timeoutMs = 45_000) {
  const startedAt = Date.now();
  let attempts = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(1_500)
      });
      if (response.ok) {
        console.log(`${name} ready after ${attempts} check${attempts === 1 ? "" : "s"}.`);
        return;
      }
    } catch {
      // The service is still binding its port or initializing dependencies.
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(300 + attempts * 120, 1_200)));
  }

  throw new Error(`${name} did not become ready within ${Math.round(timeoutMs / 1_000)} seconds.`);
}

function terminateChild(child) {
  if (!child.pid || child.killed) return;

  if (IS_WINDOWS) {
    const commandProcessor = process.env.ComSpec || "cmd.exe";
    const terminator = spawn(
      commandProcessor,
      ["/d", "/s", "/c", `taskkill /pid ${child.pid} /t /f`],
      { stdio: "ignore", windowsHide: true }
    );
    terminator.unref();
    return;
  }

  child.kill("SIGTERM");
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    terminateChild(child);
  }
  setTimeout(() => process.exit(exitCode), 300);
}

async function main() {
  console.log("Starting CodeFlow services in readiness order…");

  startWorkspace("Execution service", "@codeflow/execution");
  await waitForUrl("Execution service", "http://127.0.0.1:4100/health");

  startWorkspace("API", "@codeflow/api");
  await waitForUrl("API", "http://127.0.0.1:4000/api/health");

  startWorkspace("Web application", "@codeflow/web");
  console.log("CodeFlow development services started. Open http://127.0.0.1:5173/");
}

if (require.main === module) {
  process.once("SIGINT", () => stopAll(0));
  process.once("SIGTERM", () => stopAll(0));

  main().catch((error) => {
    console.error(`CodeFlow development startup failed: ${error.message}`);
    stopAll(1);
  });
}

module.exports = { createPnpmInvocation };
