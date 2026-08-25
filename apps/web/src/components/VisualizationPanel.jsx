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
  KeyRound,
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
