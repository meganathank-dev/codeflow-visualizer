import {
  useState
} from "react";

import {
  Activity,
  Braces,
  Layers3,
  TerminalSquare
} from "lucide-react";

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
  }
];

function formatValue(value) {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  return String(value);
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
                  Array.isArray(value)
                    ? "array"
                    : typeof value
                }
              </span>

              <code className="inspector-variable-value">
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
        No program call-stack frames are available for this step.
      </div>
    );
  }

  return (
    <div className="call-stack-list">
      {
        step.callStack.map(
          (frame, index) => (
            <div
              className="call-stack-row"
              key={
                `${frame.name}-${index}`
              }
            >
              <span className="call-stack-index">
                {
                  String(index).padStart(
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

              <span className="call-stack-line">
                line {frame.line}
              </span>
            </div>
          )
        )
      }
    </div>
  );
}

function EventTab({
  step
}) {
  return (
    <div className="event-details-grid">
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

export default function InspectorPanel({
  step
}) {
  const [
    activeTab,
    setActiveTab
  ] = useState(
    "variables"
  );

  return (
    <section className="inspector-panel">
      <div className="inspector-tabs">
        {
          TABS.map(
            ({
              id,
              label,
              icon: Icon
            }) => (
              <button
                className={
                  activeTab === id
                    ? "inspector-tab is-active"
                    : "inspector-tab"
                }
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                }}
              >
                <Icon size={15} />

                <span>
                  {label}
                </span>

                {
                  id === "console" &&
                  step.console.length > 0 && (
                    <span className="tab-count">
                      {
                        step.console.length
                      }
                    </span>
                  )
                }
              </button>
            )
          )
        }
      </div>

      <div className="inspector-content">
        {
          activeTab === "variables" && (
            <VariablesTab
              step={step}
            />
          )
        }

        {
          activeTab === "console" && (
            <ConsoleTab
              step={step}
            />
          )
        }

        {
          activeTab === "stack" && (
            <CallStackTab
              step={step}
            />
          )
        }

        {
          activeTab === "event" && (
            <EventTab
              step={step}
            />
          )
        }
      </div>
    </section>
  );
}