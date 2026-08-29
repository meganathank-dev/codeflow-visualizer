# Phase 7 — Algorithms and Complete Algorithm Closure

## Status

Completed.

## Objective

Build a verified cross-language algorithm-learning layer on top of the shared
trace architecture and close the complete algorithm regression suite.

## 7A — Searching Algorithms

- Linear search with sequential comparisons and found/not-found results.
- Binary search with low, high, and middle bounds.
- Search start, comparison, range update, found, not-found, and completion
  events.

## 7B — Basic Sorting Algorithms

- Bubble Sort.
- Selection Sort.
- Insertion Sort.
- Comparisons, swaps, writes, shifts, passes, and sorted-position marking.

## 7C — Advanced Sorting Algorithms

- Merge Sort with recursive splits, merge ranges, and writes.
- Quick Sort with pivot selection, partitions, comparisons, swaps, and final
  sorted ranges.

## 7D — Recursion

- Factorial.
- Fibonacci.
- Recursive array sum.
- Recursive parameters, depth, base cases, active frames, return values, and
  stack unwinding.

## 7E — Dynamic Programming

- Fibonacci memoization.
- Fibonacci tabulation.
- 0/1 Knapsack.
- Cache hits and misses, state reads and writes, choices, completed rows,
  table dimensions, and final results.

## 7F — Tower of Hanoi and Closure

- Recursive Hanoi calls and returns.
- Legal disk movement across source, auxiliary, and destination pegs.
- Current move, completed moves, recursion frames, and optimal move count.
- Invalid disk-count and recursion-limit protection.
- Complete Phase 7 regression closure across JavaScript, Python, and Java.

## Algorithm Event Families

```text
SEARCH_*
SORT_*
FUNCTION_* and recursion frame metadata
DP_*
HANOI_*
```

## Verification

- Linear and binary search passed in all three languages.
- Basic and advanced sorting passed with synchronized comparisons and writes.
- Factorial, Fibonacci, and recursive sum passed with call-stack unwinding.
- Memoization, tabulation, and knapsack passed with correct DP state.
- Tower of Hanoi passed with legal peg state and optimal moves.
- Shared trace compatibility, syntax errors, restricted source rejection, and
  existing language boundaries remained green.
- Core reconstruction, frontend presentation, and the complete execution
  regression suite passed.

## Primary Commands

```cmd
pnpm test:trace
pnpm test:core
pnpm test:execution
pnpm test:web
pnpm test
```
