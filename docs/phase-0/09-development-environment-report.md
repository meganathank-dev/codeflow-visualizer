\# CodeFlow Visualizer — Development Environment Report



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Audit date: 18 August 2026

\- Operating system: Microsoft Windows

\- Project location: E:\\Desktop\\codeflow-visualizer

\- Installation policy: No additional system applications at the current stage

\- Application language: JavaScript



\## Purpose



This document records the tools currently available for CodeFlow Visualizer

development and identifies technical validation that can proceed without new

system installations.



The product requirements remain unchanged.



CodeFlow must still ultimately support:



1\. Java

2\. Python

3\. SQL

4\. C

5\. JavaScript



\## Installed Development Tools



| Tool | Version | Status | Intended purpose |

|---|---|---|---|

| Node.js | 22.23.2 | Available | React tooling, API and execution orchestration |

| npm | 10.9.8 | Available | Node.js package support |

| pnpm | 11.22.0 | Available | Monorepo package management |

| Git | 2.53.0 | Available | Version control |

| Python | 3.13.5 | Available | Python tracing and controlled SQL validation |

| Java runtime | Java 25 LTS | Available | Java program execution |

| Java compiler | javac 25 | Available | Java source compilation |



\## Tools Not Currently Installed



| Tool | Status | Effect |

|---|---|---|

| Docker Desktop | Unavailable | Secure container validation cannot currently proceed |

| WSL 2 | Unavailable | Linux-container environment unavailable |

| GCC | Unavailable | C source cannot currently be compiled using GCC |

| Clang | Unavailable | C source cannot currently be compiled using Clang |

| GDB | Unavailable | C source-level debugger validation cannot proceed |

| SQLite CLI | Unavailable | Direct SQLite CLI validation unavailable |



\## Current Project-Owner Decision



No additional system applications should be installed at the current stage.



This decision does not remove or reduce any CodeFlow product requirement.



Missing technical validations will be marked as pending rather than silently

removed or represented as completed.



\## Project Package Installation



System applications and project dependencies are different.



Project dependencies installed through pnpm will still be required later.



Examples include:



\- React

\- Vite

\- Express

\- Monaco Editor

\- Tailwind CSS

\- Zustand

\- Framer Motion

\- Zod

\- Testing libraries



Without project dependencies, the MERN application cannot be created or run.



Every dependency must still have a documented purpose before installation.



\## Validation That Can Proceed Now



\### JavaScript



Available tools:



\- Node.js

\- Built-in Node.js modules

\- Built-in Node.js test runner



Possible controlled validation:



\- Separate child-process execution

\- Output capture

\- Runtime-error capture

\- Timeout handling

\- Basic source-line experiments

\- Prototype trace generation



Security restriction:



Only fixed CodeFlow test programs may execute directly during the proof of

concept.



Arbitrary user JavaScript must not be accepted without an approved sandbox.



\### Python



Available tools:



\- Python 3.13.5

\- Python Abstract Syntax Tree

\- `sys.settrace`

\- Python standard library



Possible controlled validation:



\- Line events

\- Function-call events

\- Return events

\- Exception events

\- Local-variable snapshots

\- List-state changes

\- Prototype trace generation



Security restriction:



Only fixed CodeFlow test programs may execute directly during the proof of

concept.



Arbitrary user Python must not be accepted without an approved sandbox.



\### Java



Available tools:



\- Java 25

\- javac 25

\- JDK debugging APIs

\- Java Debug Interface



Possible controlled validation:



\- Java compilation

\- Compiler diagnostics

\- Source-line stepping

\- Local-variable inspection

\- Method frames

\- Exception capture

\- Prototype trace generation



Security restriction:



Only fixed CodeFlow test programs may execute directly during the proof of

concept.



Arbitrary user Java must not be accepted without an approved sandbox.



\### SQL



Python includes a standard-library SQLite interface.



Possible controlled validation:



\- Temporary in-memory SQLite database

\- Small predefined tables

\- SQL execution

\- Result capture

\- SQL error capture

\- Filtering and projection experiments

\- Logical-event prototypes



The availability of Python’s SQLite module must be verified before beginning

the SQL proof of concept.



Security restriction:



Only fixed CodeFlow SQL fixtures and bounded in-memory datasets may be used

until the sandbox architecture is available.



\## Validation Currently Blocked



\### C Compilation and Tracing



C validation is blocked because no C compiler or debugger is installed.



The following requirements remain pending:



\- C compilation

\- Compiler diagnostics

\- GDB/MI tracing

\- C local-variable inspection

\- Pointer inspection

\- Allocation observation

\- Sanitizer validation

\- Segmentation-fault handling



C remains part of the initial product scope.



It must not be shown as supported until the required tooling becomes available

and its tests pass.



\### Production-Grade Sandbox Validation



Secure arbitrary execution is blocked because no container or equivalent

isolation environment is currently available.



The following remain pending:



\- Container isolation

\- Network restriction

\- Filesystem restriction

\- CPU enforcement

\- Memory enforcement

\- PID enforcement

\- Native C process isolation

\- Disposable runtime environments

\- Production sandbox hardening



\## Security Rule During Unsandboxed Validation



Until an approved sandbox exists:



1\. Do not accept arbitrary user code.

2\. Do not expose execution endpoints publicly.

3\. Execute only source fixtures written and reviewed for the proof of concept.

4\. Do not run intentionally malicious programs.

5\. Do not run generated C executables.

6\. Do not claim that host execution is secure.

7\. Do not connect proof-of-concept execution to the final Run button.

8\. Keep the Express API separate from controlled runtime experiments.



\## Workflow Impact



The overall project workflow remains:



Architecture  

→ Technical validation  

→ Foundation  

→ First vertical slice  

→ JavaScript  

→ Python  

→ Java  

→ C  

→ SQL  

→ Five-language MVP



Technical validations will proceed using currently installed tools where safe.



Blocked C and sandbox validations must be completed before the final

five-language MVP can be approved.



\## Cost Policy



The project should use free and open-source tools wherever possible.



The project must not introduce:



\- Paid APIs

\- Paid hosting requirements

\- Paid AI services

\- Paid databases

\- Paid domain requirements

\- Paid development software



The guaranteed zero-cost delivery target is a complete locally operated

educational application.



A permanently free public production execution service is not guaranteed.



\## Current Environment Result



\### Ready for controlled Phase 0 validation



\- JavaScript

\- Python

\- Java

\- SQL through Python SQLite, pending module verification

\- Git documentation workflow

\- JavaScript-based architecture work



\### Pending



\- C compiler/debugger validation

\- Container sandbox validation

\- Production security validation



\## Honesty Requirement



A missing tool does not permit CodeFlow to:



\- Remove a required language silently

\- Fake runtime events

\- Use AI to invent execution behaviour

\- Claim unsafe execution is secure

\- Claim an untested language is supported



Blocked requirements must remain visible and documented until they are

implemented and tested.

