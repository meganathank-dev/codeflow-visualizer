import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Activity,
  ALargeSmall,
  BookOpenText,
  Braces,
  CircleAlert,
  Gauge,
  Layers3,
  ListOrdered,
  MessageCircleQuestion,
  Sparkles,
  TerminalSquare
} from "lucide-react";

import AccessibleSelect from "./AccessibleSelect";
import { DISPLAY_MODES } from "../utils/display-preferences";

import {
  formatRuntimeValue,
  getRuntimeValueType
} from "../utils/value-presentation";
import { requestVerifiedExplanation } from "../utils/explanation-api";
import {
  createLineExplanations,
  createNumberedEventTrace,
  createVerifiedExplanationRequest
} from "../utils/verified-explanations";

const TABS = [
  {
    id: "variables",
    label: "Variables",
    icon: Braces
  },

  {
    id: "console",
    label: "Console",
    icon: TerminalSquare
  },

  {
    id: "stack",
    label: "Call stack",
    icon: Layers3
  },

  {
    id: "event",
    label: "Current event",
    icon: Activity
  },

  {
    id: "trace",
    label: "Full trace",
    icon: ListOrdered
  },

  {
    id: "explain",
    label: "Explain",
    icon: BookOpenText
  }
];

function formatValue(value) {
  return formatRuntimeValue(value);
}

function VariablesTab({
  step
}) {
  const entries = Object.entries(
    step.variables
  );

  if (step.sql) {
    return (
      <div className="inspector-message">
        SQL query state is displayed in the relational visualization panel.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="inspector-message">
        No variables are available at this execution step.
      </div>
    );
  }

  return (
    <div className="inspector-variable-list">
      {
        entries.map(
          ([
            name,
            value
          ]) => (
            <div
              className="inspector-variable-row"
              key={name}
            >
              <span className="inspector-variable-name">
                {name}
              </span>

              <span className="inspector-variable-type">
                {
                  getRuntimeValueType(value)
                }
              </span>

              <code
                className="inspector-variable-value"
                title={formatValue(value)}
              >
                {
                  formatValue(value)
                }
              </code>
            </div>
          )
        )
      }
    </div>
  );
}

function ConsoleTab({
  step
}) {
  if (step.console.length === 0) {
    return (
      <div className="inspector-message">
        No output has been produced at this execution step.
      </div>
    );
  }

  return (
    <div className="console-output-list">
      {
        step.console.map(
          (entry, index) => (
            <div
              className="console-output-row"
              key={
                `${entry.channel}-${index}`
              }
            >
              <span className="console-prompt">
                ›
              </span>

              <span className="console-output-text">
                {
                  entry.text
                }
              </span>
            </div>
          )
        )
      }
    </div>
  );
}

