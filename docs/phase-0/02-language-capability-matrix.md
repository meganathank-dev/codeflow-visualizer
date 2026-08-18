\# CodeFlow Visualizer — Language Capability Matrix



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Planned and awaiting technical validation

\- Initial languages: Java, Python, SQL, C and JavaScript

\- Application development language: JavaScript

\- Purpose: Define honest and testable language-support boundaries



\## Important Status Rule



Every capability in this document is currently a planned MVP capability.



No feature should be presented to users as supported until:



1\. The language adapter implements it.

2\. The generated events are validated.

3\. The reconstructed state is correct.

4\. The visual representation is synchronized.

5\. Automated and manual tests pass.



\## Capability Status Labels



The project will use the following labels:



\- `PLANNED` — Included in the approved MVP design but not implemented.

\- `POC` — Demonstrated only through a technical proof of concept.

\- `PARTIAL` — Implemented for a documented subset.

\- `SUPPORTED` — Implemented and passing acceptance tests.

\- `UNSUPPORTED` — Intentionally unavailable.

\- `FUTURE` — Planned after the first MVP.

\- `NOT\_APPLICABLE` — The concept does not apply to that language.



\## Initial Language Summary



| Language | Execution Domain | Initial Runtime Strategy | MVP Status |

|---|---|---|---|

| JavaScript | Program execution | Node.js, AST analysis and runtime tracing | PLANNED |

| Python | Program execution | Python AST and interpreter tracing | PLANNED |

| Java | Program execution | JDK compilation and debugger integration | PLANNED |

| C | Program execution and memory | Clang/GCC compilation and debugger integration | PLANNED |

| SQL | Logical query execution | SQL AST and isolated SQLite-compatible database | PLANNED |



\## Shared General-Purpose Language Capabilities



The following matrix applies to JavaScript, Python, Java and C.



| Capability | JavaScript | Python | Java | C |

|---|---|---|---|---|

| Parse or compile source | PLANNED | PLANNED | PLANNED | PLANNED |

| Safe isolated execution | PLANNED | PLANNED | PLANNED | PLANNED |

| Program start/end | PLANNED | PLANNED | PLANNED | PLANNED |

| Source-line highlighting | PLANNED | PLANNED | PLANNED | PLANNED |

| Statement execution | PLANNED | PLANNED | PLANNED | PLANNED |

| Variable declaration | PLANNED | PLANNED | PLANNED | PLANNED |

| Variable assignment/update | PLANNED | PLANNED | PLANNED | PLANNED |

| Variable read | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET |

| Primitive values | PLANNED | PLANNED | PLANNED | PLANNED |

| Selected expressions | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET |

| Arithmetic operations | PLANNED | PLANNED | PLANNED | PLANNED |

| Comparison operations | PLANNED | PLANNED | PLANNED | PLANNED |

| Logical operations | PLANNED | PLANNED | PLANNED | PLANNED |

| Intermediate expression values | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET |

| Conditions | PLANNED | PLANNED | PLANNED | PLANNED |

| Selected branch | PLANNED | PLANNED | PLANNED | PLANNED |

| for loops | PLANNED | PLANNED | PLANNED | PLANNED |

| while loops | PLANNED | PLANNED | PLANNED | PLANNED |

| do-while loops | NOT APPLICABLE | NOT APPLICABLE | PLANNED | PLANNED |

| Iteration counter | PLANNED | PLANNED | PLANNED | PLANNED |

| Nested loops | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET | PARTIAL TARGET |

| break | PLANNED | PLANNED | PLANNED | PLANNED |

| continue | PLANNED | PLANNED | PLANNED | PLANNED |

| Functions or methods | PLANNED | PLANNED | PLANNED | PLANNED |

| Parameters/arguments | PLANNED | PLANNED | PLANNED | PLANNED |

| Return values | PLANNED | PLANNED | PLANNED | PLANNED |

| Call stack | PLANNED | PLANNED | PLANNED | PLANNED |

