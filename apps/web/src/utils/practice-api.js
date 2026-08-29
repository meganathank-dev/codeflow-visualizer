import { readJsonResponse } from "./http-response.js";
import { fetchWithUserSession } from "./user-platform-api.js";

const PRACTICE_LANGUAGES = Object.freeze(["javascript", "python", "java", "sql"]);
const PRACTICE_DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

async function practiceRequest(pathname, options = {}) {
  const response = await fetchWithUserSession(pathname, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers
    }
  });
  const result = await readJsonResponse(response, "Practice platform");
  if (!response.ok || result.status !== "ok") {
    throw new Error(result.error?.message || "Practice platform request failed.");
  }
  return result;
}

export function normalizePracticeFilters(input = {}) {
  return {
    difficulty: PRACTICE_DIFFICULTIES.includes(input.difficulty) ? input.difficulty : "",
    language: PRACTICE_LANGUAGES.includes(input.language) ? input.language : "",
    topic: String(input.topic || "").trim().toLowerCase()
  };
}

export function createPracticeDraft(problem, language) {
  const selectedLanguage = problem?.languages?.includes(language)
    ? language
    : problem?.languages?.[0] || "javascript";
  return {
    language: selectedLanguage,
    source: String(problem?.starterCode?.[selectedLanguage] || "")
  };
}

export function formatPracticeVerdict(verdict) {
  return ({
    accepted: "Accepted",
    passed: "Passed",
    wrong_answer: "Wrong answer",
    runtime_error: "Runtime error"
  })[verdict] || "Not evaluated";
}

export const practiceApi = {
  async problems(filters = {}) {
    const normalized = normalizePracticeFilters(filters);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(normalized)) if (value) query.set(key, value);
    const suffix = query.size ? `?${query}` : "";
    return (await practiceRequest(`/api/practice/problems${suffix}`)).problems;
  },
  async problem(slug) {
    return (await practiceRequest(`/api/practice/problems/${encodeURIComponent(slug)}`)).problem;
  },
  async run(slug, solution) {
    return practiceRequest(`/api/practice/problems/${encodeURIComponent(slug)}/run`, {
      method: "POST",
      body: JSON.stringify(solution)
    });
  },
  async submit(slug, solution) {
    return practiceRequest(`/api/practice/problems/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      body: JSON.stringify(solution)
    });
  },
  async progress() {
    return (await practiceRequest("/api/practice/progress")).progress;
  },
  async submissions(limit = 12) {
    return (await practiceRequest(`/api/practice/submissions?limit=${limit}`)).submissions;
  }
};
