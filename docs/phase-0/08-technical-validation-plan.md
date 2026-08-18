\# CodeFlow Visualizer — Phase 0 Technical Validation Plan



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Approved validation plan

\- Application language: JavaScript

\- Initial languages: Java, Python, SQL, C and JavaScript

\- Purpose: Validate technical feasibility before main development



\## Phase 0 Objective



Phase 0 must prove that the proposed architecture can support the complete

CodeFlow execution pipeline:



Source  

→ Safe Execution  

→ Runtime Observation  

→ Normalized Event  

→ State Delta  

→ State Reconstruction  

→ Visual Intent  

→ Timeline Replay



Phase 0 does not attempt to build the final user interface or complete all five

language adapters.



It produces controlled proofs of concept, architecture decisions and documented

limitations.



\## Already Confirmed Development Tools



The following tools have already been verified:



\- Node.js: 22.23.2

\- npm: 10.9.8

\- Git: 2.53.0

\- pnpm: 11.22.0



The project repository has been initialized on the `main` branch.



\## Environment Tools Still Requiring Validation



The following must be checked before language proof-of-concept work:



\- Docker Desktop

\- Docker Engine

\- Docker Compose

\- Python

\- Java Development Kit

\- Java compiler

\- C compiler

\- GDB or compatible debugger

\- Clang where available

\- SQLite runtime where available



Local installations are useful for diagnostics, but untrusted execution must

eventually occur inside isolated runtime environments.



\## Validation Principles



1\. Use very small controlled examples.

2\. Never run intentionally hostile programs directly on the host.

3\. Do not install every dependency before it is required.

4\. Record actual results.

5\. Record runtime and tool versions.

6\. Document failures and limitations.

7\. Do not claim support based only on documentation.

8\. Validate the event contract against all five languages.

9\. Validate security boundaries before arbitrary input.

10\. Stop and revise the architecture if a core assumption fails.



\## Required Phase 0 Deliverables



Phase 0 should produce:



1\. Authoritative project charter

2\. Language capability matrix

3\. System architecture

4\. Generalized execution-event model

5\. State reconstruction and replay architecture

6\. Visual-event and animation architecture

7\. Security threat model

8\. Technical validation plan

9\. Development environment report

10\. JavaScript tracing proof of concept

11\. Python tracing proof of concept

12\. Java tracing proof of concept

13\. C tracing proof of concept

14\. SQL logical-visualization proof of concept

15\. Sandbox proof of concept

16\. Final Phase 0 findings

17\. Revised MVP limitations

18\. Architecture decision records where required



\## Technical Validation Stages



\### Stage 1 — Development Environment Audit



Validate:



\- Node and pnpm

\- Git

\- Docker

\- Python

\- Java

\- C compiler

\- C debugger

\- SQLite

\- Operating-system compatibility



Output:



\- Tool name

\- Installed status

\- Version

\- Intended use

\- Required action

\- Validation result



\### Stage 2 — Common Event Fixture Validation



Before runtime tracing, create controlled conceptual traces for:



\- Variable declaration

\- Variable update

\- Condition

\- Loop

\- Function call

\- Array update

\- Stack push

\- Output

\- Error

\- C memory allocation

\- SQL filter



Use these fixtures to verify:



\- Event validation

\- State reconstruction

\- Forward replay

\- Backward reconstruction

\- Event grouping

\- Source location

\- Entity identity

\- Trace versioning



This work occurs before connecting arbitrary runtimes to the frontend.



\### Stage 3 — JavaScript Tracing Proof of Concept



Candidate strategy:



\- Babel source parsing

\- Source-location mapping

\- Selective source instrumentation

\- V8 Inspector where useful

\- Isolated Node.js execution



The proof of concept must demonstrate:



1\. Parse one source file.

2\. Identify original source locations.

3\. Execute outside the Express process.

4\. Capture program start.

5\. Capture a variable update.

6\. Capture a condition result.

7\. Capture a loop iteration.

8\. Capture a function call.

9\. Capture an array update.

10\. Capture output.

11\. Capture a runtime error.

12\. Stop an infinite loop.

13\. Enforce an output limit.

14\. Produce normalized events.

15\. Preserve original line numbers.



Technical questions:



\- Can Inspector stepping provide reliable user-source locations?

\- Can local variables be inspected safely?

\- Which semantic events require instrumentation?

\- Does instrumentation alter scope or evaluation order?

\- How should objects and arrays receive stable identities?

\- Can internal tracer values be hidden from the user program?

\- How should unsupported asynchronous code be rejected?



\### Stage 4 — Python Tracing Proof of Concept



Candidate strategy:



\- Python Abstract Syntax Tree

\- `sys.settrace`

\- Bounded frame-local inspection

\- Selective expression instrumentation where necessary

\- Isolated Python execution



The proof of concept must demonstrate:



1\. Parse one Python file.

2\. Capture line events.

3\. Capture function-call events.

4\. Capture return events.

5\. Capture exception events.