| Basic recursion | PLANNED | PLANNED | PLANNED | PLANNED |

| One-dimensional arrays/lists | PLANNED | PLANNED | PLANNED | PLANNED |

| Array/list access | PLANNED | PLANNED | PLANNED | PLANNED |

| Array/list update | PLANNED | PLANNED | PLANNED | PLANNED |

| Recognized Stack operations | PLANNED | PLANNED | PLANNED | PARTIAL TARGET |

| Console output | PLANNED | PLANNED | PLANNED | PLANNED |

| Pre-supplied input | PLANNED | PLANNED | PLANNED | PLANNED |

| Syntax/compiler errors | PLANNED | PLANNED | PLANNED | PLANNED |

| Runtime errors | PLANNED | PLANNED | PLANNED | PLANNED |

| Exceptions | PLANNED | PLANNED | PLANNED | NOT APPLICABLE |

| Backward trace replay | PLANNED | PLANNED | PLANNED | PLANNED |



`PARTIAL TARGET` means that only explicitly documented constructs will be

supported in the first MVP.



\## JavaScript MVP Capability



\### Source Model



\- One synchronous JavaScript source file

\- Node.js execution environment

\- No browser DOM

\- No external packages

\- No user-controlled module installation



\### Planned Constructs



\- `let`

\- `const`

\- `var`

\- Primitive values

\- Basic objects

\- Arrays

\- Arithmetic expressions

\- Comparison expressions

\- Logical expressions

\- Assignment

\- Compound assignment

\- Increment and decrement

\- `if`

\- `else`

\- `else if`

\- `switch` where technical validation succeeds

\- `for`

\- `while`

\- `for...of`

\- Functions

\- Arrow functions where tracing remains reliable

\- Parameters

\- Return values

\- Basic recursion

\- `try`

\- `catch`

\- `finally`

\- `throw`

\- Console output



\### Planned Stack Recognition



The following array operations can be interpreted as Stack operations when the

runtime state and source construct confirm the operation:



\- `push`

\- `pop`

\- Reading the final element as a peek operation



An ordinary JavaScript array must remain an Array unless Stack behaviour is

reliably identified.



\### Planned Input



The MVP may provide a controlled CodeFlow input function such as a documented

`readLine()` helper backed by pre-supplied input.



The exact JavaScript input API must be validated during the JavaScript proof

of concept.



\### Initial Exclusions



\- Promises

\- `async`

\- `await`

\- Event-loop visualization

\- Microtasks

\- Macrotasks

\- Timers

\- Worker threads

\- Network access

\- Filesystem access

\- Child processes

\- Dynamic package imports

\- Arbitrary getters and proxies as fully inspectable state

\- Complete closure visualization



\## Python MVP Capability



\### Source Model



\- One Python source file

\- Synchronous interpreter execution

\- Restricted standard-library access

\- No external package installation



\### Planned Constructs



\- Dynamic variables

\- Primitive values

\- Arithmetic expressions

\- Comparison expressions

\- Boolean expressions

\- Assignment

\- Compound assignment

\- `if`

\- `elif`

\- `else`

\- `for`

\- `while`

\- `break`

\- `continue`

\- Functions

\- Parameters

\- Return values

\- Basic recursion

\- Lists

\- Tuples

\- Dictionaries with bounded inspection

\- Sets with bounded inspection

\- Basic objects and classes

\- `try`

\- `except`

\- `finally`

\- `raise`

\- `print`

\- `input`



\### Planned Stack Recognition



A Python list may be visualized as a Stack when supported operations are

observed:



\- `append`

\- `pop`

\- Reading the final element as peek



The adapter must not classify every Python list as a Stack.



\### Initial Exclusions



\- Asynchronous Python

\- Threads

\- Multiprocessing

\- Generators as a visualized execution model

\- Native extension modules

\- External packages

\- Network access

\- Arbitrary filesystem access

\- Subprocess execution

\- Metaclass internals

