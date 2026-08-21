"use strict";

const {
  StateReconstructor
} = require("./state-reconstructor");

const SUPPORTED_PLAYBACK_SPEEDS = Object.freeze([
  0.25,
  0.5,
  1,
  1.5,
  2
]);

const DEFAULT_PLAYBACK_SPEED = 1;

const DEFAULT_PLAYBACK_INTERVAL_MS = 500;

class TimelineController {
  constructor(traceOrReconstructor, options = {}) {
    const {
      checkpointInterval,

      speed = DEFAULT_PLAYBACK_SPEED,

      baseIntervalMs = DEFAULT_PLAYBACK_INTERVAL_MS
    } = options;

    if (
      !Number.isFinite(baseIntervalMs) ||
      baseIntervalMs <= 0
    ) {
      throw new TypeError(
        "baseIntervalMs must be a positive number"
      );
    }

    this.reconstructor = (
      traceOrReconstructor instanceof StateReconstructor
    )
      ? traceOrReconstructor
      : new StateReconstructor(
        traceOrReconstructor,

        checkpointInterval === undefined
          ? {}
          : {
            checkpointInterval
          }
      );

    this.currentStep = -1;

    this.isPlaying = false;

    this.baseIntervalMs = baseIntervalMs;

    this.speed = DEFAULT_PLAYBACK_SPEED;

    this.listeners = new Set();

    this.timer = null;

    this.setSpeed(
      speed,
      {
        notify: false
      }
    );
  }

  get totalSteps() {
    return this.reconstructor.totalSteps;
  }

  get lastStep() {
    return this.totalSteps - 1;
  }

  get hasEvents() {
    return this.totalSteps > 0;
  }

  get canPrevious() {
    return this.currentStep > -1;
  }

  get canNext() {
    return this.currentStep < this.lastStep;
  }

  getState() {
    return this.reconstructor.getStateAt(
      this.currentStep
    );
  }

  getCurrentEvent() {
    return this.reconstructor.getEventAt(
      this.currentStep
    );
  }

  getSnapshot() {
    return {
      currentStep: this.currentStep,

      totalSteps: this.totalSteps,

      isPlaying: this.isPlaying,

      speed: this.speed,

      canPrevious: this.canPrevious,

      canNext: this.canNext,

      event: this.getCurrentEvent(),

      state: this.getState()
    };
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError(
        "Timeline listener must be a function"
      );
    }

    this.listeners.add(
      listener
    );

    return () => {
      this.listeners.delete(
        listener
      );
    };
  }

  notifyListeners() {
    const snapshot = this.getSnapshot();

    for (const listener of this.listeners) {
      try {
        listener(
          snapshot
        );
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  seek(step) {
    if (!Number.isInteger(step)) {
      throw new TypeError(
        "Timeline step must be an integer"
      );
    }

    if (
      step < -1 ||
      step > this.lastStep
    ) {
      throw new RangeError(
        `Timeline step ${step} is outside the available range`
      );
    }

    this.currentStep = step;

    this.notifyListeners();

    return this.getSnapshot();
  }

  first() {
    if (!this.hasEvents) {
      return this.getSnapshot();
    }

    return this.seek(
      0
    );
  }

  previous() {
    if (!this.canPrevious) {
      return this.getSnapshot();
    }

    return this.seek(
      this.currentStep - 1
    );
  }

  next() {
    if (!this.canNext) {
      return this.getSnapshot();
    }

    return this.seek(
      this.currentStep + 1
    );
  }

  last() {
    if (!this.hasEvents) {
      return this.getSnapshot();
    }

    return this.seek(
      this.lastStep
    );
  }

  reset() {
    this.pause();

    return this.seek(
      -1
    );
  }

  clearPlaybackTimer() {
    if (this.timer !== null) {
      clearTimeout(
        this.timer
      );

      this.timer = null;
    }
  }

  scheduleNextStep() {
    if (
      !this.isPlaying ||
      !this.canNext
    ) {
      if (
        this.isPlaying &&
        !this.canNext
      ) {
        this.pause();
      }

      return;
    }

    const delay = Math.max(
      1,

      Math.round(
        this.baseIntervalMs / this.speed
      )
    );

    this.timer = setTimeout(() => {
      this.timer = null;

      if (!this.isPlaying) {
        return;
      }

      this.next();

      if (this.canNext) {
        this.scheduleNextStep();
      } else {
        this.pause();
      }
    }, delay);
  }

  play() {
    if (
      this.isPlaying ||
      !this.hasEvents ||
      !this.canNext
    ) {
      return this.getSnapshot();
    }

    this.isPlaying = true;

    this.notifyListeners();

    this.scheduleNextStep();

    return this.getSnapshot();
  }

  pause() {
    this.clearPlaybackTimer();

    if (this.isPlaying) {
      this.isPlaying = false;

      this.notifyListeners();
    }

    return this.getSnapshot();
  }

  setSpeed(speed, options = {}) {
    if (
      !SUPPORTED_PLAYBACK_SPEEDS.includes(speed)
    ) {
      throw new RangeError(
        `Unsupported playback speed: ${String(speed)}`
      );
    }

    this.speed = speed;

    if (this.isPlaying) {
      this.clearPlaybackTimer();

      this.scheduleNextStep();
    }

    if (options.notify !== false) {
      this.notifyListeners();
    }

    return this.speed;
  }

  destroy() {
    this.pause();

    this.listeners.clear();
  }
}

function createTimelineController(traceOrReconstructor, options) {
  return new TimelineController(
    traceOrReconstructor,
    options
  );
}

module.exports = {
  SUPPORTED_PLAYBACK_SPEEDS,

  DEFAULT_PLAYBACK_SPEED,

  DEFAULT_PLAYBACK_INTERVAL_MS,

  TimelineController,

  createTimelineController
};