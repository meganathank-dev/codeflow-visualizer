export class ApiResponseError extends Error {
  constructor(message, code, status = null) {
    super(message);
    this.name = "ApiResponseError";
    this.code = code;
    this.status = status;
  }
}

export async function readJsonResponse(response, serviceName = "API") {
  const body = await response.text();

  if (!body.trim()) {
    throw new ApiResponseError(
      `${serviceName} returned an empty response (HTTP ${response.status}).`,
      "EMPTY_RESPONSE",
      response.status
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ApiResponseError(
      `${serviceName} returned invalid JSON (HTTP ${response.status}).`,
      "INVALID_JSON_RESPONSE",
      response.status
    );
  }
}
