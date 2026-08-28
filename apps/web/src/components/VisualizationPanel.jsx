import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion
} from "framer-motion";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Database,
  GitBranch,
  KeyRound,
  Keyboard,
  Layers3,
  Search,
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

function LinkedListVisualization({ linkedList }) {
  const shouldReduceMotion = useReducedMotion();

  if (!linkedList) {
    return null;
  }

  return (
    <motion.div
      className="visualization-card linked-list-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Workflow size={16} />
          <span>Linked List</span>
        </div>

        <span className="structure-name">{linkedList.name}</span>
      </div>

      <div className="linked-list-stage">
        <span className="linked-list-end-label is-head">HEAD</span>

        <motion.div className="linked-list-track" layout>
          <AnimatePresence initial={false} mode="popLayout">
            {linkedList.nodes.length === 0 ? (
              <motion.div
                key="empty-linked-list"
                className="empty-linked-list"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              >
                Empty linked list
              </motion.div>
            ) : linkedList.nodes.map((node, index) => (
              <motion.div
                key={node.id}
                className="linked-node-group"
                layout
                initial={shouldReduceMotion ? false : { opacity: 0, y: -15, scale: 0.86 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.8 }}
                transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
              >
                <motion.div
                  className={[
                    "linked-node",
                    node.id === linkedList.headId ? "is-head-node" : "",
                    node.id === linkedList.tailId ? "is-tail-node" : "",
                    node.id === linkedList.activeNodeId ? "is-active-node" : ""
                  ].filter(Boolean).join(" ")}
                  layout
                >
                  <span className="linked-node-index">{index}</span>
                  <span className="linked-node-value">{formatVariableValue(node.value)}</span>
                  <span className="linked-node-pointer">next</span>
                </motion.div>

                <motion.span className="linked-reference-arrow" layout>
                  <ArrowRight size={16} />
                </motion.span>
              </motion.div>
            ))}
          </AnimatePresence>

          {linkedList.nodes.length > 0 && (
            <motion.span className="linked-null-reference" layout>NULL</motion.span>
          )}
        </motion.div>
      </div>

      <div className="linked-list-flow-line">
        <span>head</span>
        <ArrowRight size={13} />
        <span>value + next reference</span>
        <ArrowRight size={13} />
        <span>null</span>
      </div>
    </motion.div>
  );
}

