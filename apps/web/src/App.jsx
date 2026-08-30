import { useEffect, useMemo, useRef, useState } from "react";

import { AlertCircle, Radio, X } from "lucide-react";

import AppHeader from "./components/AppHeader";
import EditorPanel from "./components/EditorPanel";
import PracticePlatformDialog from "./components/PracticePlatformDialog";
import ProgramInputDialog from "./components/ProgramInputDialog";
import UserPlatformDialog from "./components/UserPlatformDialog";
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

import { readJsonResponse } from "./utils/http-response";
import { executeWithInteractiveInputs } from "./utils/interactive-input";
import {
  getPlaybackDelay,
  shouldAutoPlayFreshTrace
} from "./utils/playback";
import {
  createExecutionFailure,
  getExecutionStage,
  waitForBackendReady
} from "./utils/execution-reliability";
import {
  readDisplayMode,
  saveDisplayMode
} from "./utils/display-preferences";
import {
  fetchWithUserSession,
  restoreUserSession
} from "./utils/user-platform-api";

const INITIAL_LANGUAGE = "javascript";
const BACKEND_STATUS_REFRESH_INTERVAL = 5_000;
const INITIAL_BACKEND_CHECK_DELAY = 900;
const BACKEND_WAKING_MESSAGE = "Backend services are waking up. This may take up to 60 seconds.";
const PASSWORD_RESET_TOKEN_PARAM = "token";
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

function readPasswordResetToken() {
  return new URLSearchParams(window.location.search).get(PASSWORD_RESET_TOKEN_PARAM) || "";
}

