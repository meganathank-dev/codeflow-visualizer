# Phase 6 — Cross-Language Data Structures

## Status

Completed.

## Objective

Expand CodeFlow from basic variables and arrays into reusable data-structure
visualizations driven by equivalent JavaScript, Python, and Java traces.

## Completed Modules

### Queue

- Creation, enqueue, peek, and dequeue events.
- FIFO ordering, front value, removed value, and synchronized variables.

### Linked List

- List creation and stable node identities.
- Node creation, insertion, deletion, traversal, and reference updates.
- Pointer/reference edges reconstructed independently from array indexes.

### HashMap

- Map creation, insertion, update, lookup, existence check, and deletion.
- Language-specific objects normalized into shared key-value entries.

### Binary Search Tree

- Root and child insertion.
- Search comparison path.
- Inorder traversal and active-node highlighting.

### Min Heap

- Insert, bubble-up, peek, extract, swap, and bubble-down operations.
- Heap array and tree diagram synchronized at every event.

### Graph

- Node and undirected edge creation.
- Breadth-first and depth-first traversal.
- Direct-edge traversal, visited order, queued paths, and active-node state.

## Shared Event Families

```text
QUEUE_*        LINKED_LIST_CREATE / NODE_* / REFERENCE_UPDATE
HASHMAP_*      TREE_*
HEAP_*         GRAPH_*
```

Each language adapter emits the same semantic event family. The visualizer
therefore renders one queue, linked-list, map, tree, heap, or graph component
rather than maintaining three language-specific copies.

## Verification

- Queue behavior and front/removed variables passed in all three languages.
- Linked-list insertion, deletion, traversal, and references passed.
- HashMap insertion, update, lookup, and deletion passed.
- BST insertion, search path, and inorder traversal passed.
- Min-heap ordering, bubble operations, peek, and extraction passed.
- Graph nodes, edges, BFS, DFS, and visited paths passed.
- Core reconstruction and frontend animation-state tests passed for every
  structure.

## Primary Commands

```cmd
pnpm test:trace
pnpm test:core
pnpm test:execution
pnpm test:web
```
