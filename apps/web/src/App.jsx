import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  AlertCircle,
  Radio,
  X
} from "lucide-react";

import AppHeader from "./components/AppHeader";

import EditorPanel from "./components/EditorPanel";

import VisualizationPanel from "./components/VisualizationPanel";

import InspectorPanel from "./components/InspectorPanel";

import TimelineControls from "./components/TimelineControls";

import {
  DEMO_EXECUTIONS,
  LANGUAGE_OPTIONS,
  getLanguageOption
} from "./data/demo-executions";

const INITIAL_LANGUAGE = "javascript";

const BASE_PLAYBACK_INTERVAL = 700;

const BACKEND_STATUS_REFRESH_INTERVAL = 5_000;

function createInitialSources() {
  return Object.fromEntries(
    LANGUAGE_OPTIONS.map(
      ({
        id
      }) => [
        id,

        DEMO_EXECUTIONS[id].source
      ]
    )
  );
}

export default function App() {
  const [
    selectedLanguage,

    setSelectedLanguage
  ] = useState(
    INITIAL_LANGUAGE
  );

  const [
    sources,

    setSources
  ] = useState(
    createInitialSources
  );

  const [
    currentStep,

    setCurrentStep
  ] = useState(0);

  const [
    isPlaying,

    setIsPlaying
  ] = useState(false);

  const [
    speed,

    setSpeed
  ] = useState(1);

  const [
    notification,

    setNotification
  ] = useState("");

  const [
    backendStatus,

    setBackendStatus
  ] = useState(
    "checking"
  );

  const language = useMemo(
    () => getLanguageOption(
      selectedLanguage
    ),

    [
      selectedLanguage
    ]
  );

  const execution = DEMO_EXECUTIONS[
    selectedLanguage
  ];

  const source = sources[
    selectedLanguage
   ];

  const steps = execution.steps;

  const activeStep = steps[
    currentStep
  ];

  const totalSteps = steps.length;

  const isEdited = (
    source !== execution.source
  );

  useEffect(() => {
    let isMounted = true;

    let requestInProgress = false;

    async function checkBackendHealth() {
      if (requestInProgress) {
        return;
      }

      requestInProgress = true;

      try {
        const response = await fetch(
          "/api/health",

          {
            headers: {
              accept: "application/json"
            }
          }
        );

        const result = await response.json();

        if (!isMounted) {
          return;
        }

        const isConnected = (
          response.ok &&
          result.executionService?.connected === true
        );

        setBackendStatus(
          isConnected
            ? "connected"
            : "offline"
        );
      } catch {
        if (isMounted) {
          setBackendStatus(
            "offline"
          );
        }
      } finally {
        requestInProgress = false;
      }
    }

    checkBackendHealth();

    const intervalId = window.setInterval(
      checkBackendHealth,

      BACKEND_STATUS_REFRESH_INTERVAL
    );

    return () => {
      isMounted = false;

      window.clearInterval(
        intervalId
      );
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);

      return undefined;
    }

    const timer = window.setTimeout(
      () => {
        const nextStep = currentStep + 1;

        if (nextStep >= totalSteps - 1) {
          setCurrentStep(
            totalSteps - 1
          );

          setIsPlaying(false);

          return;
        }

        setCurrentStep(
          nextStep
        );
      },

      BASE_PLAYBACK_INTERVAL / speed
    );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    currentStep,
    isPlaying,
    speed,
    totalSteps
  ]);

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      const target = event.target;

      const tagName = target?.tagName;

      const isTypingElement = (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable ||
        Boolean(
          target?.closest?.(
            ".monaco-editor"
          )
        )
      );

      if (isTypingElement) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        if (isPlaying) {
          setIsPlaying(false);

          return;
        }

        handlePreview();

        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();

        handleSeek(
          Math.min(
            currentStep + 1,

            totalSteps - 1
          )
        );

        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();

        handleSeek(
          Math.max(
            currentStep - 1,

            0
          )
        );
      }
    }

    window.addEventListener(
      "keydown",

      handleKeyboardShortcut
    );

    return () => {
      window.removeEventListener(
        "keydown",

        handleKeyboardShortcut
      );
    };
  }, [
    currentStep,
    isEdited,
    isPlaying,
    totalSteps
  ]);

  function handleLanguageChange(languageId) {
    setIsPlaying(false);

    setSelectedLanguage(
      languageId
    );

    setCurrentStep(0);

    setNotification("");
  }

  function handleSourceChange(value) {
    setSources(
      (previousSources) => ({
        ...previousSources,

        [selectedLanguage]: value
      })
    );

    setIsPlaying(false);

    setNotification("");
  }

  function handleRestoreSource() {
    setSources(
      (previousSources) => ({
        ...previousSources,

        [selectedLanguage]: execution.source
      })
    );

    setCurrentStep(0);

    setIsPlaying(false);

    setNotification("");
  }

  function handlePreview() {
    if (isEdited) {
      setNotification(
        "Custom source execution will be enabled in the next phase. Restore the sample to replay the verified demo."
      );

      return;
    }

    setNotification("");

    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
    }

    setIsPlaying(true);
  }

  function handlePause() {
    setIsPlaying(false);
  }

  function handleSeek(step) {
    setIsPlaying(false);

    setCurrentStep(
      Math.max(
        0,

        Math.min(
          step,

          totalSteps - 1
        )
      )
    );
  }

  function handleReset() {
    setIsPlaying(false);

    setCurrentStep(0);

    setNotification("");
  }

  function getBackendStatusLabel() {
    if (backendStatus === "connected") {
      return "Services connected · Curated preview";
    }

    if (backendStatus === "checking") {
      return "Checking local services...";
    }

    return "Services offline · Curated preview";
  }

  return (
    <div
      className={
        isPlaying
          ? "app-shell is-running"
          : "app-shell"
      }
    >
      <div
        className="background-grid"
        aria-hidden="true"
      />

      <div
        className="ambient-glow ambient-glow-left"
        aria-hidden="true"
      />

      <div
        className="ambient-glow ambient-glow-right"
        aria-hidden="true"
      />

      <div className="workspace-shell">
        <AppHeader
          language={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          isPlaying={isPlaying}
          onPreview={handlePreview}
          onPause={handlePause}
        />

        <div className="workspace-context-bar">
          <div className="context-title">
            <span className="context-live-dot" />

            <span>
              {
                selectedLanguage === "sql"
                  ? "Logical query execution"
                  : "Program execution"
              }
            </span>

            <span className="context-divider">
              /
            </span>

            <span className="context-muted">
              {
                language.filename
              }
            </span>
          </div>

          <div
            className={
              backendStatus === "connected"
                ? "preview-disclaimer backend-connected"
                : "preview-disclaimer"
            }
          >
            <Radio size={14} />

            <span>
              {
                getBackendStatusLabel()
              }
            </span>
          </div>
        </div>

        {
          notification && (
            <div className="workspace-notification">
              <AlertCircle size={17} />

              <span>
                {notification}
              </span>

              <button
                type="button"
                onClick={() => {
                  setNotification("");
                }}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )
        }

        <main className="workspace-content">
          <div className="primary-workspace">
            <EditorPanel
              language={language}
              source={source}
              currentLine={
                activeStep.line
              }
              isEdited={isEdited}
              onChange={handleSourceChange}
              onRestore={handleRestoreSource}
            />

            <VisualizationPanel
              step={activeStep}
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
          </div>

          <InspectorPanel
            step={activeStep}
          />
        </main>

        <TimelineControls
          currentStep={currentStep}
          totalSteps={totalSteps}
          currentEvent={
            activeStep.event
          }
          isPlaying={isPlaying}
          speed={speed}
          onFirst={() => {
            handleSeek(0);
          }}
          onPrevious={() => {
            handleSeek(
              currentStep - 1
            );
          }}
          onPlay={handlePreview}
          onPause={handlePause}
          onNext={() => {
            handleSeek(
              currentStep + 1
            );
          }}
          onLast={() => {
            handleSeek(
              totalSteps - 1
            );
          }}
          onReset={handleReset}
          onSeek={handleSeek}
          onSpeedChange={setSpeed}
        />

        <div className="workspace-footer">
          <span>
            RUN IT.
          </span>

          <span>
            TRACE IT.
          </span>

          <span>
            SEE IT.
          </span>

          <span>
            UNDERSTAND IT.
          </span>
        </div>
      </div>
    </div>
  );
}