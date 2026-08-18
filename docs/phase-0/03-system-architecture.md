\# CodeFlow Visualizer — System Architecture



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Proposed architecture

\- Application language: JavaScript

\- Architecture style: Modular monorepo with isolated execution

\- Initial languages: Java, Python, SQL, C and JavaScript



\## Architecture Objective



The architecture must support this complete pipeline:



Source Code or SQL Query

→ Language-Specific Analysis

→ Safe Execution

→ Runtime or Query Observation

→ Standardized Event

→ State Reconstruction

→ Visual Event

→ Synchronized Animation

→ Timeline Replay



The system must remain extensible so additional languages and visualizers can

be added without redesigning the complete application.



\## Core Architecture Rules



1\. User code must never execute inside the Express API process.

2\. Language-specific tracing must remain separate from frontend visualization.

3\. Visualizers must consume standardized events rather than language syntax.

4\. SQL must use a specialized query-execution domain.

5\. Execution events must be versioned and validated.

6\. State reconstruction must be deterministic where possible.

7\. Timeline navigation must not rerun the program for every step.

8\. Animations must correspond to execution events.

9\. Unsupported behaviour must be reported honestly.

10\. Security limits must exist before arbitrary execution is enabled.

11\. AI must never become the execution source of truth.

12\. MongoDB is not required until persistent user features are introduced.



\## High-Level Architecture



```text

┌──────────────────────────────────────────────────────────────┐

│                         User Browser                         │

│                                                              │

│  Monaco Editor                                               │

│  Language Selector                                           │

│  Visualization Workspace                                     │

│  Timeline and Playback                                       │

│  Variables / Console / Call Stack / Errors                   │

└──────────────────────────────┬───────────────────────────────┘

&#x20;                              │ HTTPS

&#x20;                              ▼

┌──────────────────────────────────────────────────────────────┐

│                        Express API                           │

│                                                              │

│  Request Validation                                          │

│  Language Validation                                         │

│  Code and Input Limits                                       │

│  Execution Job Creation                                      │

│  Job Status and Results                                      │

│  Future Authentication and MongoDB Access                    │

└──────────────────────────────┬───────────────────────────────┘

&#x20;                              │ Private Internal Communication

&#x20;                              ▼

┌──────────────────────────────────────────────────────────────┐

│                     Execution Service                        │

│                                                              │

│  Bounded Job Queue                                            │

│  Adapter Registry                                             │

│  Sandbox Manager                                              │

│  Runtime Limit Enforcement                                    │

│  Trace Normalization                                          │

│  Trace Validation                                             │

│  Output and Error Normalization                               │

└──────────┬──────────┬──────────┬──────────┬──────────────────┘

&#x20;          │          │          │          │

&#x20;          ▼          ▼          ▼          ▼

&#x20;     Java Sandbox  Python    C Sandbox  JavaScript Sandbox

&#x20;                   Sandbox

&#x20;          │          │          │          │

&#x20;          └──────────┴──────────┴──────────┘

&#x20;                              │

&#x20;                              ▼

&#x20;                        SQL Sandbox

&#x20;                              │

&#x20;                              ▼

┌──────────────────────────────────────────────────────────────┐

│                      Execution Trace                         │

│                                                              │

│  Versioned Events                                             │

│  State Deltas                                                 │

│  Checkpoints                                                  │

│  Source Locations                                             │

│  Runtime Metadata                                             │

│  Capability and Fidelity Information                          │

└──────────────────────────────┬───────────────────────────────┘

&#x20;                              ▼

┌──────────────────────────────────────────────────────────────┐

│                   Visualization Pipeline                     │

│                                                              │

│  State Reconstruction                                         │

│  Visual Event Mapping                                         │

│  Source Highlighting                                          │

│  Animation Coordination                                       │

│  Timeline Playback                                             │

└──────────────────────────────────────────────────────────────┘

