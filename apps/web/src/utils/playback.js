export const DEFAULT_PLAYBACK_INTERVAL = 1_100;

const EVENT_DWELL_MULTIPLIERS = Object.freeze({
  PROGRAM_START: 1.2,
  PROGRAM_END: 1.35,
  SQL_QUERY_START: 1.2,
  SQL_QUERY_END: 1.35,
  INPUT: 1.35,
  OUTPUT: 1.25,
  ERROR: 1.55,
  EXCEPTION_THROW: 1.55,
  FUNCTION_ENTER: 1.2,
  FUNCTION_RETURN: 1.3,
  CONDITION_EVALUATE: 1.2,
  LOOP_CONDITION: 1.15,
  RECURSION_BASE_CASE: 1.4,
  HANOI_MOVE: 1.2,
  DP_RESULT: 1.35,
  STATEMENT_EXECUTE: 0.82,
  VARIABLE_READ: 0.88
});

export function getPlaybackDelay(eventType, speed = 1) {
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const multiplier = EVENT_DWELL_MULTIPLIERS[eventType] ?? 1;

  return Math.max(
    220,
    Math.round((DEFAULT_PLAYBACK_INTERVAL * multiplier) / safeSpeed)
  );
}

export function getPlaybackSpeedDescription(speed) {
  if (speed <= 0.25) return "Very slow";
  if (speed <= 0.5) return "Slow";
  if (speed <= 1) return "Readable";
  if (speed <= 1.5) return "Fast";
  return "Very fast";
}

export function shouldAutoPlayFreshTrace(executionStatus, totalSteps) {
  return executionStatus !== "failed" && totalSteps > 1;
}

export function getPrimaryActionLabel({
  isExecuting = false,
  isPlaying = false,
  supportsLiveExecution = false,
  hasLiveExecution = false,
  isAtFinalStep = false
} = {}) {
  if (isExecuting) return "Cancel run";
  if (isPlaying) return "Pause";

  if (!supportsLiveExecution) {
    return "Preview demo";
  }

  if (!hasLiveExecution) {
    return "Run code";
  }

  if (isAtFinalStep) {
    return "Run again";
  }

  return "Resume";
}