\- Complete interpreter bytecode visualization



\## Java MVP Capability



\### Source Model



\- One Java source file

\- One public `Main` class

\- JDK compilation with debugging information

\- Synchronous JVM execution

\- No external dependencies



\### Planned Constructs



\- Primitive values

\- Local variables

\- Static fields with bounded inspection

\- Arithmetic expressions

\- Comparison expressions

\- Boolean expressions

\- Assignment

\- Compound assignment

\- Increment and decrement

\- `if`

\- `else`

\- `switch` where technical validation succeeds

\- `for`

\- Enhanced `for`

\- `while`

\- `do-while`

\- Methods

\- Parameters

\- Return values

\- Basic recursion

\- One-dimensional arrays

\- Basic objects

\- Basic property/field state

\- Selected collections

\- Exceptions

\- `try`

\- `catch`

\- `finally`

\- Standard output

\- Standard input using supported patterns



\### Planned Stack Recognition



Recognized operations may include:



\- `java.util.Stack.push`

\- `java.util.Stack.pop`

\- `java.util.Stack.peek`

\- Selected `ArrayDeque` stack operations where explicitly supported



Custom classes named Stack must not automatically be treated as verified Stack

implementations.



\### Initial Exclusions



\- Threads

\- Concurrency

\- Reflection

\- Native methods

\- External libraries

\- Dynamic class loading

\- Network access

\- Arbitrary filesystem access

\- Complex inheritance visualization

\- Complete JVM heap visualization

\- JVM bytecode instruction visualization



\## C MVP Capability



\### Source Model



\- One C source file

\- A defined C-language version selected during technical validation

\- Debug build

\- No optimization where source-level tracing requires it

\- Isolated native-process execution



\### Planned Constructs



\- Primitive variables

\- Arithmetic expressions

\- Comparison expressions

\- Logical expressions

\- Assignment

\- Compound assignment

\- Increment and decrement

\- `if`

\- `else`

\- `switch`

\- `for`

\- `while`

\- `do-while`

\- Functions

\- Parameters

\- Return values

\- Basic recursion

\- Fixed-size one-dimensional arrays

\- Basic structs where debugger output is reliable

\- Standard input

\- Standard output

\- Compiler errors

\- Runtime failures where detectable



\### Planned Pointer and Memory Support



\- Address-of a local variable

\- Pointer assignment

\- Pointer dereference read

\- Pointer dereference write

\- Pointer-to-array relationship

\- Small `malloc` allocations

\- Small `calloc` allocations

\- `free`

\- Allocation lifetime

\- Logical memory identifiers

\- Pointer arrows

\- Null pointer state

\- Selected invalid-memory errors detected by sanitizers



\### Planned Stack Recognition



Arbitrary C code does not provide enough semantic information to reliably

identify every custom Stack implementation.



The first MVP should use one of these controlled approaches:



1\. A CodeFlow-provided educational Stack template.

2\. Explicit CodeFlow visualization annotations.

3\. A narrowly recognized and tested implementation pattern.



The system must not guess that an arbitrary array is a Stack.



\### Initial Exclusions



\- Multi-file programs

\- Threads

\- External libraries

\- System calls

\- Network access

\- Arbitrary filesystem access

\- Inline assembly

\- Function pointers

\- Complex pointer arithmetic

\- `realloc` visualization

\- Unions and bit fields

\- Complete binary memory-layout visualization

\- Machine-instruction tracing

\- Complete undefined-behaviour recovery



When undefined behaviour or a serious memory violation is detected, the trace

must clearly indicate that subsequent state cannot be considered reliable.



\## SQL MVP Capability



\### Execution Model



SQL uses the Query Execution domain.



SQL does not use the same variable, function and call-stack model as the four

general-purpose languages.



\### Planned MVP Dialect



The first SQL implementation will target a documented SQLite-compatible

educational subset.



Support for another SQL dialect must not be claimed unless separately tested.



\### Planned Query Capabilities