export default function App() {
  const [selectedLanguage, setSelectedLanguage] = useState(INITIAL_LANGUAGE);
  const [sources, setSources] = useState(createInitialSources);
  const [executions, setExecutions] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionElapsedSeconds, setExecutionElapsedSeconds] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [displayMode, setDisplayMode] = useState(readDisplayMode);
  const [notification, setNotification] = useState("");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [inputRequest, setInputRequest] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [user, setUser] = useState(null);
  const [isUserPlatformOpen, setIsUserPlatformOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState(readPasswordResetToken);

  const activeRequestRef = useRef(null);
  const inputResolverRef = useRef(null);
  const sessionRestoreAttemptedRef = useRef(false);

  const language = useMemo(
    () => getLanguageOption(selectedLanguage),
    [selectedLanguage]
  );

  const demoExecution = DEMO_EXECUTIONS[selectedLanguage];
  const source = sources[selectedLanguage];
  const isEdited = source !== demoExecution.source;
  const canExecuteLive = LIVE_EXECUTION_LANGUAGES.includes(selectedLanguage);

  useEffect(() => {
    if (passwordResetToken) setIsUserPlatformOpen(true);
  }, [passwordResetToken]);

  const liveExecution = executions[selectedLanguage];
  const hasLiveExecution = Boolean(
    liveExecution &&
    liveExecution.source === source
  );

  const steps = hasLiveExecution
    ? liveExecution.presentation.steps
    : canExecuteLive
      ? [createIdleExecutionStep(selectedLanguage)]
      : demoExecution.steps;

  const totalSteps = steps.length;
  const boundedCurrentStep = Math.min(currentStep, totalSteps - 1);
  const activeStep = steps[boundedCurrentStep];

  useEffect(() => {
    if (backendStatus !== "connected" || sessionRestoreAttemptedRef.current) return undefined;
    sessionRestoreAttemptedRef.current = true;
    let active = true;
    restoreUserSession().then((restoredUser) => {
      if (active) setUser(restoredUser);
    });
    return () => { active = false; };
  }, [backendStatus]);

  useEffect(() => {
    saveDisplayMode(displayMode);
  }, [displayMode]);

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

        const result = await readJsonResponse(response, "Health service");

        if (!isMounted) {
          return;
        }

        setBackendStatus(
          response.ok && result.executionService?.connected === true
            ? "connected"
            : "offline"
        );
      } catch {
        if (isMounted) {
          setBackendStatus("offline");
        }
      } finally {
        requestInProgress = false;
      }
    }

    let intervalId;
    const initialCheckId = window.setTimeout(() => {
      checkBackendHealth();
      intervalId = window.setInterval(
        checkBackendHealth,
        BACKEND_STATUS_REFRESH_INTERVAL
      );
    }, INITIAL_BACKEND_CHECK_DELAY);

    return () => {
      isMounted = false;
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isExecuting) return undefined;
    const startedAt = Date.now();
    setExecutionElapsedSeconds(0);
    const intervalId = window.setInterval(() => {
      setExecutionElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [isExecuting]);

  useEffect(() => () => {
    activeRequestRef.current?.abort();
    inputResolverRef.current?.({ confirmed: false, value: "" });
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
    }, getPlaybackDelay(activeStep?.event, speed));

    return () => window.clearTimeout(timer);
  }, [activeStep?.event, boundedCurrentStep, isExecuting, isPlaying, speed, totalSteps]);

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
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        handleSeek(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        handleSeek(totalSteps - 1);
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

  function closeInputRequest(result) {
    const resolve = inputResolverRef.current;
    inputResolverRef.current = null;
    setInputRequest(null);
    setInputValue("");
    resolve?.(result);
  }

  function cancelActiveExecution() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    closeInputRequest({ confirmed: false, value: "" });
  }

  function handleCancelExecution() {
    if (!isExecuting) return;
    cancelActiveExecution();
    setIsExecuting(false);
    setNotification("Execution cancelled safely.");
  }

  async function probeBackendHealth(signal) {
    const response = await fetch("/api/health", {
      headers: { accept: "application/json" },
      signal
    });
    const result = await readJsonResponse(response, "Health service");
    const ready = response.ok && result.executionService?.connected === true;
    setBackendStatus(ready ? "connected" : "offline");
    return ready;
  }

  function requestProgramInput(request) {
    return new Promise((resolve) => {
      inputResolverRef.current = resolve;
      setInputValue("");
      setInputRequest(request);
    });
  }

  function handleInputConfirm() {
    closeInputRequest({ confirmed: true, value: inputValue });
  }

  function handleInputCancel() {
    cancelActiveExecution();
    setIsExecuting(false);
    setNotification("Execution cancelled while waiting for program input.");
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

  function handlePasswordResetComplete() {
    const url = new URL(window.location.href);
    url.searchParams.delete(PASSWORD_RESET_TOKEN_PARAM);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setPasswordResetToken("");
    setUser(null);
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

    cancelActiveExecution();

    const controller = new AbortController();
    activeRequestRef.current = controller;

    setIsExecuting(true);
    setIsPlaying(false);
    setNotification("");

    try {
      if (backendStatus !== "connected") {
        setBackendStatus("checking");
        const readiness = await waitForBackendReady({
          probe: () => probeBackendHealth(controller.signal),
          attempts: 4,
          delayMs: 650,
          signal: controller.signal
        });

        if (!readiness.ready) {
          setBackendStatus("offline");
          const unavailable = new Error(
            BACKEND_WAKING_MESSAGE
          );
          unavailable.code = "EXECUTION_SERVICE_UNAVAILABLE";
          throw unavailable;
        }
      }

      const execution = await executeWithInteractiveInputs({
        execute: async (collectedInputs) => {
          const response = await fetchWithUserSession("/api/execute", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json"
            },
            body: JSON.stringify({
              language: selectedLanguage,
              source,
              inputs: collectedInputs
            }),
            signal: controller.signal
          });

          const result = await readJsonResponse(response, "Execution service");

          if (!response.ok || result.status !== "ok") {
            throw createExecutionFailure(result, language.label);
          }

          return result;
        },
        requestInput: requestProgramInput
      });

      if (execution.cancelled || controller.signal.aborted) {
        return;
      }

      const { inputs: collectedInputs, result } = execution;

      const presentation = createExecutionPresentation(result);

      setExecutions((previousExecutions) => ({
        ...previousExecutions,
        [selectedLanguage]: {
          source,
          inputs: collectedInputs,
          presentation,
          verification: result.verification || null,
          reliability: result.reliability || null
        }
      }));

      setCurrentStep(0);

      if (presentation.executionStatus === "failed") {
        const finalStep = presentation.steps.at(-1);

        setNotification(
          `Execution stopped: ${finalStep?.error?.message || finalStep?.description || "Unknown runtime error."}`
        );
      }

      // Running code includes playback; no second Play trace click is needed.
      setIsPlaying(
        shouldAutoPlayFreshTrace(
          presentation.executionStatus,
          presentation.steps.length
        )
      );
    } catch (error) {
      if (error.name !== "AbortError") {
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
      handleCancelExecution();
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

  function handleLoadProject(project) {
    cancelActiveExecution();
    clearExecution(project.language);
    setIsExecuting(false);
    setIsPlaying(false);
    setSelectedLanguage(project.language);
    setSources((previousSources) => ({
      ...previousSources,
      [project.language]: project.source
    }));
    setCurrentStep(0);
    setNotification(`Loaded saved project: ${project.title}`);
    setIsUserPlatformOpen(false);
  }

  function handleVisualizePractice(visualization) {
    if (!visualization?.execution || !visualization.language) return;
    cancelActiveExecution();
    const presentation = createExecutionPresentation(visualization.execution);
    const languageId = visualization.language;
    const practiceSource = visualization.source || "";
    setIsExecuting(false);
    setIsPlaying(false);
    setSelectedLanguage(languageId);
    setSources((previousSources) => ({
      ...previousSources,
      [languageId]: practiceSource
    }));
    setExecutions((previousExecutions) => ({
      ...previousExecutions,
      [languageId]: {
        source: practiceSource,
        inputs: [],
        presentation,
        verification: visualization.execution.verification || null,
        reliability: visualization.execution.reliability || null
      }
    }));
    setCurrentStep(0);
    setIsPracticeOpen(false);
    setNotification("Loaded a verified public practice-test trace.");
    setIsPlaying(shouldAutoPlayFreshTrace(
      presentation.executionStatus,
      presentation.steps.length
    ));
  }

  function getBackendStatusLabel() {
    if (backendStatus !== "connected") {
      return "Services waking";
    }

    if (!canExecuteLive) {
      return `${language.label} · Curated preview`;
    }

    if (isExecuting) {
      if (inputRequest) {
        return `${language.label} · Waiting for input #${inputRequest.inputNumber}`;
      }

      return `${language.label} · ${getExecutionStage(language.label, executionElapsedSeconds)}`;
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

  const activeNotification = notification || (
    backendStatus !== "connected" ? BACKEND_WAKING_MESSAGE : ""
  );
  const canDismissNotification = Boolean(notification);

  return (
    <div className={`${isPlaying ? "app-shell is-running" : "app-shell"} display-${displayMode}`}>
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
          isAtFirstStep={boundedCurrentStep === 0}
          isAtFinalStep={boundedCurrentStep >= totalSteps - 1}
          user={user}
          onPractice={() => setIsPracticeOpen(true)}
          onAccount={() => setIsUserPlatformOpen(true)}
          onRun={handlePrimaryAction}
          onCancel={handleCancelExecution}
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

        {activeNotification && (
          <div className="workspace-notification" role="status">
            <AlertCircle size={17} />
            <span>{activeNotification}</span>

            {canDismissNotification && (
              <button
                type="button"
                onClick={() => setNotification("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            )}
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

          <InspectorPanel
            step={activeStep}
            currentStep={boundedCurrentStep}
            totalSteps={totalSteps}
            steps={steps}
            source={source}
            language={selectedLanguage}
            verificationId={hasLiveExecution ? liveExecution.verification?.id : ""}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            onSeek={handleSeek}
          />
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

      <ProgramInputDialog
        request={inputRequest}
        value={inputValue}
        languageLabel={language.label}
        onChange={setInputValue}
        onConfirm={handleInputConfirm}
        onCancel={handleInputCancel}
      />

      <UserPlatformDialog
        open={isUserPlatformOpen}
        user={user}
        language={selectedLanguage}
        source={source}
        resetToken={passwordResetToken}
        onClose={() => setIsUserPlatformOpen(false)}
        onUserChange={setUser}
        onPasswordResetComplete={handlePasswordResetComplete}
        onLoadProject={handleLoadProject}
      />

      <PracticePlatformDialog
        open={isPracticeOpen}
        user={user}
        onClose={() => setIsPracticeOpen(false)}
        onOpenAccount={() => {
          setIsPracticeOpen(false);
          setIsUserPlatformOpen(true);
        }}
        onVisualize={handleVisualizePractice}
      />
    </div>
  );
}
