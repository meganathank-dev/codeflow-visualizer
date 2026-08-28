function findLastExecutionError(result) {
  const stateError = result?.states
    ?.slice()
    .reverse()
    .find((state) => state?.errors?.length)
    ?.errors?.at(-1);

  if (stateError) {
    return stateError;
  }

  return result?.trace?.events
    ?.slice()
    .reverse()
    .find((event) => event?.type === "ERROR" || event?.type === "EXCEPTION_THROW")
    ?.payload ?? null;
}

export function getPendingInputRequest(result, fallbackInputNumber = 1) {
  const error = findLastExecutionError(result);

  if (error?.code !== "INPUT_EXHAUSTED" && error?.category !== "input") {
    return null;
  }

  const inputNumber = Number.isInteger(error.inputRequest?.inputNumber)
    ? error.inputRequest.inputNumber
    : fallbackInputNumber;
  const prompt = String(error.inputRequest?.prompt ?? "").trim();

  return {
    inputNumber,
    prompt: prompt || `Enter input #${inputNumber}:`,
    sourceExcerpt: error.sourceExcerpt ?? null
  };
}

export async function executeWithInteractiveInputs({ execute, requestInput }) {
  const inputs = [];

  while (true) {
    const result = await execute([...inputs]);
    const pendingInput = getPendingInputRequest(result, inputs.length + 1);

    if (!pendingInput) {
      return { cancelled: false, inputs, result };
    }

    const answer = await requestInput(pendingInput);

    if (!answer?.confirmed) {
      return { cancelled: true, inputs, result };
    }

    inputs.push(String(answer.value ?? ""));
  }
}
