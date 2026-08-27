export class ApiResponseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ApiResponseError";
    this.code = code;
  }
}

export async function readJsonResponse(response, serviceLabel) {
  let bodyText;

  try {
    bodyText = await response.text();
  } catch {
    throw new ApiResponseError(
      `${serviceLabel} connection was interrupted. Wait a moment and try again.`,
      "RESPONSE_READ_FAILED"
    );
  }

  if (!bodyText.trim()) {
    throw new ApiResponseError(
      `${serviceLabel} returned an empty response. The local API may be restarting; wait a moment and try again.`,
      "EMPTY_RESPONSE"
    );
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new ApiResponseError(
      `${serviceLabel} returned an invalid response (HTTP ${response.status}).`,
      "INVALID_JSON_RESPONSE"
    );
  }
}
