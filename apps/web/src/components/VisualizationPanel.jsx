import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion
} from "framer-motion";

import {
  Activity,
  ArrowRight,
  Database,
  GitBranch,
  Layers3,
  Sparkles,
  Table2,
  Workflow
} from "lucide-react";

const SPRING_TRANSITION = {
  type: "spring",
  stiffness: 340,
  damping: 29,
  mass: 0.8
};

const SOFT_SPRING_TRANSITION = {
  type: "spring",
  stiffness: 260,
  damping: 27,
  mass: 0.9
};

function formatVariableValue(value) {
  if (Array.isArray(value)) {
    return `[${value.join(", ")}]`;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  return String(value);
}

function AnimatedValue({
  value,
  className
}) {
  const shouldReduceMotion = useReducedMotion();

  const formattedValue = formatVariableValue(
    value
  );

  return (
    <AnimatePresence
      initial={false}
      mode="wait"
    >
      <motion.span
        key={formattedValue}
        className={className}
        initial={
          shouldReduceMotion
            ? false
            : {
              opacity: 0,
              y: 7,
              filter: "blur(3px)"
            }
        }
        animate={{
          opacity: 1,
          y: 0,
          filter: "blur(0px)"
        }}
        exit={
          shouldReduceMotion
            ? undefined
            : {
              opacity: 0,
              y: -5,
              filter: "blur(2px)"
            }
        }
        transition={{
          duration: shouldReduceMotion
            ? 0
            : 0.18,

          ease: [
            0.22,
            1,
            0.36,
            1
          ]
        }}
      >
        {formattedValue}
      </motion.span>
    </AnimatePresence>
  );
}

function VariableCards({
  variables
}) {
  const entries = Object.entries(
    variables
  );

  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="variable-grid"
      layout
    >
      <AnimatePresence
        initial={false}
        mode="popLayout"
      >
        {
          entries.map(
            ([
              name,
              value
            ]) => (
              <motion.div
                className="variable-card"
                key={name}
                layout
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                      opacity: 0,
                      y: 8,
                      scale: 0.96
                    }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1
                }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : {
                      opacity: 0,
                      y: -6,
                      scale: 0.97
                    }
                }
                transition={
                  shouldReduceMotion
                    ? {
                      duration: 0
                    }
                    : SPRING_TRANSITION
                }
              >
                <span className="variable-name">
                  {name}
                </span>

                <AnimatedValue
                  value={value}
                  className="variable-value"
                />
              </motion.div>
            )
          )
        }
      </AnimatePresence>
    </motion.div>
  );
}

function ArrayVisualization({
  array
}) {
  const shouldReduceMotion = useReducedMotion();

  if (!array) {
    return null;
  }

  return (
    <motion.div
      className="visualization-card array-card"
      layout
      transition={
        shouldReduceMotion
          ? {
            duration: 0
          }
          : SOFT_SPRING_TRANSITION
      }
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Layers3 size={16} />

          <span>
            Array
          </span>
        </div>

        <span className="structure-name">
          {array.name}
        </span>
      </div>

      <motion.div
        className="array-stage"
        layout
      >
        {
          array.values.map(
            (value, index) => {
              const isActive = (
                index === array.activeIndex
              );

              return (
                <motion.div
                  className={
                    isActive
                      ? "array-cell is-active"
                      : "array-cell"
                  }
                  key={`${array.name}-${index}`}
                  layout
                  animate={
                    shouldReduceMotion
                      ? {
                        y: 0,
                        scale: 1
                      }
                      : {
                        y: isActive
                          ? -5
                          : 0,

                        scale: isActive
                          ? 1.045
                          : 1
                      }
                  }
                  transition={
                    shouldReduceMotion
                      ? {
                        duration: 0
                      }
                      : SPRING_TRANSITION
                  }
                >
                  <span className="array-index">
                    {index}
                  </span>

                  <AnimatePresence
                    initial={false}
                    mode="wait"
                  >
                    <motion.span
                      className="array-value"
                      key={`${index}-${value}`}
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                            opacity: 0,
                            y: 6
                          }
                      }
                      animate={{
                        opacity: 1,
                        y: 0
                      }}
                      exit={
                        shouldReduceMotion
                          ? undefined
                          : {
                            opacity: 0,
                            y: -5
                          }
                      }
                      transition={{
                        duration: shouldReduceMotion
                          ? 0
                          : 0.16
                      }}
                    >
                      {value}
                    </motion.span>
                  </AnimatePresence>

                  <AnimatePresence>
                    {
                      isActive && (
                        <motion.span
                          className="array-active-marker"
                          initial={
                            shouldReduceMotion
                              ? false
                              : {
                                opacity: 0,
                                y: -4
                              }
                          }
                          animate={{
                            opacity: 1,
                            y: 0
                          }}
                          exit={
                            shouldReduceMotion
                              ? undefined
                              : {
                                opacity: 0,
                                y: -3
                              }
                          }
                          transition={{
                            duration: shouldReduceMotion
                              ? 0
                              : 0.16
                          }}
                        >
                          active
                        </motion.span>
                      )
                    }
                  </AnimatePresence>
                </motion.div>
              );
            }
          )
        }
      </motion.div>
    </motion.div>
  );
}