function CallStackTab({
  step
}) {
  if (step.callStack.length === 0) {
    return (
      <div className="inspector-message">
        No active call-stack frames are available for this step.
        {step.functionHistory?.length > 0 && (
          <span className="last-function-return">
            Last return: <code>{step.functionHistory.at(-1).name}()</code>
            {" → "}{formatValue(step.functionHistory.at(-1).returnValue)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="call-stack-list">
      {
        [...step.callStack].reverse().map(
          (frame, index) => (
            <div
              className={index === 0 ? "call-stack-row is-stack-top" : "call-stack-row"}
              key={
                `${frame.name}-${index}`
              }
            >
              <span className="call-stack-index">
                {
                  String(frame.depth ?? step.callStack.length - index).padStart(
                    2,
                    "0"
                  )
                }
              </span>

              <code>
                {
                  frame.name
                }
              </code>

              {index === 0 && <span className="call-stack-top-label">TOP</span>}

              {frame.recursive && (
                <span className="call-stack-depth">recursion {frame.recursionDepth}</span>
              )}

              <span className="call-stack-line">
                line {frame.line}
              </span>

              {(Object.keys(frame.parameters || {}).length > 0 || Object.keys(frame.locals || {}).length > 0) && (
                <div className="call-stack-values">
                  {Object.entries(frame.parameters || {}).map(([name, value]) => (
                    <span key={`parameter-${name}`}><small>{name}</small><code>{formatValue(value)}</code></span>
                  ))}
                  {Object.entries(frame.locals || {})
                    .filter(([name]) => !Object.hasOwn(frame.parameters || {}, name))
                    .slice(0, 4)
                    .map(([name, value]) => (
                      <span className="is-local" key={`local-${name}`}><small>{name}</small><code>{formatValue(value)}</code></span>
                    ))}
                </div>
              )}
            </div>
          )
        )
      }
    </div>
  );
}

function EventTab({
  step,
  currentStep,
  totalSteps
}) {
  return (
    <div className="event-details-grid">
      <div className="event-detail">
        <span>
          Position
        </span>

        <code>
          {currentStep + 1} / {totalSteps}
        </code>
      </div>

      <div className="event-detail">
        <span>
          Event
        </span>

        <code>
          {
            step.event
          }
        </code>
      </div>

      <div className="event-detail">
        <span>
          Source line
        </span>

        <code>
          {
            step.line
          }
        </code>
      </div>

      <div className="event-detail">
        <span>
          Domain
        </span>

        <code>
          {
            step.sql
              ? "query"
              : "program"
          }
        </code>
      </div>

      <div className="event-detail event-detail-wide">
        <span>
          What happened
        </span>

        <strong>
          {step.title}
        </strong>
      </div>

      <div className="event-detail event-detail-wide">
        <span>
          Explanation
        </span>

        <p>
          {
            step.description
          }
        </p>
      </div>
    </div>
  );
}

function TraceTab({ steps, currentStep, onSeek }) {
  const events = useMemo(() => createNumberedEventTrace(steps), [steps]);

  return (
    <div className="numbered-trace" aria-label={`Complete execution trace with ${events.length} events`}>
      {events.map((item) => (
        <button
          className={item.index === currentStep ? "numbered-trace-row is-active" : "numbered-trace-row"}
          key={`${item.number}-${item.event}`}
          type="button"
          onClick={() => onSeek(item.index)}
          aria-current={item.index === currentStep ? "step" : undefined}
        >
          <strong>{item.number}</strong>
          <span>
            <code>{item.event}</code>
            <small>{item.title}{item.line ? ` · line ${item.line}` : ""}</small>
          </span>
          {item.hasError && <CircleAlert size={15} />}
        </button>
      ))}
    </div>
  );
}

const EXPLANATION_ACTIONS = Object.freeze([
  { mode: "program", label: "Explain program", icon: Sparkles },
  { mode: "step", label: "Explain this step", icon: Activity },
  { mode: "error", label: "Explain error", icon: CircleAlert },
  { mode: "debug", label: "Debug suggestion", icon: Braces },
  { mode: "complexity", label: "Complexity", icon: Gauge }
]);

function ExplainTab({ source, language, steps, currentStep, verificationId, onSeek }) {
  const lines = useMemo(
    () => createLineExplanations(source, language, steps),
    [language, source, steps]
  );
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingMode, setLoadingMode] = useState("");

  useEffect(() => {
    setResult(null);
    setError("");
  }, [verificationId]);

  async function explain(mode) {
    if (!verificationId || loadingMode) return;
    const controller = new AbortController();
    setLoadingMode(mode);
    setError("");
    try {
      const response = await requestVerifiedExplanation(
        createVerifiedExplanationRequest({
          verificationId,
          mode,
          eventIndex: currentStep,
          question
        }),
        controller.signal
      );
      setResult(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMode("");
    }
  }

  return (
    <div className="explanation-workspace">
      <section className="line-explanations" aria-label="Line-by-line code explanation">
        <div className="explanation-section-heading">
          <div><BookOpenText size={16} /><strong>Line-by-line explanation</strong></div>
          <span>{lines.length} source lines</span>
        </div>
        <div className="line-explanation-list">
          {lines.map((line) => (
            <button
              className={line.executed ? "line-explanation-row is-executed" : "line-explanation-row"}
              key={line.line}
              type="button"
              onClick={() => line.eventNumbers.length && onSeek(line.eventNumbers[0] - 1)}
              disabled={!line.eventNumbers.length}
            >
              <span className="line-explanation-number">{line.line}</span>
              <span className="line-explanation-copy">
                <code>{line.code || " "}</code>
                <small>{line.explanation}</small>
              </span>
              {line.eventNumbers.length > 0 && (
                <span className="line-event-badges" aria-label={`Events ${line.eventNumbers.join(", ")}`}>
                  {line.eventNumbers.slice(0, 5).map((number) => <i key={number}>{number}</i>)}
                  {line.eventNumbers.length > 5 && <i>+{line.eventNumbers.length - 5}</i>}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="verified-ai-panel" aria-label="Verified trace explanation">
        <div className="explanation-section-heading">
          <div><Sparkles size={16} /><strong>Verified trace tutor</strong></div>
          <span>{verificationId ? "Trace verified" : "Run required"}</span>
        </div>
        <p className="verified-ai-note">
          Answers use only the current real execution trace. Run this source first to enable AI-assisted explanations.
        </p>
        <div className="verified-ai-actions">
          {EXPLANATION_ACTIONS.map(({ mode, label, icon: Icon }) => (
            <button key={mode} type="button" onClick={() => explain(mode)} disabled={!verificationId || Boolean(loadingMode)}>
              <Icon size={14} />{loadingMode === mode ? "Explaining…" : label}
            </button>
          ))}
        </div>
        <form className="tutor-question" onSubmit={(event) => { event.preventDefault(); explain("tutor"); }}>
          <MessageCircleQuestion size={15} />
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this verified step" minLength={2} disabled={!verificationId} />
          <button type="submit" disabled={!verificationId || question.trim().length < 2 || Boolean(loadingMode)}>Ask tutor</button>
        </form>
        {error && <div className="verified-ai-error" role="alert">{error}</div>}
        {result && (
          <article className="verified-ai-result">
            <span><Sparkles size={13} /> Verified · {result.provider === "openai" ? result.model : "local trace engine"}</span>
            <p>{result.explanation}</p>
          </article>
        )}
      </section>
    </div>
  );
}

export default function InspectorPanel({
  step,
  currentStep = 0,
  totalSteps = 1,
  steps = [step],
  source = "",
  language = "javascript",
  verificationId = "",
  displayMode = "compact",
  onDisplayModeChange = () => {},
  onSeek = () => {}
}) {
  const [
    activeTab,
    setActiveTab
  ] = useState(
    "variables"
  );

  return (
    <section className="inspector-panel">
      <div className="inspector-toolbar">
        <div className="inspector-tabs" role="tablist" aria-label="Execution inspector">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              className={activeTab === id ? "inspector-tab is-active" : "inspector-tab"}
              key={id}
              type="button"
              role="tab"
              id={`inspector-tab-${id}`}
              aria-controls={`inspector-panel-${id}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
              {id === "console" && step.console.length > 0 && (
                <span className="tab-count">{step.console.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="inspector-display-control" role="group" aria-label="Inspector text size">
          <ALargeSmall size={16} aria-hidden="true" />
          <AccessibleSelect
            className="display-mode-selector"
            value={displayMode}
            options={DISPLAY_MODES}
            onChange={onDisplayModeChange}
            ariaLabel="Inspector display size"
            size="compact"
          />
        </div>
      </div>

      <div
        className="inspector-content"
        role="tabpanel"
        id={`inspector-panel-${activeTab}`}
        aria-labelledby={`inspector-tab-${activeTab}`}
      >
        {activeTab === "variables" && <VariablesTab step={step} />}
        {activeTab === "console" && <ConsoleTab step={step} />}
        {activeTab === "stack" && <CallStackTab step={step} />}
        {activeTab === "event" && (
          <EventTab step={step} currentStep={currentStep} totalSteps={totalSteps} />
        )}
        {activeTab === "trace" && (
          <TraceTab steps={steps} currentStep={currentStep} onSeek={onSeek} />
        )}
        {activeTab === "explain" && (
          <ExplainTab
            source={source}
            language={language}
            steps={steps}
            currentStep={currentStep}
            verificationId={verificationId}
            onSeek={onSeek}
          />
        )}
      </div>
    </section>
  );
}