function HashMapVisualization({ hashMap }) {
  const shouldReduceMotion = useReducedMotion();

  if (!hashMap) {
    return null;
  }

  return (
    <motion.div
      className="visualization-card hashmap-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <KeyRound size={16} />
          <span>HashMap</span>
        </div>

        <div className="hashmap-heading-meta">
          <span className="hashmap-entry-count">
            {hashMap.size} {hashMap.size === 1 ? "entry" : "entries"}
          </span>

          <span className="structure-name">{hashMap.name}</span>
        </div>
      </div>

      <div className="hashmap-stage">
        <div className="hashmap-column-labels">
          <span>KEY</span>
          <span>LOOKUP</span>
          <span>VALUE</span>
        </div>

        <motion.div className="hashmap-entry-list" layout>
          <AnimatePresence initial={false} mode="popLayout">
            {hashMap.entries.length === 0 ? (
              <motion.div
                key="empty-hashmap"
                className="empty-hashmap"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              >
                Waiting for the first key-value entry
              </motion.div>
            ) : hashMap.entries.map((entry) => {
              const active = JSON.stringify(entry.key) === JSON.stringify(hashMap.activeKey);

              return (
                <motion.div
                  key={`${typeof entry.key}:${JSON.stringify(entry.key)}`}
                  className={`hashmap-entry${active ? " is-active-entry" : ""}`}
                  layout
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -15, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 19, scale: 0.94 }}
                  transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                >
                  <span className="hashmap-key-cell">
                    {formatVariableValue(entry.key)}
                  </span>

                  <span className="hashmap-lookup-link">
                    <span />
                    <ArrowRight size={14} />
                  </span>

                  <span className="hashmap-value-cell">
                    <AnimatedValue value={entry.value} />
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        <div className="hashmap-caption">
          Direct key lookup · conceptual key-value representation
        </div>
      </div>
    </motion.div>
  );
}

function TreeNodeBranch({
  nodeId,
  nodesById,
  tree,
  shouldReduceMotion
}) {
  const node = nodesById.get(nodeId);

  if (!node) {
    return null;
  }

  const hasChildren = Boolean(node.leftId || node.rightId);
  const isActive = node.id === tree.activeNodeId;
  const isVisited = tree.visitedIds.includes(node.id);

  return (
    <motion.div
      className="tree-branch"
      layout
      initial={shouldReduceMotion ? false : { opacity: 0, y: -12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.86 }}
      transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
    >
      <motion.div
        className={[
          "tree-node-pill",
          isVisited ? "is-visited-tree-node" : "",
          isActive ? "is-active-tree-node" : ""
        ].filter(Boolean).join(" ")}
        layout
      >
        <span>{formatVariableValue(node.value)}</span>
      </motion.div>

      {hasChildren && (
        <div className="tree-children">
          <svg
            className="tree-connector-svg"
            viewBox="0 0 100 38"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {node.leftId && nodesById.has(node.leftId) && (
              <line
                className={[
                  "tree-connector-line",
                  "is-left-tree-edge",
                  isVisited && tree.visitedIds.includes(node.leftId)
                    ? "is-traversed-tree-edge"
                    : ""
                ].filter(Boolean).join(" ")}
                x1="50"
                y1="0"
                x2="25"
                y2="38"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {node.rightId && nodesById.has(node.rightId) && (
              <line
                className={[
                  "tree-connector-line",
                  "is-right-tree-edge",
                  isVisited && tree.visitedIds.includes(node.rightId)
                    ? "is-traversed-tree-edge"
                    : ""
                ].filter(Boolean).join(" ")}
                x1="50"
                y1="0"
                x2="75"
                y2="38"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          <div className={`tree-child-slot${node.leftId ? " has-tree-child" : ""}`}>
            {node.leftId ? (
              <TreeNodeBranch
                nodeId={node.leftId}
                nodesById={nodesById}
                tree={tree}
                shouldReduceMotion={shouldReduceMotion}
              />
            ) : <span className="tree-empty-slot" />}
          </div>

          <div className={`tree-child-slot${node.rightId ? " has-tree-child" : ""}`}>
            {node.rightId ? (
              <TreeNodeBranch
                nodeId={node.rightId}
                nodesById={nodesById}
                tree={tree}
                shouldReduceMotion={shouldReduceMotion}
              />
            ) : <span className="tree-empty-slot" />}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TreeVisualization({ tree }) {
  const shouldReduceMotion = useReducedMotion();

  if (!tree) {
    return null;
  }

  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]));

  return (
    <motion.div
      className="visualization-card tree-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <GitBranch size={16} />
          <span>Binary Search Tree</span>
        </div>

        <span className="structure-name">{tree.name}</span>
      </div>

      <div className="tree-stage">
        {tree.rootId && nodesById.has(tree.rootId) ? (
          <>
            <span className="tree-root-label">ROOT</span>
            <AnimatePresence initial={false} mode="popLayout">
              <TreeNodeBranch
                key={tree.rootId}
                nodeId={tree.rootId}
                nodesById={nodesById}
                tree={tree}
                shouldReduceMotion={shouldReduceMotion}
              />
            </AnimatePresence>
          </>
        ) : (
          <div className="empty-tree">Waiting for the first inserted value</div>
        )}
      </div>

      {tree.traversalOrder.length > 0 && (
        <motion.div
          className="tree-traversal-row"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>INORDER</span>
          <div>
            {tree.traversalOrder.map((value, index) => (
              <motion.span
                key={`${index}:${JSON.stringify(value)}`}
                layout
              >
                {formatVariableValue(value)}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      <div className="tree-caption">
        Educational BST shape reconstructed from insertion order
      </div>
    </motion.div>
  );
}

function getHeapNodePosition(index) {
  const level = Math.floor(Math.log2(index + 1));
  const firstIndexAtLevel = (2 ** level) - 1;
  const positionAtLevel = index - firstIndexAtLevel;
  const countAtLevel = 2 ** level;

  return {
    x: ((positionAtLevel + 0.5) / countAtLevel) * 100,
    y: 18 + level * 76
  };
}

function HeapVisualization({ heap }) {
  const shouldReduceMotion = useReducedMotion();

  if (!heap) {
    return null;
  }

  const levelCount = heap.values.length > 0
    ? Math.floor(Math.log2(heap.values.length)) + 1
    : 1;
  const stageHeight = Math.max(126, 43 + levelCount * 76);
  const activeIndices = new Set(heap.activeIndices || []);

  return (
    <motion.div
      className="visualization-card heap-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Layers3 size={16} />
          <span>Min Heap</span>
        </div>

        <div className="heap-heading-meta">
          <span>{heap.values.length} {heap.values.length === 1 ? "item" : "items"}</span>
          <span className="structure-name">{heap.name}</span>
        </div>
      </div>

      <div className="heap-stage" style={{ height: stageHeight }}>
        <span className="heap-root-label">MIN ROOT</span>

        {heap.values.length > 0 ? (
          <>
            <svg
              className="heap-connector-svg"
              viewBox={`0 0 100 ${stageHeight}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {heap.values.slice(1).map((_, indexOffset) => {
                const childIndex = indexOffset + 1;
                const parentIndex = Math.floor((childIndex - 1) / 2);
                const parent = getHeapNodePosition(parentIndex);
                const child = getHeapNodePosition(childIndex);
                const isActiveEdge = activeIndices.has(parentIndex) && activeIndices.has(childIndex);

                return (
                  <line
                    key={`heap-edge:${parentIndex}:${childIndex}`}
                    className={`heap-connector-line${isActiveEdge ? " is-active-heap-edge" : ""}`}
                    x1={parent.x}
                    y1={parent.y + 39}
                    x2={child.x}
                    y2={child.y}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            <AnimatePresence initial={false} mode="popLayout">
              {heap.values.map((value, index) => {
                const position = getHeapNodePosition(index);
                const isActive = activeIndices.has(index);
                const isSwapNode = heap.swap && (
                  heap.swap.fromIndex === index || heap.swap.toIndex === index
                );

                return (
                  <motion.div
                    key={`heap-node:${index}`}
                    className={[
                      "heap-node",
                      index === 0 ? "is-heap-root" : "",
                      isActive ? "is-active-heap-node" : "",
                      isSwapNode ? "is-swapping-heap-node" : ""
                    ].filter(Boolean).join(" ")}
                    style={{ left: `${position.x}%`, top: position.y, x: "-50%" }}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: -12, scale: 0.82 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.78 }}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                  >
                    <span className="heap-node-index">{index}</span>
                    <AnimatedValue value={value} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        ) : (
          <div className="empty-heap">Waiting for the first inserted value</div>
        )}
      </div>

      <div className="heap-array-row">
        <span>BACKING ARRAY</span>
        <div>
          {heap.values.map((value, index) => (
            <motion.span
              key={`heap-array:${index}`}
              className={activeIndices.has(index) ? "is-active-heap-array-value" : ""}
              layout
            >
              <small>{index}</small>
              {formatVariableValue(value)}
            </motion.span>
          ))}
        </div>
      </div>

      <div className="heap-caption">
        Complete binary tree · every parent is less than or equal to its children
      </div>
    </motion.div>
  );
}

function getGraphLayout(graph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of graph.edges || []) {
    if (!adjacency.has(edge.sourceId) || !adjacency.has(edge.targetId)) {
      continue;
    }

    adjacency.get(edge.sourceId).push(edge.targetId);

    if (!graph.directed) {
      adjacency.get(edge.targetId).push(edge.sourceId);
    }
  }

  const levels = new Map();
  const pending = [];

  for (const node of nodes) {
    if (levels.has(node.id)) {
      continue;
    }

    levels.set(node.id, pending.length === 0 && levels.size === 0 ? 0 : 1);
    pending.push(node.id);

    while (pending.length > 0) {
      const currentId = pending.shift();

      for (const adjacentId of adjacency.get(currentId) || []) {
        if (!levels.has(adjacentId)) {
          levels.set(adjacentId, levels.get(currentId) + 1);
          pending.push(adjacentId);
        }
      }
    }
  }

  const byLevel = new Map();

  for (const node of nodes) {
    const level = levels.get(node.id) || 0;
    const group = byLevel.get(level) || [];

    group.push(node);
    byLevel.set(level, group);
  }

  const positions = new Map();

  for (const [level, group] of byLevel) {
    group.forEach((node, index) => {
      positions.set(node.id, {
        x: ((index + 1) / (group.length + 1)) * 100,
        y: 25 + level * 84,
        level
      });
    });
  }

  return {
    positions,
    height: Math.max(156, 92 + Math.max(0, ...levels.values()) * 84)
  };
}

function GraphVisualization({ graph }) {
  const shouldReduceMotion = useReducedMotion();

  if (!graph) {
    return null;
  }

  const { positions, height } = getGraphLayout(graph);
  const visitedIds = new Set(graph.visitedIds || []);

  return (
    <motion.div
      className="visualization-card graph-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Workflow size={16} />
          <span>{graph.directed ? "Directed Graph" : "Graph"}</span>
        </div>

        <div className="graph-heading-meta">
          <span>{graph.nodes.length} nodes · {graph.edges.length} edges</span>
          <span className="structure-name">{graph.name}</span>
        </div>
      </div>

      <div className="graph-stage" style={{ height }}>
        <span className="graph-kind-label">
          {graph.directed ? "DIRECTED CONNECTIONS" : "UNDIRECTED CONNECTIONS"}
        </span>

        {graph.nodes.length > 0 ? (
          <>
            <svg
              className="graph-connector-svg"
              viewBox={`0 0 100 ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {graph.edges.map((edge) => {
                const source = positions.get(edge.sourceId);
                const target = positions.get(edge.targetId);

                if (!source || !target) {
                  return null;
                }

                const isActive = edge.id === graph.activeEdgeId;
                const isVisited = visitedIds.has(edge.sourceId) && visitedIds.has(edge.targetId);

                return (
                  <line
                    key={edge.id}
                    className={[
                      "graph-connector-line",
                      isVisited ? "is-visited-graph-edge" : "",
                      isActive ? "is-active-graph-edge" : ""
                    ].filter(Boolean).join(" ")}
                    x1={source.x}
                    y1={source.y + 22}
                    x2={target.x}
                    y2={target.y + 22}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            <AnimatePresence initial={false} mode="popLayout">
              {graph.nodes.map((node) => {
                const position = positions.get(node.id);
                const isActive = graph.activeNodeId === node.id;
                const isVisited = visitedIds.has(node.id);

                return (
                  <motion.div
                    key={node.id}
                    className={[
                      "graph-node",
                      isVisited ? "is-visited-graph-node" : "",
                      isActive ? "is-active-graph-node" : ""
                    ].filter(Boolean).join(" ")}
                    style={{ left: `${position.x}%`, top: position.y, x: "-50%" }}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.65, y: -10 }}
                    animate={{ opacity: 1, scale: isActive ? 1.09 : 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.72 }}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                  >
                    <span>{String(node.value)}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        ) : (
          <div className="empty-graph">Waiting for the first graph vertex</div>
        )}
      </div>

      <div className="graph-traversal-row">
        <span>{graph.traversalType ? graph.traversalType.toUpperCase() : "VISIT ORDER"}</span>

        <div>
          {(graph.traversalOrder || []).map((value, index) => (
            <motion.span
              key={`${graph.name}:visit:${index}:${String(value)}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
              layout
            >
              {typeof value === "string" ? value : formatVariableValue(value)}
            </motion.span>
          ))}
        </div>
      </div>

      <div className="graph-caption">
        Direct node connections · synchronized breadth-first and depth-first traversal
      </div>
    </motion.div>
  );
}

function SearchVisualization({ search }) {
  const shouldReduceMotion = useReducedMotion();

  if (!search) {
    return null;
  }

  const isBinary = search.algorithm === "binary";
  const compared = new Set(search.comparedIndices || []);
  const eliminated = new Set(search.eliminatedIndices || []);

  function pointerLabels(index) {
    if (!isBinary) {
      return search.activeIndex === index ? ["CHECK"] : [];
    }

    return [
      search.low === index ? "LOW" : null,
      search.middle === index ? "MID" : null,
      search.high === index ? "HIGH" : null
    ].filter(Boolean);
  }

  return (
    <motion.div
      className="visualization-card search-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Search size={16} />
          <span>{isBinary ? "Binary Search" : "Linear Search"}</span>
        </div>

        <div className="search-heading-meta">
          <span className="search-complexity">{isBinary ? "O(log n)" : "O(n)"}</span>
          <span className="structure-name">{search.arrayName}</span>
        </div>
      </div>

      <div className="search-summary-grid">
        <div className="search-summary-item">
          <span>Target</span>
          <strong>{formatVariableValue(search.target)}</strong>
        </div>

        <div className="search-summary-item">
          <span>Comparisons</span>
          <strong>{search.comparisonCount}</strong>
        </div>

        <div className="search-summary-item">
          <span>{isBinary ? "Active range" : "Checked"}</span>
          <strong>
            {isBinary
              ? search.low <= search.high
                ? `[${search.low}, ${search.high}]`
                : "empty"
              : `${compared.size} / ${search.values.length}`}
          </strong>
        </div>

        <div className="search-summary-item">
          <span>Result</span>
          <strong className={search.found ? "search-success-value" : ""}>
            {search.found
              ? `index ${search.foundIndex}`
              : search.finished ? "not found" : "searching"}
          </strong>
        </div>
      </div>

      <div className="search-array-stage" aria-label={`${isBinary ? "Binary" : "Linear"} search visualization`}>
        <div className="search-cells">
          <AnimatePresence initial={false} mode="popLayout">
            {search.values.map((value, index) => {
              const isFound = search.found && search.foundIndex === index;
              const isActive = search.activeIndex === index && !isFound;
              const labels = pointerLabels(index);

              return (
                <motion.div
                  key={`search-cell-${index}`}
                  className={[
                    "search-cell-column",
                    eliminated.has(index) ? "is-eliminated-search-cell" : "",
                    compared.has(index) ? "is-compared-search-cell" : "",
                    isActive ? "is-active-search-cell" : "",
                    isFound ? "is-found-search-cell" : ""
                  ].filter(Boolean).join(" ")}
                  layout
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
                >
                  <span className="search-cell-index">{index}</span>

                  <motion.div
                    className="search-cell-value"
                    animate={{ scale: isActive || isFound ? 1.07 : 1 }}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                  >
                    {formatVariableValue(value)}
                  </motion.div>

                  <div className="search-pointer-row">
                    {labels.map((label) => (
                      <span
                        key={label}
                        className={`search-pointer search-pointer-${label.toLowerCase()}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="search-legend">
        <span><i className="search-legend-dot is-active-dot" /> active</span>
        <span><i className="search-legend-dot is-compared-dot" /> compared</span>
        <span><i className="search-legend-dot is-eliminated-dot" /> eliminated</span>
        <span><i className="search-legend-dot is-found-dot" /> found</span>
      </div>
    </motion.div>
  );
}

function SortVisualization({ sort }) {
  const shouldReduceMotion = useReducedMotion();

  if (!sort) {
    return null;
  }

  const labels = {
    bubble: "Bubble Sort",
    selection: "Selection Sort",
    insertion: "Insertion Sort",
    merge: "Merge Sort",
    quick: "Quick Sort"
  };
  const isMergeSort = sort.algorithm === "merge";
  const isQuickSort = sort.algorithm === "quick";
  const isDivideAndConquer = isMergeSort || isQuickSort;
  const compared = new Set(sort.compareIndices || []);
  const swapped = new Set(sort.swapIndices || []);
  const sorted = new Set(sort.sortedIndices || []);
  const largestMagnitude = Math.max(...sort.values.map((value) => Math.abs(value)), 1);
  const orderedCount = sorted.size;
  const changes = isMergeSort || sort.algorithm === "insertion"
    ? sort.writeCount
    : sort.swapCount;
  const rangeStart = Number.isInteger(sort.rangeStart) ? sort.rangeStart : 0;
  const rangeEnd = Number.isInteger(sort.rangeEnd) ? sort.rangeEnd : sort.values.length - 1;
  const leftRange = Array.isArray(sort.leftRange) ? sort.leftRange : null;
  const rightRange = Array.isArray(sort.rightRange) ? sort.rightRange : null;

  return (
    <motion.div
      className="visualization-card sort-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <ArrowUpDown size={16} />
          <span>{labels[sort.algorithm] || "Sorting"}</span>
        </div>

        <div className="sort-heading-meta">
          <span className="sort-complexity">{isDivideAndConquer ? "O(n log n)" : "O(n²)"}</span>
          <span className="structure-name">{sort.arrayName}</span>
        </div>
      </div>

      <div className="sort-summary-grid">
        <div className="sort-summary-item">
          <span>{isDivideAndConquer ? "Depth" : "Pass"}</span>
          <strong>{isDivideAndConquer ? sort.depth || 0 : sort.pass || 0}</strong>
        </div>

        <div className="sort-summary-item">
          <span>Comparisons</span>
          <strong>{sort.comparisonCount || 0}</strong>
        </div>

        <div className="sort-summary-item">
          <span>{isMergeSort || sort.algorithm === "insertion" ? "Writes" : "Swaps"}</span>
          <strong>{changes || 0}</strong>
        </div>

        <div className="sort-summary-item">
          <span>Status</span>
          <strong className={sort.finished ? "sort-complete-value" : ""}>
            {sort.finished ? "sorted" : `${orderedCount} / ${sort.values.length}`}
          </strong>
        </div>
      </div>

      {isDivideAndConquer ? (
        <div className="sort-strategy-strip">
          <span className="sort-strategy-title">DIVIDE &amp; CONQUER</span>
          <span className="sort-range-badge">range [{rangeStart}, {rangeEnd}]</span>
          {isMergeSort && Number.isInteger(sort.middle) ? (
            <span className="sort-phase-badge">split at {sort.middle}</span>
          ) : null}
          {isQuickSort && sort.pivotValue !== null && sort.pivotValue !== undefined ? (
            <span className="sort-phase-badge">pivot {sort.pivotValue}</span>
          ) : null}
          <span className="sort-phase-badge">{sort.phase || "ready"}</span>
        </div>
      ) : null}

      <div className="sort-stage" aria-label={`${labels[sort.algorithm] || "Sorting"} visualization`}>
        <div className="sort-bars">
          <AnimatePresence initial={false} mode="popLayout">
            {sort.values.map((value, index) => {
              const isSwap = swapped.has(index);
              const isCompare = compared.has(index);
              const isSorted = sorted.has(index);
              const isMinimum = sort.minIndex === index;
              const isKey = sort.keyIndex === index;
              const isOutsideRange = isDivideAndConquer
                && !sort.finished
                && (index < rangeStart || index > rangeEnd);
              const isPivot = isQuickSort && sort.pivotIndex === index;
              const isMiddle = isMergeSort && sort.middle === index;
              const isLeftRange = leftRange && index >= leftRange[0] && index <= leftRange[1];
              const isRightRange = rightRange && index >= rightRange[0] && index <= rightRange[1];
              const barHeight = Math.max(30, Math.round((Math.abs(value) / largestMagnitude) * 128));

              return (
                <motion.div
                  key={`sort-position-${index}`}
                  className={[
                    "sort-column",
                    isSorted ? "is-sorted-column" : "",
                    isCompare ? "is-compared-column" : "",
                    isSwap ? "is-swapped-column" : "",
                    isMinimum ? "is-minimum-column" : "",
                    isKey ? "is-key-column" : "",
                    isOutsideRange ? "is-outside-range-column" : "",
                    isPivot ? "is-pivot-column" : "",
                    isLeftRange ? "is-left-partition-column" : "",
                    isRightRange ? "is-right-partition-column" : ""
                  ].filter(Boolean).join(" ")}
                  layout
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
                >
                  <div className="sort-marker-row">
                    {isMinimum ? <span className="sort-marker sort-marker-minimum">MIN</span> : null}
                    {isKey ? <span className="sort-marker sort-marker-key">KEY</span> : null}
                    {isPivot ? <span className="sort-marker sort-marker-pivot">PIVOT</span> : null}
                    {isMiddle ? <span className="sort-marker sort-marker-boundary">MID</span> : null}
                    {isLeftRange && !isMiddle ? <span className="sort-marker sort-marker-left">L</span> : null}
                    {isRightRange ? <span className="sort-marker sort-marker-right">R</span> : null}
                  </div>

                  <motion.div
                    className="sort-bar"
                    animate={{
                      height: barHeight,
                      scale: isSwap ? 1.08 : isCompare ? 1.04 : 1
                    }}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                  >
                    <AnimatedValue value={value} className="sort-bar-value" />
                  </motion.div>

                  <span className="sort-index">{index}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="sort-progress">
        <span>ORDERED</span>
        <div className="sort-progress-track">
          <motion.div
            className="sort-progress-fill"
            animate={{ width: `${sort.values.length ? (orderedCount / sort.values.length) * 100 : 0}%` }}
            transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
          />
        </div>
        <strong>{orderedCount}/{sort.values.length}</strong>
      </div>

      <div className="sort-legend">
        <span><i className="sort-legend-dot is-sort-default-dot" /> unsorted</span>
        <span><i className="sort-legend-dot is-sort-compare-dot" /> comparing</span>
        <span><i className="sort-legend-dot is-sort-swap-dot" /> changing</span>
        <span><i className="sort-legend-dot is-sort-done-dot" /> ordered</span>
      </div>
    </motion.div>
  );
}

function InputVisualization({ input }) {
  if (!input?.current) {
    return null;
  }

  const current = input.current;
  return (
    <motion.div className="input-visualization-card" layout>
      <div className="input-visualization-icon"><Keyboard size={17} /></div>
      <div>
        <span>PROGRAM INPUT #{current.inputNumber}</span>
        <strong>{current.prompt || "Input read"}</strong>
      </div>
      <code>{formatVariableValue(current.rawValue ?? current.value)}</code>
      <small>{input.remaining} remaining</small>
    </motion.div>
  );
}

function ErrorVisualization({ error }) {
  if (!error) {
    return null;
  }

  return (
    <motion.div
      className="error-visualization-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
    >
      <div className="error-visualization-heading">
        <AlertTriangle size={18} />
        <div>
          <span>{error.phase || "execute"} · {error.category || "runtime"}</span>
          <strong>{error.name || error.errorType || "Execution error"}</strong>
        </div>
      </div>
      <p>{error.message}</p>
      {error.sourceExcerpt && <code>{error.sourceExcerpt}</code>}
      {error.hint && <div className="error-hint"><Sparkles size={14} />{error.hint}</div>}
      {Array.isArray(error.frames) && error.frames.length > 0 && (
        <div className="error-frame-list">
          {error.frames.slice(-5).reverse().map((frame, index) => (
            <span key={`${frame.functionName}-${frame.line}-${index}`}>
              <code>{frame.functionName}()</code> line {frame.line}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function DynamicProgrammingVisualization({ dynamicProgramming }) {
  const shouldReduceMotion = useReducedMotion();

  if (!dynamicProgramming) {
    return null;
  }

  const labels = {
    "fibonacci-memo": "Fibonacci Memoization",
    "fibonacci-tabulation": "Fibonacci Tabulation",
    "knapsack-01": "0/1 Knapsack"
  };
  const readCells = new Set(
    dynamicProgramming.readCells.map(([row, column]) => `${row}:${column}`)
  );
  const writtenCell = dynamicProgramming.writtenCell?.join(":");
  const resultCell = dynamicProgramming.resultCell?.join(":");
  const completedRows = new Set(dynamicProgramming.completedRows);

  function cellClass(row, column) {
    const key = `${row}:${column}`;
    return [
      "dp-cell",
      readCells.has(key) ? "is-dp-read" : "",
      writtenCell === key ? "is-dp-written" : "",
      resultCell === key ? "is-dp-result" : "",
      dynamicProgramming.activeRow === row && dynamicProgramming.activeColumn === column
        ? "is-dp-active"
        : "",
      completedRows.has(row) ? "is-dp-row-complete" : ""
    ].filter(Boolean).join(" ");
  }

  return (
    <motion.div
      className="visualization-card dp-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Table2 size={16} />
          <span>{labels[dynamicProgramming.algorithm] || "Dynamic Programming"}</span>
        </div>

        <div className="dp-heading-meta">
          <span className="dp-dimension">{dynamicProgramming.dimension?.toUpperCase()}</span>
          <span className="structure-name">{dynamicProgramming.phase || "ready"}</span>
        </div>
      </div>

      <div className="dp-summary-grid">
        <div><span>Reads</span><strong>{dynamicProgramming.readCount}</strong></div>
        <div><span>Writes</span><strong>{dynamicProgramming.writeCount}</strong></div>
        <div><span>Cache hits</span><strong>{dynamicProgramming.cacheHitCount}</strong></div>
        <div>
          <span>Result</span>
          <strong className={dynamicProgramming.finished ? "dp-result-value" : ""}>
            {dynamicProgramming.finished
              ? formatVariableValue(dynamicProgramming.result)
              : "building"}
          </strong>
        </div>
      </div>

      {(dynamicProgramming.decision || dynamicProgramming.cacheStatus) && (
        <motion.div
          className={`dp-decision-strip${dynamicProgramming.cacheStatus ? ` is-cache-${dynamicProgramming.cacheStatus}` : ""}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Workflow size={15} />
          <span>
            {dynamicProgramming.cacheStatus
              ? `Cache ${dynamicProgramming.cacheStatus}: state ${formatVariableValue(dynamicProgramming.stateKey)}`
              : String(dynamicProgramming.decision).replaceAll("-", " ")}
          </span>
          {dynamicProgramming.chosenValue !== null && (
            <strong>→ {formatVariableValue(dynamicProgramming.chosenValue)}</strong>
          )}
        </motion.div>
      )}

      <div className="dp-table-scroll">
        <div
          className="dp-table"
          style={{
            gridTemplateColumns: `minmax(92px, auto) repeat(${dynamicProgramming.columns}, minmax(58px, 1fr))`
          }}
          aria-label={`${labels[dynamicProgramming.algorithm] || "Dynamic programming"} table`}
        >
          <span className="dp-corner-cell">STATE</span>
          {dynamicProgramming.columnLabels.map((label, column) => (
            <span className="dp-column-label" key={`dp-column-${column}`}>{label}</span>
          ))}

          {dynamicProgramming.table.map((rowValues, row) => (
            <div className="dp-row-contents" key={`dp-row-${row}`}>
              <span className={`dp-row-label${completedRows.has(row) ? " is-dp-row-complete" : ""}`}>
                {dynamicProgramming.rowLabels[row] || `row ${row}`}
              </span>
              {rowValues.map((value, column) => (
                <motion.span
                  className={cellClass(row, column)}
                  key={`dp-cell-${row}-${column}`}
                  animate={{
                    scale: dynamicProgramming.activeRow === row
                      && dynamicProgramming.activeColumn === column ? 1.06 : 1
                  }}
                  transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                >
                  {value === null || value === undefined ? "—" : formatVariableValue(value)}
                </motion.span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="dp-legend">
        <span><i className="dp-legend-dot is-dp-read-dot" /> dependency</span>
        <span><i className="dp-legend-dot is-dp-write-dot" /> written</span>
        <span><i className="dp-legend-dot is-dp-result-dot" /> result</span>
      </div>
    </motion.div>
  );
}

function HanoiVisualization({ hanoi }) {
  const shouldReduceMotion = useReducedMotion();

  if (!hanoi) {
    return null;
  }

  const pegNames = ["A", "B", "C"];
  const visibleFrames = [...hanoi.frames].reverse().slice(0, 6);
  const progress = hanoi.expectedMoves
    ? Math.round((hanoi.moveNumber / hanoi.expectedMoves) * 100)
    : 0;

  return (
    <motion.div
      className="visualization-card hanoi-card"
      layout
      transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
    >
      <div className="visualization-card-heading">
        <div className="visualization-card-title">
          <Layers3 size={16} />
          <span>Tower of Hanoi</span>
        </div>
        <div className="hanoi-heading-meta">
          <span className="hanoi-depth">Depth {hanoi.depth} / {hanoi.maxDepth}</span>
          <span className={`structure-name${hanoi.finished ? " is-hanoi-complete" : ""}`}>
            {hanoi.finished ? "complete" : hanoi.phase || "ready"}
          </span>
        </div>
      </div>

      <div className="hanoi-summary-grid">
        <div><span>Disks</span><strong>{hanoi.diskCount}</strong></div>
        <div><span>Move</span><strong>{hanoi.moveNumber} / {hanoi.expectedMoves}</strong></div>
        <div><span>Current disk</span><strong>{hanoi.disk ?? "—"}</strong></div>
        <div><span>Route</span><strong>{hanoi.from && hanoi.to ? `${hanoi.from} → ${hanoi.to}` : `${hanoi.source} → ${hanoi.target}`}</strong></div>
      </div>

      <div className="hanoi-stage" aria-label="Tower of Hanoi peg and disk visualization">
        {pegNames.map((pegName) => {
          const disks = [...hanoi.pegs[pegName]].reverse();
          const isSource = hanoi.operation === "HANOI_MOVE" && hanoi.from === pegName;
          const isTarget = hanoi.operation === "HANOI_MOVE" && hanoi.to === pegName;
          return (
            <div
              className={`hanoi-peg${isSource ? " is-hanoi-source" : ""}${isTarget ? " is-hanoi-target" : ""}`}
              key={`hanoi-peg-${pegName}`}
            >
              <div className="hanoi-rod" />
              <div className="hanoi-disks">
                <AnimatePresence initial={false}>
                  {disks.map((disk) => (
                    <motion.div
                      className={`hanoi-disk${hanoi.disk === disk && hanoi.operation === "HANOI_MOVE" ? " is-moving-disk" : ""}`}
                      key={`hanoi-disk-${disk}`}
                      layoutId={`hanoi-${hanoi.id}-disk-${disk}`}
                      style={{ width: `${38 + (disk / Math.max(hanoi.diskCount, 1)) * 55}%` }}
                      transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
                    >
                      {disk}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="hanoi-base" />
              <strong className="hanoi-peg-label">PEG {pegName}</strong>
            </div>
          );
        })}
      </div>

      <div className="hanoi-progress-row">
        <span>OPTIMAL MOVES</span>
        <div className="hanoi-progress-track">
          <motion.div
            className="hanoi-progress-fill"
            animate={{ width: `${progress}%` }}
            transition={shouldReduceMotion ? { duration: 0 } : SOFT_SPRING_TRANSITION}
          />
        </div>
        <strong>{progress}%</strong>
      </div>

      <div className="hanoi-frame-strip">
        <span className="hanoi-frame-label">RECURSIVE FRAMES</span>
        {visibleFrames.length ? visibleFrames.map((frame, index) => (
          <motion.span
            className={index === 0 ? "is-hanoi-top-frame" : ""}
            key={frame.id}
            layout
          >
            n={frame.diskCount} · {frame.from}→{frame.to} · d{frame.depth}
          </motion.span>
        )) : <em>All recursive frames returned.</em>}
      </div>
    </motion.div>
  );
}

function RecursionVisualization({ recursion }) {
  const shouldReduceMotion = useReducedMotion();

  if (!recursion) {
    return null;
  }

  const frames = [...recursion.frames].reverse();
  const returnValue = recursion.lastReturn?.returnValue;

  return (
    <motion.div
      className="visualization-card recursion-card"
      layout
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
    >
      <div className="visualization-card-heading recursion-heading">
        <div>
          <span className="recursion-kicker">RECURSION & CALL STACK</span>
          <h3>{recursion.functionName}</h3>
        </div>

        <div className="recursion-metrics">
          <span>Depth {recursion.depth}</span>
          <span>Max {recursion.maxDepth}</span>
        </div>
      </div>

      <div className="recursion-flow-status">
        <span className={recursion.unwinding ? "is-unwinding" : "is-growing"}>
          <Workflow size={15} />
          {recursion.unwinding ? "Stack unwinding" : "Stack growing"}
        </span>

        {recursion.baseCase && (
          <span className="base-case-badge">
            Base case: depth {recursion.baseCase.recursionDepth}
          </span>
        )}
      </div>

      <div className="recursion-stack" aria-label={`${recursion.functionName} recursive call stack`}>
        <AnimatePresence initial={false} mode="popLayout">
          {frames.map((frame, index) => {
            const parameterEntries = Object.entries(frame.parameters || {});
            const localEntries = Object.entries(frame.locals || {}).filter(
              ([name]) => !Object.hasOwn(frame.parameters || {}, name)
            );

            return (
              <motion.div
                className={`recursion-frame${index === 0 ? " is-stack-top" : ""}`}
                key={frame.id || `${frame.name}-${frame.recursionDepth}`}
                layout
                initial={shouldReduceMotion ? false : { opacity: 0, x: 18, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, x: -18, scale: 0.98 }}
                transition={shouldReduceMotion ? { duration: 0 } : SPRING_TRANSITION}
              >
                <div className="recursion-frame-index">
                  {frame.recursionDepth}
                </div>

                <div className="recursion-frame-body">
                  <div className="recursion-frame-title">
                    <code>{frame.name}()</code>
                    {index === 0 && <span>STACK TOP</span>}
                  </div>

                  <div className="recursion-frame-values">
                    {parameterEntries.length > 0 ? parameterEntries.map(([name, value]) => (
                      <span key={`parameter-${name}`}>
                        <small>{name}</small>
                        <strong>{formatVariableValue(value)}</strong>
                      </span>
                    )) : <em>No parameters</em>}

                    {localEntries.slice(0, 3).map(([name, value]) => (
                      <span className="is-local" key={`local-${name}`}>
                        <small>{name}</small>
                        <strong>{formatVariableValue(value)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {frames.length === 0 && (
          <div className="recursion-stack-empty">
            All recursive frames returned.
          </div>
        )}
      </div>

      {recursion.lastReturn && (
        <motion.div
          className={`recursion-return-strip${recursion.lastReturn.baseCase ? " is-base-case" : ""}`}
          key={`return-${recursion.lastReturn.id}-${String(returnValue)}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ArrowRight size={15} />
          <span>
            {recursion.lastReturn.baseCase ? "Base return" : "Returned"}
          </span>
          <code>{formatVariableValue(returnValue)}</code>
          <small>from depth {recursion.lastReturn.recursionDepth}</small>
        </motion.div>
      )}
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

      <ErrorVisualization error={step.error} />
      <InputVisualization input={step.input} />

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
        <HanoiVisualization
          hanoi={step.hanoi}
        />

        <RecursionVisualization
          recursion={step.recursion}
        />

        <DynamicProgrammingVisualization
          dynamicProgramming={step.dynamicProgramming}
        />

        <SearchVisualization
          search={step.search}
        />

        <SortVisualization
          sort={step.sort}
        />

        <ArrayVisualization
          array={step.array}
        />

        <StackVisualization
          stack={step.stack}
        />

        <QueueVisualization
          queue={step.queue}
        />

        <LinkedListVisualization
          linkedList={step.linkedList}
        />

        <HashMapVisualization
          hashMap={step.hashMap}
        />

        <TreeVisualization
          tree={step.tree}
        />

        <HeapVisualization
          heap={step.heap}
        />

        <GraphVisualization
          graph={step.graph}
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