function StackVisualization({
  stack
}) {
  const shouldReduceMotion = useReducedMotion();

  if (!stack) {
    return null;
  }

  const stackEntries = stack.values.map(
    (value, index) => ({
      value,
      index
    })
  ).reverse();

  return (
    <motion.div
      className="visualization-card stack-card"
      layout
      transition={
        shouldReduceMotion
          ? {
            duration: 0
          }
          : SOFT_SPRING_TRANSITION
      }
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Workflow size={16} />

          <span>
            Stack
          </span>
        </div>

        <span className="structure-name">
          {stack.name}
        </span>
      </div>

      <motion.div
        className="stack-stage"
        layout
      >
        <AnimatePresence
          initial={false}
          mode="popLayout"
        >
          {
            stackEntries.length === 0
              ? (
                <motion.div
                  className="empty-stack"
                  key="empty-stack"
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                        opacity: 0
                      }
                  }
                  animate={{
                    opacity: 1
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                        opacity: 0,
                        y: 5
                      }
                  }
                >
                  Empty stack
                </motion.div>
              )
              : (
                stackEntries.map(
                  ({
                    value,
                    index
                  }, position) => (
                    <motion.div
                      className={
                        position === 0
                          ? "stack-item is-top"
                          : "stack-item"
                      }
                      key={`${stack.name}-${index}-${value}`}
                      layout
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                            opacity: 0,
                            y: -20,
                            scale: 0.82
                          }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1
                      }}
                      exit={
                        shouldReduceMotion
                          ? undefined
                          : {
                            opacity: 0,
                            y: -15,
                            scale: 0.84
                          }
                      }
                      transition={
                        shouldReduceMotion
                          ? {
                            duration: 0
                          }
                          : SPRING_TRANSITION
                      }
                    >
                      <AnimatePresence>
                        {
                          position === 0 && (
                            <motion.span
                              className="stack-top-label"
                              initial={
                                shouldReduceMotion
                                  ? false
                                  : {
                                    opacity: 0,
                                    x: 5
                                  }
                              }
                              animate={{
                                opacity: 1,
                                x: 0
                              }}
                              exit={
                                shouldReduceMotion
                                  ? undefined
                                  : {
                                    opacity: 0
                                  }
                              }
                            >
                              TOP
                            </motion.span>
                          )
                        }
                      </AnimatePresence>

                      <span>
                        {value}
                      </span>
                    </motion.div>
                  )
                )
              )
          }
        </AnimatePresence>

        <motion.div
          className="stack-base"
          layout
        />
      </motion.div>
    </motion.div>
  );
}

