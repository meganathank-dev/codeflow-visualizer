# Phase 5 — Real SQL and Relational Visualization

## Status

Completed.

## Objective

Execute real SQL against an isolated teaching database and visualize the
logical relational procedure without pretending to expose SQLite's internal
physical query plan.

## Delivered

- Dedicated SQL adapter and Python worker process.
- Fresh private in-memory SQLite database for each execution.
- Deterministic teaching dataset used by examples and regression tests.
- Query validation with multi-statement and unsupported-shape protection.
- Actual SQLite result verification.
- Logical query events for:
  - query start and completion;
  - table scanning;
  - row filtering;
  - column projection;
  - joins;
  - grouping and aggregation;
  - sorting;
  - distinct values;
  - limits;
  - final result generation.
- Relational frontend panels for source tables, active rows, matching rows,
  rejected rows, operations, columns, and final results.

## Query Architecture

```text
SQL source
→ isolated SQLite execution
→ verified result rows
→ logical relational events
→ query-state reconstruction
→ relational visualization
```

## Verification

The main filtering example verified:

- five scanned rows;
- three matching rows;
- two rejected rows;
- the final ordered result containing Divya, Nila, and Kavin.

Regression coverage also passed for `JOIN`, `GROUP BY`, aggregation, `DISTINCT`,
sorting, projection, result synchronization, invalid queries, and SQL's
separate query trace domain.

## Security Boundary

SQL receives no program-input stream. Every run uses a private in-memory
database and cannot access an external database, network resource, or user
filesystem through the supported query surface.

## Primary Commands

```cmd
pnpm test:execution
pnpm test:core
pnpm test:web
```