6\. Inspect bounded local variables.

7\. Detect variable changes.

8\. Detect list changes.

9\. Capture recursion frames.

10\. Capture input/output.

11\. Stop an infinite loop.

12\. Enforce output and trace limits.

13\. Produce normalized events.

14\. Preserve original source locations.



Technical questions:



\- Which events are directly observable?

\- Which expression results require AST instrumentation?

\- How should dynamic values be normalized?

\- How should dictionaries and sets be bounded?

\- How can tracer internals remain protected?

\- Which standard-library modules must be restricted?



\### Stage 5 — Java Tracing Proof of Concept



Candidate strategy:



\- JDK compiler APIs

\- Compilation with debugging information

\- Java Debug Interface

\- User-class filtering

\- Isolated JVM execution



The proof of concept must demonstrate:



1\. Compile one `Main` source file.

2\. Capture compiler diagnostics.

3\. Identify current source lines.

4\. Inspect local variables.

5\. Inspect method arguments.

6\. Capture method calls.

7\. Capture return values where feasible.

8\. Capture call-stack frames.

9\. Inspect a one-dimensional array.

10\. Capture standard output.

11\. Capture an exception.

12\. Apply JVM and container limits.

13\. Produce normalized events.

14\. Keep debugger communication private.



Technical questions:



\- Is local-variable information consistently available?

\- Which method events should come from JDI?

\- Which semantic events require static source analysis?

\- How should objects be inspected without excessive traversal?

\- How should Java library frames be hidden?

\- Can JDI operate inside the selected sandbox restrictions?



\### Stage 6 — C Tracing Proof of Concept



Candidate strategy:



\- Clang or GCC compilation

\- Debug symbols

\- No optimization for source-level tracing

\- GDB/MI

\- AddressSanitizer

\- UndefinedBehaviorSanitizer

\- Controlled allocation observation

\- Isolated native execution



The proof of concept must demonstrate:



1\. Compile one C source file.

2\. Capture compiler diagnostics.

3\. Identify current source lines.

4\. Inspect local variables.

5\. Capture function frames.

6\. Inspect a one-dimensional array.

7\. Capture a pointer value.

8\. Connect a pointer to a logical target.

9\. Observe a small allocation.

10\. Observe `free`.

11\. Detect a selected memory violation.

12\. Capture standard input/output.

13\. Stop an infinite loop.

14\. Prevent process and network abuse.

15\. Produce normalized events.

16\. Clean every native process.



Technical questions:



\- Can GDB/MI run under the selected sandbox profile?

\- Which capabilities does the debugger require?

\- How should runtime addresses map to logical allocation IDs?

\- How should stack allocations be represented?

\- How can supported allocator calls be observed reliably?

\- What should happen after undefined behaviour?

\- Which C language version should the MVP support?

\- Is Clang or GCC the better controlled compiler for the project?



\### Stage 7 — SQL Proof of Concept



Candidate strategy:



\- SQLite-compatible educational dialect

\- SQL AST parser

\- Logical-operation builder

\- Temporary isolated SQLite database

\- Bounded intermediate relations

\- Final-result verification



The proof of concept must demonstrate:



1\. Parse one SQL query.

2\. Validate the supported subset.

3\. Load a small temporary dataset.

4\. Identify source relations.

5\. Represent a table scan.

6\. Represent `WHERE` filtering.

7\. Represent column projection.

8\. Execute the actual query.

9\. Compare logical output with actual result.

10\. Capture a SQL error.

11\. Interrupt an excessive query.

12\. Restrict disallowed statements.

13\. Prevent external database access.

14\. Produce normalized SQL events.

15\. Destroy the temporary database.



Additional validation queries:



\- `ORDER BY`

\- `DISTINCT`

\- `LIMIT`

\- Basic `GROUP BY`

\- Basic aggregate

\- Basic `INNER JOIN`

\- Basic `LEFT JOIN`



Technical questions:



\- Which parser provides reliable SQLite locations?

\- How will rows receive stable identities?

\- How will joined rows preserve source relationships?

\- How will SQL NULL and three-valued logic be represented?

\- How will intermediate logical relations be verified?

\- Which statements should be allowed in the MVP?

\- How will unsupported valid SQL be reported?



\### Stage 8 — Sandbox Proof of Concept



The sandbox proof of concept must demonstrate:



1\. Separate execution from Express.

2\. Disposable runtime environment.

3\. Non-root execution.

4\. CPU limit.

5\. Memory limit.

6\. Execution timeout.

7\. Output limit.

8\. Trace-event limit.

9\. PID/process limit.

10\. Network disabled.

11\. Restricted filesystem.

12\. No application secrets.

13\. Complete process-group termination.

14\. Temporary-file cleanup.

15\. Temporary-database cleanup.

16\. Structured result return.



Test programs must include:



\- Normal completion

\- Infinite loop

\- Excessive output

\- Excessive memory

\- Runtime crash

\- Process-spawn attempt

\- Filesystem-access attempt