function QueueVisualization({
  queue
}) {
  const shouldReduceMotion = useReducedMotion();

  if (!queue) {
    return null;
  }

  const occurrences = new Map();
  const entries = queue.values.map((value, index) => {
    const serializedValue = formatVariableValue(value);
    const occurrence = occurrences.get(serializedValue) || 0;
    occurrences.set(serializedValue, occurrence + 1);

    return {
      value,
      index,
      key: `${queue.name}-${serializedValue}-${occurrence}`
    };
  });

  return (
    <motion.div
      className="visualization-card queue-card"
      layout
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : SOFT_SPRING_TRANSITION
      }
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <ArrowRight size={16} />

          <span>Queue</span>
        </div>

        <span className="structure-name">
          {queue.name}
        </span>
      </div>

      <div className="queue-stage">
        <span className="queue-edge-label queue-front-label">
          FRONT
        </span>

        <motion.div
          className="queue-track"
          layout
        >
          <AnimatePresence
            initial={false}
            mode="popLayout"
          >
            {
              entries.length === 0
                ? (
                  <motion.div
                    className="empty-queue"
                    key="empty-queue"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  >
                    Empty queue
                  </motion.div>
                )
                : entries.map(({ value, index, key }) => (
                  <motion.div
                    className={
                      index === 0
                        ? "queue-item is-front"
                        : index === entries.length - 1
                          ? "queue-item is-back"
                          : "queue-item"
                    }
                    key={key}
                    layout
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                          opacity: 0,
                          x: 24,
                          scale: 0.88
                        }
                    }
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: 1
                    }}
                    exit={
                      shouldReduceMotion
                        ? undefined
                        : {
                          opacity: 0,
                          x: -28,
                          scale: 0.86
                        }
                    }
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : SPRING_TRANSITION
                    }
                  >
                    <span className="queue-index">
                      {index}
                    </span>

                    <span className="queue-value">
                      {formatVariableValue(value)}
                    </span>
                  </motion.div>
                ))
            }
          </AnimatePresence>
        </motion.div>

        <span className="queue-edge-label queue-back-label">
          BACK
        </span>
      </div>

      <div className="queue-flow-line">
        <span>dequeue</span>
        <ArrowRight size={13} />
        <span>FIFO flow</span>
        <ArrowRight size={13} />
        <span>enqueue</span>
      </div>
    </motion.div>
  );
}

function EventStory({
  step,
  isSql = false
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence
      initial={false}
      mode="wait"
    >
      <motion.div
        className="event-story"
        key={step.id}
        initial={
          shouldReduceMotion
            ? false
            : {
              opacity: 0,
              y: 7
            }
        }
        animate={{
          opacity: 1,
          y: 0
        }}
        exit={
          shouldReduceMotion
            ? undefined
            : {
              opacity: 0,
              y: -5
            }
        }
        transition={{
          duration: shouldReduceMotion
            ? 0
            : 0.18,

          ease: [
            0.22,
            1,
            0.36,
            1
          ]
        }}
      >
        <div
          className={
            isSql
              ? "event-story-icon sql-event-icon"
              : "event-story-icon"
          }
        >
          {
            isSql
              ? <Database size={18} />
              : <Sparkles size={18} />
          }
        </div>

        <div>
          <p
            className={
              isSql
                ? "event-label sql-label"
                : "event-label"
            }
          >
            {
              step.event.replaceAll(
                "_",
                " "
              )
            }
          </p>

          <h3 className="event-title">
            {step.title}
          </h3>

          <p className="event-description">
            {step.description}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ProgramVisualization({
  step
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      <EventStory
        step={step}
      />

      <motion.div
        className="variable-section"
        layout
      >
        <div className="section-label-row">
          <span className="section-label">
            LIVE VARIABLES
          </span>

          <AnimatePresence
            initial={false}
            mode="wait"
          >
            {
              step.iteration !== null && (
                <motion.span
                  className="iteration-badge"
                  key={
                    `iteration-${step.iteration}`
                  }
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                        opacity: 0,
                        y: 4
                      }
                  }
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                        opacity: 0,
                        y: -4
                      }
                  }
                >
                  Iteration {step.iteration}
                </motion.span>
              )
            }
          </AnimatePresence>
        </div>

        <VariableCards
          variables={step.variables}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {
          step.condition && (
            <motion.div
              className="condition-strip"
              key={
                step.condition.expression
              }
              initial={
                shouldReduceMotion
                  ? false
                  : {
                    opacity: 0,
                    height: 0,
                    y: -5
                  }
              }
              animate={{
                opacity: 1,
                height: 36,
                y: 0
              }}
              exit={
                shouldReduceMotion
                  ? undefined
                  : {
                    opacity: 0,
                    height: 0,
                    y: -4
                  }
              }
              transition={{
                duration: shouldReduceMotion
                  ? 0
                  : 0.2
              }}
            >
              <GitBranch size={15} />

              <code>
                {
                  step.condition.expression
                }
              </code>

              <ArrowRight size={15} />

              <span className="condition-result">
                {
                  step.condition.result
                    ? "TRUE"
                    : "FALSE"
                }
              </span>
            </motion.div>
          )
        }
      </AnimatePresence>

      <motion.div
        className="structures-grid"
        layout
        transition={
          shouldReduceMotion
            ? {
              duration: 0
            }
            : SOFT_SPRING_TRANSITION
        }
      >
        <ArrayVisualization
          array={step.array}
        />

        <StackVisualization
          stack={step.stack}
        />

        <QueueVisualization
          queue={step.queue}
        />
      </motion.div>
    </>
  );
}

