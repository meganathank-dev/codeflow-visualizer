import { useEffect, useMemo, useRef, useState } from "react";

import { AlertCircle, Radio, X } from "lucide-react";

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

import {
  createExecutionPresentation,
  createIdleExecutionStep
} from "./utils/execution-presentation";

import {
  ApiResponseError,
  readJsonResponse
} from "./utils/http-response";

const INITIAL_LANGUAGE = "javascript";
const BASE_PLAYBACK_INTERVAL = 430;
const BACKEND_STATUS_REFRESH_INTERVAL = 5_000;
const BACKEND_FAILURE_THRESHOLD = 2;
const LIVE_EXECUTION_LANGUAGES = Object.freeze([
  "javascript",
  "python",
  "java",
  "sql"
]);

function createInitialSources() {
  return Object.fromEntries(
    LANGUAGE_OPTIONS.map(({ id }) => [id, DEMO_EXECUTIONS[id].source])
  );
}

export default function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(INITIAL_LANGUAGE);
  const [sources, setSources] = useState(createInitialSources);
  const [executions, setExecutions] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [notification, setNotification] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");

  const activeRequestRef = useRef(null);
  const healthFailureCountRef = useRef(0);

  const language = useMemo(
    () => getLanguageOption(selectedLanguage),
    [selectedLanguage]
  );

  const demoExecution = DEMO_EXECUTIONS[selectedLanguage];
  const source = sources[selectedLanguage];
  const isEdited = source !== demoExecution.source;
  const canExecuteLive = LIVE_EXECUTION_LANGUAGES.includes(selectedLanguage);

  const liveExecution = executions[selectedLanguage];
  const hasLiveExecution = Boolean(
    liveExecution && liveExecution.source === source
  );

  const steps = hasLiveExecution
    ? liveExecution.presentation.steps
    : canExecuteLive && isEdited
      ? [createIdleExecutionStep(selectedLanguage)]
      : demoExecution.steps;

  const totalSteps = steps.length;
  const boundedCurrentStep = Math.min(currentStep, totalSteps - 1);
  const activeStep = steps[boundedCurrentStep];

  useEffect(() => {
    let isMounted = true;
    let requestInProgress = false;

    async function checkBackendHealth() {
      if (requestInProgress) {
        return;
      }

      requestInProgress = true;

      try {
        const response = await fetch("/api/health", {
          headers: { accept: "application/json" }
        });

        const result = await readJsonResponse(
          response,
          "Health service"
        );

        if (!isMounted) {
          return;
        }

        const connected = (
          response.ok &&
          result.executionService?.connected === true
        );

        healthFailureCountRef.current = connected
          ? 0
          : BACKEND_FAILURE_THRESHOLD;

        setBackendStatus(connected ? "connected" : "offline");
      } catch {
        if (isMounted) {
          healthFailureCountRef.current += 1;

          if (
            healthFailureCountRef.current >=
            BACKEND_FAILURE_THRESHOLD
          ) {
            setBackendStatus("offline");
          }
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
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => activeRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!isPlaying || isExecuting) {
      return undefined;
    }

    if (boundedCurrentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextStep = boundedCurrentStep + 1;

      setCurrentStep(nextStep);

      if (nextStep >= totalSteps - 1) {
        setIsPlaying(false);
      }
    }, BASE_PLAYBACK_INTERVAL / speed);

    return () => window.clearTimeout(timer);
  }, [boundedCurrentStep, isExecuting, isPlaying, speed, totalSteps]);

  useEffect(() => {
    function handleKeyboardShortcut(event) {
      const target = event.target;
      const tagName = target?.tagName;

      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable ||
        Boolean(target?.closest?.(".monaco-editor"))
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        if (isPlaying) {
          handlePause();
        } else {
          handlePrimaryAction();
        }

        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleSeek(boundedCurrentStep + 1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleSeek(boundedCurrentStep - 1);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [
    backendStatus,
    boundedCurrentStep,
    hasLiveExecution,
    isEdited,
    isExecuting,
    isPlaying,
    selectedLanguage,
    source,
    totalSteps
  ]);

  function cancelActiveExecution() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
  }

  function clearExecution(languageId) {
    setExecutions((previousExecutions) => {
      if (!Object.hasOwn(previousExecutions, languageId)) {
        return previousExecutions;
      }

      const nextExecutions = { ...previousExecutions };
      delete nextExecutions[languageId];
      return nextExecutions;
    });
  }

  function handleLanguageChange(languageId) {
    cancelActiveExecution();
    setIsExecuting(false);
    setIsPlaying(false);
    setSelectedLanguage(languageId);
    setCurrentStep(0);
    setNotification("");
  }

  function handleSourceChange(value) {
    if (value === source) {
      return;
    }

    cancelActiveExecution();
    clearExecution(selectedLanguage);
    setIsExecuting(false);
    setIsPlaying(false);
    setCurrentStep(0);
    setNotification("");

    setSources((previousSources) => ({
      ...previousSources,
      [selectedLanguage]: value
    }));
  }

  function handleRestoreSource() {
    cancelActiveExecution();
    clearExecution(selectedLanguage);
    setIsExecuting(false);
    setIsPlaying(false);
    setCurrentStep(0);
    setNotification("");

    setSources((previousSources) => ({
      ...previousSources,
      [selectedLanguage]: demoExecution.source
    }));
  }

  async function runCode() {
    if (isExecuting) {
      return;
    }

    if (!source.trim()) {
      setNotification(`Add ${language.label} code before starting an execution.`);
      return;
    }

    if (backendStatus !== "connected") {
      setNotification(
        "Execution services are unavailable. Start the workspace with pnpm dev."
      );

      return;
    }

    cancelActiveExecution();

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsExecuting(true);
    setIsPlaying(false);
    setNotification("");

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({ language: selectedLanguage, source }),
        signal: controller.signal
      });

      const result = await readJsonResponse(
        response,
        `${language.label} execution service`
      );

      if (!response.ok || result.status !== "ok") {
        throw new Error(
          result.error?.message || `${language.label} execution failed.`
        );
      }

      const presentation = createExecutionPresentation(result);

      setExecutions((previousExecutions) => ({
        ...previousExecutions,
        [selectedLanguage]: {
          source,
          presentation
        }
      }));

      setCurrentStep(0);

      if (presentation.executionStatus === "failed") {
        const finalStep = presentation.steps.at(-1);

        setNotification(
          `Execution stopped: ${finalStep?.error?.message || finalStep?.description || "Unknown runtime error."}`
        );
      }

      setIsPlaying(presentation.steps.length > 1);
    } catch (error) {
      if (error.name !== "AbortError") {
        if (error instanceof ApiResponseError) {
          setBackendStatus("offline");
        }

        setNotification(error.message || `${language.label} execution failed.`);
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsExecuting(false);
      }
    }
  }

  function playExistingTimeline() {
    if (boundedCurrentStep >= totalSteps - 1) {
      setCurrentStep(0);
    }

    setIsPlaying(totalSteps > 1);
  }

  function handlePrimaryAction() {
    if (isExecuting) {
      return;
    }

    if (canExecuteLive) {
      if (hasLiveExecution && boundedCurrentStep < totalSteps - 1) {
        playExistingTimeline();
        return;
      }

      runCode();
      return;
    }

    if (isEdited) {
      setNotification(
        `${language.label} live execution will be enabled in its upcoming development phase. Restore the example to preview its visualization.`
      );

      return;
    }

    setNotification("");
    playExistingTimeline();
  }

  function handlePause() {
    setIsPlaying(false);
  }

  function handleSeek(step) {
    if (isExecuting) {
      return;
    }

    setIsPlaying(false);
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
  }

  function handleReset() {
    setIsPlaying(false);
    setCurrentStep(0);
    setNotification("");
  }

  function getBackendStatusLabel() {
    if (backendStatus === "checking") {
      return "Checking local services...";
    }

    if (backendStatus !== "connected") {
      return "Services offline";
    }

    if (!canExecuteLive) {
      return `${language.label} · Curated preview`;
    }

    if (isExecuting) {
      return `${language.label} · Generating execution trace`;
    }

    if (hasLiveExecution) {
      return `${language.label} · ${totalSteps} verified execution events`;
    }

    return `${language.label} · Ready for real execution`;
  }

  const executionMode = hasLiveExecution
    ? "live"
    : canExecuteLive
      ? "ready"
      : "preview";

  return (
    <div className={isPlaying ? "app-shell is-running" : "app-shell"}>
      <div className="background-grid" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-left" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-right" aria-hidden="true" />

      <div className="workspace-shell">
        <AppHeader
          language={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          isPlaying={isPlaying}
          isExecuting={isExecuting}
          hasLiveExecution={hasLiveExecution}
          supportsLiveExecution={canExecuteLive}
          isAtFinalStep={boundedCurrentStep >= totalSteps - 1}
          onRun={handlePrimaryAction}
          onPause={handlePause}
        />

        <div className="workspace-context-bar">
          <div className="context-title">
            <span className="context-live-dot" />
            <span>
              {selectedLanguage === "sql" ? "Logical query execution" : "Program execution"}
            </span>
            <span className="context-divider">/</span>
            <span className="context-muted">{language.filename}</span>
          </div>

          <div
            className={
              backendStatus === "connected"
                ? "preview-disclaimer backend-connected"
                : "preview-disclaimer"
            }
          >
            <Radio size={14} />
            <span>{getBackendStatusLabel()}</span>
          </div>
        </div>

        {notification && (
          <div className="workspace-notification" role="status">
            <AlertCircle size={17} />
            <span>{notification}</span>

            <button
              type="button"
              onClick={() => setNotification("")}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <main className="workspace-content">
          <div className="primary-workspace">
            <EditorPanel
              language={language}
              source={source}
              currentLine={activeStep.line}
              isEdited={isEdited}
              executionMode={executionMode}
              onChange={handleSourceChange}
              onRestore={handleRestoreSource}
            />

            <VisualizationPanel
              step={activeStep}
              currentStep={boundedCurrentStep}
              totalSteps={totalSteps}
            />
          </div>

          <InspectorPanel step={activeStep} />
        </main>

        <TimelineControls
          currentStep={boundedCurrentStep}
          totalSteps={totalSteps}
          currentEvent={activeStep.event}
          isPlaying={isPlaying}
          isExecuting={isExecuting}
          speed={speed}
          onFirst={() => handleSeek(0)}
          onPrevious={() => handleSeek(boundedCurrentStep - 1)}
          onPlay={handlePrimaryAction}
          onPause={handlePause}
          onNext={() => handleSeek(boundedCurrentStep + 1)}
          onLast={() => handleSeek(totalSteps - 1)}
          onReset={handleReset}
          onSeek={handleSeek}
          onSpeedChange={setSpeed}
        />

        <div className="workspace-footer">
          <span>RUN IT.</span>
          <span>TRACE IT.</span>
          <span>SEE IT.</span>
          <span>UNDERSTAND IT.</span>
        </div>
      </div>
    </div>
  );
}