\- A single supported query

\- Predefined or bounded temporary datasets

\- `SELECT`

\- Column projection

\- `FROM`

\- `WHERE`

\- Comparison predicates

\- Boolean predicates

\- `ORDER BY`

\- `DISTINCT`

\- `LIMIT`

\- Basic `GROUP BY`

\- `COUNT`

\- `SUM`

\- `AVG`

\- `MIN`

\- `MAX`

\- Basic `HAVING`

\- Basic `INNER JOIN`

\- Basic `LEFT JOIN`

\- Final result set

\- SQL syntax errors

\- SQL execution errors



\### Planned Logical Events



\- `SQL\_QUERY\_START`

\- `SQL\_SOURCE`

\- `SQL\_SCAN`

\- `SQL\_JOIN`

\- `SQL\_FILTER`

\- `SQL\_GROUP`

\- `SQL\_AGGREGATE`

\- `SQL\_HAVING`

\- `SQL\_PROJECT`

\- `SQL\_DISTINCT`

\- `SQL\_SORT`

\- `SQL\_LIMIT`

\- `SQL\_RESULT`

\- `SQL\_QUERY\_END`



\### SQL Accuracy Rule



The MVP will distinguish between:



1\. CodeFlow educational logical-query visualization.

2\. Actual isolated database execution.

3\. Database-provided physical or optimizer plans.



The educational logical trace must never be labelled as the exact physical

execution performed internally by the database engine.



If a valid query can execute but cannot be accurately modeled:



\- Show the actual result if execution is permitted.

\- Mark the logical visualization as unsupported.

\- Do not fabricate intermediate relations.



\### Initial SQL Exclusions



\- Multiple SQL dialects

\- Unrestricted DDL

\- Unrestricted DML

\- Stored procedures

\- Triggers

\- Transactions

\- User-defined functions

\- Recursive CTEs

\- Window functions

\- Vendor-specific extensions

\- Arbitrary database connections

\- Production database access

\- Exact physical-plan reproduction

\- Extremely large datasets



\## Shared Value-Inspection Limits



All language adapters must enforce limits for:



\- Maximum nesting depth

\- Maximum collection length

\- Maximum object properties

\- Maximum string length

\- Maximum call-stack depth

\- Maximum trace events

\- Maximum console output

\- Maximum source-code size

\- Maximum input size



When a value is truncated, the trace must mark it as truncated rather than

pretending that the complete value was captured.



\## Event Fidelity Labels



Events should identify how they were produced:



\- `runtime-observed`

\- `debugger-observed`

\- `instrumented`

\- `derived-from-state-difference`

\- `educational-logical-model`



Fidelity should be labelled as:



\- `exact`

\- `bounded`

\- `derived`

\- `modeled`



These labels will also be available to future AI explanation features.



\## Phase 0 Proof-of-Concept Requirements



Each general-purpose language proof of concept must demonstrate:



1\. Valid source parsing or compilation.

2\. Safe execution outside the Express process.

3\. Current source-line identification.

4\. At least one variable state change.

5\. At least one control-flow event.

6\. At least one function-call or frame event.

7\. Output capture.

8\. Syntax or compiler error capture.

9\. Runtime error capture.

10\. Execution timeout.

11\. Trace-step limit.

12\. Sandbox cleanup.



The SQL proof of concept must demonstrate:



1\. SQL parsing.

2\. Temporary isolated database creation.

3\. Input-table loading.

4\. A `SELECT` query.

5\. `WHERE` filtering.

6\. Column projection.

7\. Logical SQL events.

8\. Actual result generation.

9\. Logical-result verification.

10\. SQL error handling.

11\. Query timeout or interruption.

12\. Sandbox cleanup.



\## MVP Release Rule



CodeFlow Visualizer must not be described as supporting all five languages

until Java, Python, SQL, C and JavaScript each pass their approved MVP

acceptance-test suite.



The language selector may display only adapters that have reached the

`SUPPORTED` status.

