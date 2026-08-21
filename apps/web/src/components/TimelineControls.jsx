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

export default function TimelineControls({
  currentStep,

  totalSteps,

  currentEvent,

  isPlaying,

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
  const progress = totalSteps <= 1
    ? 0
    : (
      currentStep /
      (totalSteps - 1)
    ) * 100;

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
            currentEvent.replaceAll(
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
          "--timeline-progress": `${progress}%`
        }}
      >
        <input
          className="timeline-slider"
          type="range"
          min="0"
          max={totalSteps - 1}
          value={currentStep}
          onChange={(event) => {
            onSeek(
              Number(
                event.target.value
              )
            );
          }}
          aria-label="Execution timeline"
        />

        <div className="timeline-markers">
          {
            Array.from(
              {
                length: totalSteps
              },

              (
                _,
                index
              ) => (
                <span
                  className={
                    index <= currentStep
                      ? "timeline-marker is-complete"
                      : "timeline-marker"
                  }
                  key={index}
                  style={{
                    left: totalSteps <= 1
                      ? "0%"
                      : `${(index / (totalSteps - 1)) * 100}%`
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
            disabled={currentStep === 0}
            aria-label="First execution step"
            title="First step"
          >
            <SkipBack size={17} />
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={onPrevious}
            disabled={currentStep === 0}
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
            aria-label={
              isPlaying
                ? "Pause execution preview"
                : "Play execution preview"
            }
          >
            {
              isPlaying
                ? <Pause size={18} />
                : <Play size={18} />
            }
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={onNext}
            disabled={
              currentStep === totalSteps - 1
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
              currentStep === totalSteps - 1
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
            aria-label="Reset execution preview"
            title="Reset preview"
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
            onChange={(event) => {
              onSpeedChange(
                Number(
                  event.target.value
                )
              );
            }}
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