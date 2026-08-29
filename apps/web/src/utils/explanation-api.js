import { readJsonResponse } from "./http-response.js";
import { fetchWithUserSession } from "./user-platform-api.js";

export async function requestVerifiedExplanation(input, signal) {
  const response = await fetchWithUserSession("/api/ai/explain", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
    signal
  });
  const result = await readJsonResponse(response, "Verified explanation service");

  if (!response.ok || result.status !== "ok") {
    const error = new Error(result.error?.message || "The verified explanation could not be generated.");
    error.code = result.error?.code || "EXPLANATION_FAILED";
    throw error;
  }

  return result;
}
