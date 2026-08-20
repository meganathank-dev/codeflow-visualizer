"use strict";

const {
  createInitialState,
} = require("./state-reconstructor");

const ALLOWED_SPEEDS = Object.freeze([
  0.25,
  0.5,
  1,
  1.5,
  2,
]);

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return value;
}

function validateStates(states) {
  if (!Array.isArray(states)) {
    throw new TypeError("states must be an array.");
  }

  states.forEach((state, index) => {
    if (!state || typeof state !== "object") {
      throw new TypeError(
        `State at index ${index} must be an object.`
      );
    }

    if (state.step !== index) {
      throw new Error(
        `Expected state step ${index}, received ${state.step}.`
      );
    }
  });
}

function validateSpeed(speed) {
  if (!ALLOWED_SPEEDS.includes(speed)) {
    throw new RangeError(
      `Unsupported playback speed: ${speed}. ` +
        `Allowed speeds: ${ALLOWED_SPEEDS.join(", ")}.`
    );
  }
}

class TimelineController {
  constructor({
    states,
    initialState = createInitialState(),
    speed = 1,
    baseDelayMs = 1000,
    onChange = null,
  }) {
    validateStates(states);
    validateSpeed(speed);

    if (
      !Number.isFinite(baseDelayMs) ||
      baseDelayMs <= 0
    ) {
      throw new RangeError(
        "baseDelayMs must be a positive number."
      );
    }

    if (
      !initialState ||
      typeof initialState !== "object" ||
      initialState.step !== -1
    ) {
      throw new TypeError(
        "initialState must represent step -1."
      );
    }

    if (
      onChange !== null &&
      typeof onChange !== "function"
    ) {
      throw new TypeError(
        "onChange must be a function or null."
      );
    }

    this.frames = [
      clone(initialState),
      ...clone(states),
    ];

    this.cursor = 0;
    this.speed = speed;
    this.baseDelayMs = baseDelayMs;
    this.isPlaying = false;
    this.timer = null;
    this.listeners = new Set();

    if (onChange) {
      this.listeners.add(onChange);
    }
  }

  get totalSteps() {
    return this.frames.length - 1;
  }

  get currentState() {
    return this.frames[this.cursor];
  }

  get currentStep() {
    return this.currentState.step;
  }

  get isAtBeginning() {
    return this.cursor === 0;
  }

  get isAtFirstEvent() {
    return this.totalSteps > 0 && this.cursor === 1;
  }

  get isAtEnd() {
    return this.cursor === this.frames.length - 1;
  }

  getSnapshot() {
    return deepFreeze({
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      cursor: this.cursor,
      speed: this.speed,
      isPlaying: this.isPlaying,
      isAtBeginning: this.isAtBeginning,
      isAtFirstEvent: this.isAtFirstEvent,
      isAtEnd: this.isAtEnd,
      canMovePrevious: this.cursor > 0,
      canMoveNext: !this.isAtEnd,
      state: clone(this.currentState),
    });
  }

  subscribe(listener, emitCurrent = true) {
    if (typeof listener !== "function") {
      throw new TypeError(
        "Timeline listener must be a function."
      );
    }

    this.listeners.add(listener);

    if (emitCurrent) {
      listener(this.getSnapshot());
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  first() {
    this.pause();

    if (this.totalSteps === 0) {
      this.cursor = 0;
    } else {
      this.cursor = 1;
    }

    this.emitChange();
    return this.getSnapshot();
  }

  previous() {
    this.pause();

    if (this.cursor > 0) {
      this.cursor -= 1;
      this.emitChange();
    }

    return this.getSnapshot();
  }

  next() {
    this.pause();

    if (!this.isAtEnd) {
      this.cursor += 1;
      this.emitChange();
    }

    return this.getSnapshot();
  }

  last() {
    this.pause();
    this.cursor = this.frames.length - 1;
    this.emitChange();

    return this.getSnapshot();
  }

  reset() {
    this.pause();
    this.cursor = 0;
    this.emitChange();

    return this.getSnapshot();
  }

  seek(step) {
    if (
      !Number.isInteger(step) ||
      step < -1 ||
      step >= this.totalSteps
    ) {
      throw new RangeError(
        `Timeline step must be between -1 and ${
          this.totalSteps - 1
        }.`
      );
    }

    this.pause();
    this.cursor = step + 1;
    this.emitChange();

    return this.getSnapshot();
  }

  setSpeed(speed) {
    validateSpeed(speed);

    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.clearTimer();
    }

    this.speed = speed;
    this.emitChange();

    if (wasPlaying) {
      this.scheduleNextStep();
    }

    return this.getSnapshot();
  }

  play() {
    if (this.isPlaying || this.isAtEnd) {
      return this.getSnapshot();
    }

    this.isPlaying = true;
    this.emitChange();
    this.scheduleNextStep();

    return this.getSnapshot();
  }

  pause() {
    const shouldEmit =
      this.isPlaying || this.timer !== null;

    this.clearTimer();
    this.isPlaying = false;

    if (shouldEmit) {
      this.emitChange();
    }

    return this.getSnapshot();
  }

  scheduleNextStep() {
    if (!this.isPlaying) {
      return;
    }

    const delay = this.baseDelayMs / this.speed;

    this.timer = setTimeout(() => {
      this.timer = null;

      if (!this.isPlaying) {
        return;
      }

      if (!this.isAtEnd) {
        this.cursor += 1;
      }

      if (this.isAtEnd) {
        this.isPlaying = false;
      }

      this.emitChange();

      if (this.isPlaying) {
        this.scheduleNextStep();
      }
    }, delay);
  }

  clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  emitChange() {
    const snapshot = this.getSnapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  destroy() {
    this.clearTimer();
    this.isPlaying = false;
    this.listeners.clear();
  }
}

module.exports = {
  ALLOWED_SPEEDS,
  TimelineController,
};