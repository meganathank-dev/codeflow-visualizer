import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Timer
} from "lucide-react";

const PLAYBACK_SPEEDS = [
  0.25,
  0.5,
  1,
  1.5,
  2
];

const MAX_VISIBLE_MARKERS =
  45;

function createMarkerSteps(
  totalSteps
) {
  if (
    totalSteps <= MAX_VISIBLE_MARKERS
  ) {
    return Array.from(
      {
        length: totalSteps
      },

      (
        _,
        index
      ) => index
    );
  }

  const markerSteps =
    new Set();

  for (
    let index = 0;
    index < MAX_VISIBLE_MARKERS;
    index += 1
  ) {
    markerSteps.add(
      Math.round(
        (
          index /
          (
            MAX_VISIBLE_MARKERS - 1
          )
        ) * (
          totalSteps - 1
        )
      )
    );
  }

  return [
    ...markerSteps
  ];
}

export default function TimelineControls({
  currentStep,
  totalSteps,
  currentEvent,
  isPlaying,
  isExecuting = false,
  speed,
  onFirst,
  onPrevious,
  onPlay,
  onPause,
  onNext,
  onLast,
  onReset,
  onSeek,
  onSpeedChange
}) {
  const progress =
    totalSteps <= 1
      ? 0
      : (
          currentStep /
          (
            totalSteps - 1
          )
        ) * 100;

  const markerSteps =
    createMarkerSteps(
      totalSteps
    );

  return (
    <footer className="timeline-panel">
      <div className="timeline-topline">
        <div className="timeline-label">
          <Timer size={15} />

          <span>
            EXECUTION TIMELINE
          </span>
        </div>

        <div className="timeline-current-event">
          {
            String(
              currentEvent ||
              "PROGRAM_START"
            ).replaceAll(
              "_",
              " "
            )
          }
        </div>

        <span className="timeline-step-count">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      <div
        className="timeline-slider-wrap"
        style={{
          "--timeline-progress":
            `${progress}%`
        }}
      >
        <input
          className="timeline-slider"
          type="range"
          min="0"
          max={
            Math.max(
              totalSteps - 1,
              0
            )
          }
          value={currentStep}
          onChange={
            (event) => {
              onSeek(
                Number(
                  event.target.value
                )
              );
            }
          }
          disabled={
            isExecuting ||
            totalSteps <= 1
          }
          aria-label="Execution timeline"
        />

        <div className="timeline-markers">
          {
            markerSteps.map(
              (step) => (
                <span
                  className={
                    step <= currentStep
                      ? "timeline-marker is-complete"
                      : "timeline-marker"
                  }
                  key={step}
                  style={{
                    left:
                      totalSteps <= 1
                        ? "0%"
                        : `${
                            (
                              step /
                              (
                                totalSteps - 1
                              )
                            ) * 100
                          }%`
                  }}
                />
              )
            )
          }
        </div>
      </div>

      <div className="timeline-controls">
        <div className="transport-controls">
          <button
            className="transport-button"
            type="button"
            onClick={onFirst}
            disabled={
              isExecuting ||
              currentStep === 0
            }
            aria-label="First execution step"
            title="First step"
          >
            <SkipBack size={17} />
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={onPrevious}
            disabled={
              isExecuting ||
              currentStep === 0
            }
            aria-label="Previous execution step"
            title="Previous step"
          >
            <ChevronLeft size={19} />
          </button>

          <button
            className="transport-button transport-play-button"
            type="button"
            onClick={
              isPlaying
                ? onPause
                : onPlay
            }
            disabled={
              isExecuting
            }
            aria-label={
              isPlaying
                ? "Pause execution"
                : "Play execution"
            }
          >
            {
              isPlaying
                ? (
                    <Pause size={18} />
                  )
                : (
                    <Play size={18} />
                  )
            }
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={onNext}
            disabled={
              isExecuting ||
              currentStep >= totalSteps - 1
            }
            aria-label="Next execution step"
            title="Next step"
          >
            <ChevronRight size={19} />
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={onLast}
            disabled={
              isExecuting ||
              currentStep >= totalSteps - 1
            }
            aria-label="Last execution step"
            title="Last step"
          >
            <SkipForward size={17} />
          </button>

          <span className="transport-divider" />

          <button
            className="transport-button"
            type="button"
            onClick={onReset}
            disabled={
              isExecuting
            }
            aria-label="Reset execution"
            title="Reset execution"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="speed-selector">
          <span>
            SPEED
          </span>

          <select
            value={speed}
            onChange={
              (event) => {
                onSpeedChange(
                  Number(
                    event.target.value
                  )
                );
              }
            }
            aria-label="Playback speed"
          >
            {
              PLAYBACK_SPEEDS.map(
                (playbackSpeed) => (
                  <option
                    key={playbackSpeed}
                    value={playbackSpeed}
                  >
                    {playbackSpeed}x
                  </option>
                )
              )
            }
          </select>
        </div>
      </div>
    </footer>
  );
}