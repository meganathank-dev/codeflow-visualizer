const FRIENDLY_EXECUTION_ERRORS = Object.freeze({
  EXECUTION_TIMEOUT: "The program exceeded its safe language timeout. Check for an infinite loop, excessive recursion, or unusually large work before trying again.",
  EXECUTION_SERVICE_TIMEOUT: "The execution service did not finish in time. The process was stopped safely; wait for service readiness and try once more.",
  EXECUTION_SERVICE_UNAVAILABLE: "The execution service is still starting or temporarily unavailable. CodeFlow will recheck it before the next run.",
  JAVA_RUNTIME_UNAVAILABLE: "The Java compiler or debugger could not start. Verify the JDK installation and try again.",
  TRACE_RESPONSE_TOO_LARGE: "The execution produced more trace data than the visualizer can safely display. Reduce the loop or input size."
});

export function getExecutionTimeoutMs(language) {
  return language === "java" ? 45_000 : language === "python" ? 30_000 : 25_000;
}

export function createExecutionFailure(result, languageLabel = "Program") {
  const code = result?.error?.code || "EXECUTION_FAILED";
  const error = new Error(
    FRIENDLY_EXECUTION_ERRORS[code] || result?.error?.message || `${languageLabel} execution failed.`
  );
  error.code = code;
  error.retryable = ["EXECUTION_SERVICE_TIMEOUT", "EXECUTION_SERVICE_UNAVAILABLE"].includes(code);
  return error;
}

export async function waitForBackendReady({ probe, attempts = 4, delayMs = 600, signal }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Execution cancelled", "AbortError");
    try {
      if (await probe()) return { ready: true, attempts: attempt };
    } catch {
      // Startup connection failures are expected while the API and database initialize.
    }
    if (attempt < attempts) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs * attempt);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Execution cancelled", "AbortError"));
        }, { once: true });
      });
    }
  }
  return { ready: false, attempts };
}

export function getExecutionStage(language, elapsedSeconds = 0) {
  const normalizedLanguage = String(language || "program").toLowerCase();
  if (elapsedSeconds < 1) return "Checking execution services";
  if (normalizedLanguage === "java" && elapsedSeconds < 5) return "Compiling Java and starting the debugger";
  if (elapsedSeconds < 5) return `Starting the ${language} runtime`;
  return `Recording verified events · ${elapsedSeconds}s`;
}