\- Network-access attempt



Intentionally hostile tests must run only inside the approved sandbox.



\### Stage 9 — Cross-Language Contract Validation



After individual proofs of concept:



\- Convert all raw observations into the common event contract.

\- Reconstruct states using the same visualizer-core logic.

\- Verify source locations.

\- Verify event ordering.

\- Verify shared value representations.

\- Verify error normalization.

\- Verify fidelity labels.

\- Verify capability manifests.



Shared test scenarios should include:



\- Variable declaration and update

\- Arithmetic

\- Condition

\- Loop

\- Function call

\- Array/list update

\- Stack operation where supported

\- Output

\- Error



\### Stage 10 — Final Architecture Review



Review:



\- Feasibility

\- Correctness

\- Security

\- Performance

\- Runtime compatibility

\- Event-model completeness

\- State-model completeness

\- MVP scope

\- Unsupported features

\- Required dependencies

\- Development order



Update the architecture before Phase 1 if validation reveals incorrect

assumptions.



\## Proof-of-Concept Result Format



Every proof of concept should record:



\- Validation ID

\- Date

\- Objective

\- Tool versions

\- Source example

\- Expected behaviour

\- Actual behaviour

\- Captured raw output

\- Generated normalized events

\- Security conditions

\- Performance observations

\- Limitations

\- Pass/fail result

\- Required architecture changes

\- Next decision



\## Pass Classification



\### PASS



The required behaviour works reliably and can proceed toward implementation.



\### CONDITIONAL PASS



The behaviour works only within documented limits.



The limitation must be added to the capability matrix.



\### FAIL



The approach cannot meet the requirement safely or reliably.



The architecture or implementation strategy must change.



\### DEFERRED



The capability is technically possible but should not be included in the first

MVP.



\## Dependency Evaluation



Before adding a dependency, record:



\- Package name

\- Purpose

\- Why built-in functionality is insufficient

\- Maintenance status

\- Licence

\- Security considerations

\- Bundle/runtime impact

\- Alternative options

\- Final decision



Candidate dependencies must not be installed solely because they are popular.



\## Runtime Version Policy



Language runtimes should eventually be pinned inside runtime images.



The project should record:



\- Node.js version

\- Python version

\- JDK version

\- C compiler version

\- GDB version

\- SQLite version

\- Runtime-image digest



Changing a runtime version requires rerunning relevant adapter tests.



\## Performance Measurements



Proofs of concept should measure:



\- Startup time

\- Compilation time

\- Execution time

\- Trace-generation time

\- Event count

\- Trace size

\- Checkpoint size

\- Reconstruction time

\- Peak memory where available

\- Cleanup time



Measurements guide limits and optimizations.



\## Initial Limits Policy



Exact values will be selected only after benchmarking.



The first configuration must include:



\- Maximum source-code bytes

\- Maximum input bytes

\- Maximum execution seconds

\- Maximum compilation seconds

\- Maximum memory

\- Maximum CPU usage

\- Maximum process count

\- Maximum output bytes

\- Maximum trace events

\- Maximum trace bytes

\- Maximum collection elements

\- Maximum inspection depth

\- Maximum SQL rows

\- Maximum SQL database size



Limits must be server-controlled and language-aware where necessary.



\## Documentation Update Rules



When validation changes a decision:



1\. Update the capability matrix.

2\. Update the relevant architecture document.

3\. Create an architecture decision record if the change is significant.

4\. Record the proof-of-concept result.

5\. Update MVP limitations.

6\. Commit the documentation change before continuing.



\## Phase 0 Exit Criteria



Phase 0 is complete only when:



1\. Required development tools are identified.

2\. The development environment is documented.

3\. Each language has a technical proof of concept.

4\. SQL logical visualization feasibility is demonstrated.

5\. C isolation and debugger feasibility are demonstrated.

6\. The sandbox enforces initial limits.

7\. The common event contract represents all five languages.

8\. State reconstruction works with cross-language fixtures.

9\. Forward and backward replay are verified.

10\. Security boundaries are tested.

11\. MVP limitations are documented.

12\. Major architecture decisions are recorded.

13\. Phase 1 dependencies are approved.

14\. Phase 0 documentation is committed to Git.



\## Phase 0 Failure Rule



If a required initial language cannot produce safe and sufficiently meaningful

execution information:



\- Do not silently remove the language.

\- Do not claim that it is supported.

\- Document the failed approach.

\- Research an alternative adapter strategy.

\- Revise the implementation sequence if necessary.

\- Request project-owner approval for any material scope change.



\## Final Phase 0 Deliverable



At the end of Phase 0, CodeFlow should have a verified technical foundation,

not a finished product.



The output should clearly answer:



\- What can be traced?

\- How is it traced?

\- How safe is execution?

\- Which events are exact?

\- Which events are derived?

\- Which SQL operations are educational models?

\- How is state reconstructed?

\- How is playback synchronized?

\- What is supported in the first MVP?

\- What remains future work?

