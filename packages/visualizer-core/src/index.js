"use strict";

const {
  DEFAULT_CHECKPOINT_INTERVAL,

  createInitialState,

  reduceExecutionEvent,

  StateReconstructor,

  createStateReconstructor
} = require("./state-reconstructor");

const {
  SUPPORTED_PLAYBACK_SPEEDS,

  DEFAULT_PLAYBACK_SPEED,

  DEFAULT_PLAYBACK_INTERVAL_MS,

  TimelineController,

  createTimelineController
} = require("./timeline-controller");

module.exports = {
  DEFAULT_CHECKPOINT_INTERVAL,

  createInitialState,

  reduceExecutionEvent,

  StateReconstructor,

  createStateReconstructor,

  SUPPORTED_PLAYBACK_SPEEDS,

  DEFAULT_PLAYBACK_SPEED,

  DEFAULT_PLAYBACK_INTERVAL_MS,

  TimelineController,

  createTimelineController
};