function QueryMetric({
  label,
  value
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="query-metric">
      <span>
        {label}
      </span>

      <AnimatePresence
        initial={false}
        mode="wait"
      >
        <motion.strong
          key={`${label}-${value}`}
          initial={
            shouldReduceMotion
              ? false
              : {
                opacity: 0,
                y: 6
              }
          }
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={
            shouldReduceMotion
              ? undefined
              : {
                opacity: 0,
                y: -5
              }
          }
          transition={{
            duration: shouldReduceMotion
              ? 0
              : 0.16
          }}
        >
          {value}
        </motion.strong>
      </AnimatePresence>
    </div>
  );
}

function SqlVisualization({
  step
}) {
  const shouldReduceMotion = useReducedMotion();

  const {
    sql
  } = step;

  return (
    <>
      <EventStory
        step={step}
        isSql
      />

      <motion.div
        className="query-metrics"
        layout
      >
        <QueryMetric
          label="Scanned"
          value={
            sql.scannedCount
          }
        />

        <QueryMetric
          label="Matching"
          value={
            sql.matchingCount
          }
        />

        <QueryMetric
          label="Excluded"
          value={
            sql.rejectedCount
          }
        />
      </motion.div>

      <motion.div
        className="visualization-card sql-table-card"
        layout
        transition={
          shouldReduceMotion
            ? {
              duration: 0
            }
            : SOFT_SPRING_TRANSITION
        }
      >
        <div className="visualization-card-heading">
          <div className="visualization-card-title">
            <Table2 size={16} />

            <span>
              {
                sql.table
              }
            </span>
          </div>

          <AnimatePresence
            initial={false}
            mode="wait"
          >
            <motion.span
              className="query-operation"
              key={
                sql.operation
              }
              initial={
                shouldReduceMotion
                  ? false
                  : {
                    opacity: 0,
                    y: 4
                  }
              }
              animate={{
                opacity: 1,
                y: 0
              }}
              exit={
                shouldReduceMotion
                  ? undefined
                  : {
                    opacity: 0,
                    y: -4
                  }
              }
            >
              {
                sql.operation
              }
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="sql-table-wrapper">
          <table className="sql-preview-table">
            <thead>
              <tr>
                {
                  sql.columns.map(
                    (column) => (
                      <motion.th
                        key={column}
                        layout
                        initial={
                          shouldReduceMotion
                            ? false
                            : {
                              opacity: 0
                            }
                        }
                        animate={{
                          opacity: 1
                        }}
                      >
                        {column}
                      </motion.th>
                    )
                  )
                }
              </tr>
            </thead>

            <tbody>
              <AnimatePresence
                initial={false}
                mode="popLayout"
              >
                {
                  sql.displayRows.map(
                    (row, index) => {
                      const isRejected = (
                        sql.rejectedIds.includes(
                          row.id
                        )
                      );

                      const isActive = index === sql.activeRowIndex;

                      const rowClassName = [
                        "sql-row",
                        isRejected ? "is-rejected" : "",
                        isActive ? "is-active" : "",
                        isActive && sql.activeRowResult === true ? "is-match" : ""
                      ].filter(Boolean).join(" ");

                      return (
                        <motion.tr
                          className={rowClassName}
                          key={
                            row.id ||
                            `${row.name}-${index}`
                          }
                          layout
                          initial={
                            shouldReduceMotion
                              ? false
                              : {
                                opacity: 0,
                                y: 8
                              }
                          }
                          animate={{
                            opacity: isRejected
                              ? 0.32
                              : 1,

                            y: 0,

                            backgroundColor: isActive
                              ? sql.activeRowResult
                                ? "rgba(112, 230, 178, 0.10)"
                                : "rgba(255, 123, 133, 0.10)"
                              : isRejected
                                ? "rgba(255, 123, 133, 0.08)"
                                : "rgba(255, 123, 133, 0)"
                          }}
                          exit={
                            shouldReduceMotion
                              ? undefined
                              : {
                                opacity: 0,
                                x: -12
                              }
                          }
                          transition={
                            shouldReduceMotion
                              ? {
                                duration: 0
                              }
                              : {
                                duration: 0.24,

                                ease: [
                                  0.22,
                                  1,
                                  0.36,
                                  1
                                ]
                              }
                          }
                        >
                          {
                            sql.columns.map(
                              (column) => (
                                <motion.td
                                  key={column}
                                  layout
                                >
                                  {
                                    row[column] ?? "—"
                                  }
                                </motion.td>
                              )
                            )
                          }
                        </motion.tr>
                      );
                    }
                  )
                }

                {
                  sql.displayRows.length === 0 && (
                    <tr className="sql-empty-row">
                      <td colSpan={Math.max(1, sql.columns.length)}>
                        No relational rows are available at this step.
                      </td>
                    </tr>
                  )
                }
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>

      <p className="sql-accuracy-note">
        Educational logical query visualization. This does not claim
        to reproduce a database engine’s physical execution plan.
      </p>
    </>
  );
}

export default function VisualizationPanel({
  step,
  currentStep,
  totalSteps
}) {
  if (!step) {
    return null;
  }

  const isSql = Boolean(
    step.sql
  );

  return (
    <MotionConfig reducedMotion="user">
      <section className="workspace-panel visualization-panel">
        <div className="panel-heading">
          <div className="panel-heading-copy">
            <div className="panel-icon visualization-icon">
              {
                isSql
                  ? <Database size={17} />
                  : <Activity size={17} />
              }
            </div>

            <div>
              <p className="panel-eyebrow">
                {
                  isSql
                    ? "RELATIONAL FLOW"
                    : "EXECUTION FLOW"
                }
              </p>

              <h2 className="panel-title">
                {
                  isSql
                    ? "Query visualization"
                    : "Live visualization"
                }
              </h2>
            </div>
          </div>

          <span className="step-counter">
            {
              String(
                currentStep + 1
              ).padStart(
                2,
                "0"
              )
            }

            <span>
              /
            </span>

            {
              String(
                totalSteps
              ).padStart(
                2,
                "0"
              )
            }
          </span>
        </div>

        <motion.div
          className="visualization-content"
          layout
          transition={SOFT_SPRING_TRANSITION}
        >
          {
            isSql
              ? (
                <SqlVisualization
                  step={step}
                />
              )
              : (
                <ProgramVisualization
                  step={step}
                />
              )
          }
        </motion.div>
      </section>
    </MotionConfig>
  );
}
