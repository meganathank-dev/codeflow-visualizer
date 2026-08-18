\# CodeFlow Visualizer — Generalized Execution-Event Model



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Proposed event architecture

\- Initial schema version: 0.1.0

\- Application language: JavaScript

\- Validation strategy: Zod runtime schemas

\- Initial languages: Java, Python, SQL, C and JavaScript



\## Purpose



The execution-event model is the central contract connecting language

adapters, the execution service, state reconstruction, the timeline,

visualizers, animations, future persistence and future AI explanations.



The model must represent meaningful execution behaviour without forcing every

programming language to use the same tracing implementation.



\## Core Event Pipeline



Language Runtime or SQL Processor  

→ Raw Runtime Observation  

→ Normalized Execution Event  

→ State Delta  

→ Reconstructed State  

→ Visual Intent  

→ Animation or Highlight



\## Event Architecture Layers



\### Layer 1 — Raw Runtime Observations



Raw observations are language-specific and remain inside the corresponding

language adapter.



Examples:



\- Java Debug Interface step event

\- GDB/MI stopped event

\- Python trace-function line event

\- JavaScript instrumentation callback

\- V8 Inspector paused event

\- SQL Abstract Syntax Tree node

\- SQL intermediate relation

\- C sanitizer diagnostic



Raw observations must never be sent directly to the frontend.



\### Layer 2 — Normalized Execution Events



Normalized events describe the meaning of what happened.



Examples:



\- `VARIABLE\_DECLARE`

\- `VARIABLE\_UPDATE`

\- `CONDITION\_EVALUATE`

\- `FUNCTION\_CALL`

\- `ARRAY\_ACCESS`

\- `MEMORY\_ALLOCATE`

\- `SQL\_FILTER`



Normalized events should be language-independent wherever their meanings

overlap.



\### Layer 3 — State Deltas



A state delta describes how the canonical state changes when an event is

applied.



Examples:



\- Create a variable binding

\- Update a variable value

\- Push a call-stack frame

\- Pop a call-stack frame

\- Update an array element

\- Append console output

\- Allocate a memory entity

\- Mark a memory entity as freed

\- Replace the current SQL intermediate relation



\### Layer 4 — Visual Intents



Visual intents are created from normalized events and reconstructed states.



Examples:



\- Highlight a source line

\- Pulse a variable

\- Transition an old value into a new value

\- Highlight an array index

\- Push an element into the Stack visualizer

\- Add a call-stack frame

\- Draw a pointer arrow

\- Filter SQL rows

\- Animate SQL row ordering



Language adapters must never produce frontend animation instructions directly.



\## Trace Domains



Every trace belongs to one execution domain.



\### Program Execution Domain



Identifier: `PROGRAM\_EXECUTION`



Used by:



\- Java

\- Python

\- C

\- JavaScript



\### Query Execution Domain



Identifier: `QUERY\_EXECUTION`



Used by:



\- SQL



Both domains use the same event envelope but have different domain-specific

event payloads.



\## Complete Trace Structure



A complete trace conceptually contains:



\- Trace metadata

\- Capability manifest

\- Initial state

\- Ordered event groups

\- Periodic checkpoints

\- Final state summary

\- Output

\- Error information

\- Execution metrics



\## Trace Metadata



Trace metadata should include:



\- Trace schema version

\- State-model version

\- Adapter version

\- Runtime version

\- Run ID

\- Job ID

\- Trace domain

\- Language

\- Source hash

\- Source filename

\- Creation time

\- Completion status

\- Total event count

\- Total visible step count

\- Execution duration

\- Compilation duration where applicable

\- Truncation status

\- Capability manifest

\- Runtime-limit summary



The source hash connects a trace to the exact source revision that generated it.



If the editor source changes, the existing trace must be marked as stale.



\## Event Envelope



Every normalized event should conceptually contain:



\- Schema version

\- Run ID

\- Event ID

\- Sequence number

\- Step ID

\- Micro-step index

\- Trace domain

\- Language

\- Event type

\- Event category

\- Display visibility

\- Source location

\- Frame ID where applicable

\- Scope ID where applicable

\- Parent event ID where applicable

\- Cause event ID where applicable

\- Event payload

\- State delta

\- Output delta where applicable

\- Error details where applicable

\- Event provenance

\- Event fidelity

\- Event timestamp or logical time

\- Adapter metadata where necessary



The final JavaScript object schemas will be implemented later using Zod.



\## Event Ordering Rules



\### Sequence Number



Every event has a strictly increasing sequence number.



Example sequence:



0 → 1 → 2 → 3 → 4



A completed trace must not contain duplicate or missing sequence numbers unless

a future segmented-trace schema explicitly permits it.



\### Step ID



A visible timeline step may contain multiple related events.



For this statement:



`sum = a + b`



the related events may be:



\- `VARIABLE\_READ` for `a`

\- `VARIABLE\_READ` for `b`

\- `OPERATION\_RESULT`

\- `VARIABLE\_UPDATE` for `sum`



These events may share the same Step ID while using different micro-step

indexes.



\### Micro-Step Index



The micro-step index orders events within a visible step.



Example:



\- Step 12, micro-step 0: Read `a`

\- Step 12, micro-step 1: Read `b`

\- Step 12, micro-step 2: Calculate `a + b`

\- Step 12, micro-step 3: Assign `sum`



The initial UI may present this as one grouped timeline step while allowing

detailed expansion later.



\## Source Location



Every source-related event must refer to the original user source, not the

instrumented, compiled or generated source.



A source location should include:



\- Source filename

\- Start line

\- Start column

\- End line

\- End column

\- Optional source-range offsets

\- Optional source excerpt



CodeFlow will normalize public source locations to one-based line and column

numbers.



Language adapters must convert runtime or debugger-specific numbering into

this normalized format.



\## Event Visibility



Events may be classified as:



\- `USER\_VISIBLE`

\- `DETAIL`

\- `INTERNAL`



\### USER\_VISIBLE



Appears directly in the standard timeline.



Examples:



\- Variable declaration

\- Condition result

\- Loop iteration

\- Function call

\- Array update

\- SQL filter

\- Error



\### DETAIL



Appears when the user expands a step or enables detailed mode.



Examples:



\- Individual operand reads

\- Intermediate expression results

\- Internal comparison details



\### INTERNAL



Required for reconstruction or adapter bookkeeping but not normally displayed.



Internal events must not expose infrastructure details.



\## Event Categories



Planned categories:



\- `LIFECYCLE`

\- `STATEMENT`

\- `SCOPE`

\- `VARIABLE`

\- `EXPRESSION`

\- `CONTROL\_FLOW`

\- `FUNCTION`

\- `COLLECTION`

\- `DATA\_STRUCTURE`

\- `OBJECT`

\- `INPUT\_OUTPUT`

\- `ERROR`

\- `MEMORY`

\- `SQL`

\- `SYSTEM`



\## Lifecycle Events



\### PROGRAM\_START



Represents the beginning of a general-purpose program.



Possible information:



\- Entry function

\- Initial frame

\- Initial input summary



\### PROGRAM\_END



Represents normal program completion.



Possible information:



\- Exit code

\- Return value where applicable

\- Final output summary



\### SQL\_QUERY\_START



Represents the beginning of SQL query processing.



Possible information:



\- SQL dialect

\- Dataset ID

\- Input relation summary



\### SQL\_QUERY\_END



Represents completion of SQL query processing.



Possible information:



\- Completion status

\- Result row count

\- Final result relation ID



\### EXECUTION\_LIMIT\_REACHED



Represents termination caused by:



\- Timeout

\- Memory limit

\- Output limit

\- Trace-step limit

\- Process limit

\- Query-row limit



\## Statement Events



\### STATEMENT\_EXECUTE



Represents the execution of a source statement.



Possible information:



\- Statement type

\- Source excerpt

\- Containing function

\- Containing block



This event is useful for source highlighting even when no visible state changes.



\## Scope Events



\### SCOPE\_ENTER



Possible information:



\- Scope ID

\- Scope type

\- Parent scope ID

\- Associated frame ID



\### SCOPE\_EXIT



Possible information:



\- Scope ID

\- Variables leaving scope



Scope types may include:



\- Global

\- Module

\- Function

\- Block

\- Class

\- Loop

\- Catch

\- Query



\## Variable Events



\### VARIABLE\_DECLARE



Possible information:



\- Binding ID

\- Variable name

\- Declared type where available

\- Initial value

\- Mutability information

\- Scope ID



\### VARIABLE\_ASSIGN



Used when a value is assigned to a newly declared or previously uninitialized

binding.



Possible information:



\- Binding ID

\- Variable name

\- Previous value

\- New value



\### VARIABLE\_UPDATE



Used when an existing variable changes.



Possible information:



\- Binding ID

\- Variable name

\- Previous value

\- New value

\- Update operation



\### VARIABLE\_READ



Possible information:



\- Binding ID

\- Variable name

\- Current value

\- Expression context



Variable-read events may be classified as detail events to prevent excessive

timeline noise.



\### VARIABLE\_DELETE



Used when a language or scope model requires explicit removal from active

state.



Possible information:



\- Binding ID

\- Variable name

\- Previous value

\- Removal reason



\## Expression and Operation Events



\### EXPRESSION\_START



Possible information:



\- Expression type

\- Source expression



\### OPERAND\_READ



Possible information:



\- Operand position

\- Value

\- Binding or entity reference



\### OPERATION\_START



Possible information:



\- Operator

\- Operand references



\### OPERATION\_RESULT



Possible information:



\- Operator

\- Resolved operands

\- Result

\- Result type



\### EXPRESSION\_RESULT



Possible information:



\- Expression type

\- Final value



Expression events must be emitted only when the adapter can obtain or safely

derive the values.



The system must never invent intermediate values.



\## Control-Flow Events



\### CONDITION\_EVALUATE



Possible information:



\- Condition expression

\- Resolved operands

\- Boolean result



\### BRANCH\_ENTER



Possible information:



\- Branch type

\- Branch label

\- Related condition event ID



\### BRANCH\_EXIT



Possible information:



\- Branch type

\- Exit reason



\### LOOP\_START



Possible information:



\- Loop ID

\- Loop type



\### LOOP\_INITIALIZE



Possible information:



\- Loop ID

\- Initialization expression

\- Initialization result



\### LOOP\_CONDITION



Possible information:



\- Loop ID

\- Iteration number

\- Condition expression

\- Condition result



\### LOOP\_ITERATION



Possible information:



\- Loop ID

\- Iteration number



\### LOOP\_UPDATE



Possible information:



\- Loop ID

\- Update expression

\- Previous value

\- New value



\### LOOP\_END



Possible information:



\- Loop ID

\- Completed iteration count

\- Exit reason



Loop exit reasons may include:



\- Condition false

\- Break

\- Return

\- Error

\- Limit reached



\### BREAK



Possible information:



\- Target loop or switch ID



\### CONTINUE



Possible information:



\- Target loop ID

\- Next iteration number



\### RETURN\_STATEMENT



Possible information:



\- Function ID

\- Frame ID

\- Return expression

\- Return value



\## Function and Call-Stack Events



\### FUNCTION\_DECLARE



Normally a detail event unless declaration execution is meaningful in the

language.



Possible information:



\- Function ID

\- Function name

\- Parameter names

\- Declaration scope ID



\### FUNCTION\_CALL



Possible information:



\- Function ID

\- Function name

\- Caller frame ID

\- Argument values

\- New frame ID



\### FUNCTION\_ENTER



Possible information:



\- Function ID

\- Function name

\- Frame ID

\- Parameter bindings

\- Local scope ID



\### FUNCTION\_RETURN



Possible information:



\- Function ID

\- Frame ID

\- Return value

\- Destination frame ID



\### FRAME\_PUSH



State change:



\- Add call-stack frame



\### FRAME\_POP



State change:



\- Remove call-stack frame



Function and frame events may be connected through parent and cause event IDs.



\## Array and Collection Events



\### ARRAY\_CREATE



Possible information:



\- Entity ID

\- Binding ID

\- Length

\- Initial elements

\- Element type where available



\### ARRAY\_ACCESS



Possible information:



\- Entity ID

\- Index

\- Accessed value

\- Access type



\### ARRAY\_UPDATE



Possible information:



\- Entity ID

\- Index

\- Previous value

\- New value



\### ARRAY\_INSERT



Possible information:



\- Entity ID

\- Index

\- Inserted value

\- Previous length

\- New length



\### ARRAY\_DELETE



Possible information:



\- Entity ID

\- Index

\- Deleted value

\- Previous length

\- New length



\### ARRAY\_SWAP



Possible information:



\- Entity ID

\- First index

\- Second index

\- Previous values

\- New values



\### COLLECTION\_CREATE



Used for supported lists, dictionaries, sets or Java collections when a more

specific visual type is unavailable.



\### COLLECTION\_UPDATE



Possible information:



\- Entity ID

\- Collection type

\- Operation

\- Previous state summary

\- New state summary



\## Stack Events



\### STACK\_CREATE



Possible information:



\- Entity ID

\- Initial elements

\- Top orientation



\### STACK\_PUSH



Possible information:



\- Entity ID

\- Pushed value

\- Previous size

\- New size



\### STACK\_POP



Possible information:



\- Entity ID

\- Popped value

\- Previous size

\- New size



\### STACK\_PEEK



Possible information:



\- Entity ID

\- Top value



Stack events must be emitted only for recognized and verified Stack behaviour.



\## Queue Events



Queue is planned after the initial vertical slice.



Planned events:



\- `QUEUE\_CREATE`

\- `QUEUE\_ENQUEUE`

\- `QUEUE\_DEQUEUE`

\- `QUEUE\_PEEK`



\## Linked-Structure Events



Linked structures are planned for a later phase.



Planned events:



\- `NODE\_CREATE`

\- `NODE\_UPDATE`

\- `NODE\_INSERT`

\- `NODE\_DELETE`

\- `NODE\_VISIT`

\- `REFERENCE\_UPDATE`



\## Tree and Graph Events



Trees and graphs are planned for later phases.



Planned events:



\- `TREE\_CREATE`

\- `TREE\_INSERT`

\- `TREE\_SEARCH`

\- `TREE\_TRAVERSE`

\- `GRAPH\_CREATE`

\- `GRAPH\_NODE\_VISIT`

\- `GRAPH\_EDGE\_TRAVERSE`



\## Object Events



\### OBJECT\_CREATE



Possible information:



\- Entity ID

\- Runtime type

\- Class name

\- Bounded property summary



\### PROPERTY\_READ



Possible information:



\- Entity ID

\- Property name

\- Value



\### PROPERTY\_WRITE



Possible information:



\- Entity ID

\- Property name

\- Previous value

\- New value



Object inspection must avoid uncontrolled getters, proxies or deep traversal.



\## Input and Output Events



\### INPUT\_READ



Possible information:



\- Input position

\- Raw input

\- Parsed value

\- Destination binding where known



\### OUTPUT\_APPEND



Possible information:



\- Output stream

\- Appended text

\- Complete output size after append



Supported streams may include:



\- Standard output

\- Standard error

\- SQL result output



Output must appear at the event where it was produced.



\## Error Events



\### SYNTAX\_ERROR



Possible information:



\- Message

\- Source location

\- Language diagnostic code where available



\### COMPILATION\_ERROR



Possible information:



\- Compiler

\- Diagnostic severity

\- Message

\- Source location



\### RUNTIME\_ERROR



Possible information:



\- Error type

\- Message

\- Source location

\- Active frame

\- Termination status



\### EXCEPTION\_THROW



Possible information:



\- Exception type

\- Message

\- Throwing frame

\- Source location



\### EXCEPTION\_CATCH



Possible information:



\- Exception type

\- Catching frame

\- Catch source location



\### EXECUTION\_TERMINATED



Possible information:



\- Termination reason

\- Exit code or signal

\- Last trustworthy event



Errors returned to the browser must not expose host filesystem paths, secrets

or infrastructure details.



\## C Memory Events



\### MEMORY\_ALLOCATE



Possible information:



\- Allocation ID

\- Allocation type

\- Requested size

\- Logical address label

\- Associated pointer binding



Allocation types may include:



\- Stack storage

\- Heap allocation

\- Global storage



\### MEMORY\_READ



Possible information:



\- Allocation ID

\- Offset

\- Size

\- Value

\- Pointer binding



\### MEMORY\_WRITE



Possible information:



\- Allocation ID

\- Offset

\- Size

\- Previous value

\- New value

\- Pointer binding



\### MEMORY\_FREE



Possible information:



\- Allocation ID

\- Previous lifetime state

\- New lifetime state



\### POINTER\_ASSIGN



Possible information:



\- Pointer binding ID

\- Previous target

\- New target

\- Target allocation ID

\- Offset



\### POINTER\_DEREFERENCE



Possible information:



\- Pointer binding ID

\- Target allocation ID

\- Offset

\- Read or write operation

\- Value



\### MEMORY\_ERROR



Possible information:



\- Error type

\- Allocation ID where known

\- Pointer binding where known

\- Sanitizer diagnostic

\- Last trustworthy state



Raw addresses must not be used as permanent allocation identities.



\## SQL Events



\### SQL\_SOURCE



Represents source-table or intermediate-relation selection.



Possible information:



\- Relation ID

\- Source type

\- Table name

\- Columns

\- Bounded row count



\### SQL\_SCAN



Possible information:



\- Relation ID

\- Table name

\- Input row count

\- Bounded row snapshot



\### SQL\_JOIN



Possible information:



\- Left relation ID

\- Right relation ID

\- Join type

\- Join condition

\- Matched row relationships

\- Output relation ID



\### SQL\_FILTER



Possible information:



\- Input relation ID

\- Predicate

\- Row-evaluation summaries

\- Matching row IDs

\- Rejected row IDs

\- Output relation ID



\### SQL\_GROUP



Possible information:



\- Input relation ID

\- Grouping columns

\- Group identifiers

\- Rows in each group

\- Output relation ID



\### SQL\_AGGREGATE



Possible information:



\- Input relation or group ID

\- Aggregate function

\- Input values

\- Result



\### SQL\_HAVING



Possible information:



\- Input group relation ID

\- Predicate

\- Retained group IDs

\- Removed group IDs

\- Output relation ID



\### SQL\_PROJECT



Possible information:



\- Input relation ID

\- Selected columns or expressions

\- Output relation ID



\### SQL\_DISTINCT



Possible information:



\- Input relation ID

\- Duplicate row IDs

\- Retained row IDs

\- Output relation ID



\### SQL\_SORT



Possible information:



\- Input relation ID

\- Ordering expressions

\- Previous order

\- New order

\- Output relation ID



\### SQL\_LIMIT



Possible information:



\- Input relation ID

\- Limit

\- Offset

\- Retained row IDs

\- Output relation ID



\### SQL\_RESULT



Possible information:



\- Result columns

\- Result rows

\- Row count

\- Truncation information



SQL events must identify that they represent an educational logical model unless

they come directly from a verified database result.



\## State Delta Operations



The first state model should use domain-specific delta operations rather than

generic array-index JSON patches.



Planned delta operations:



\- `BINDING\_CREATE`

\- `BINDING\_SET`

\- `BINDING\_REMOVE`

\- `ENTITY\_CREATE`

\- `ENTITY\_UPDATE`

\- `ENTITY\_REMOVE`

\- `SCOPE\_CREATE`

\- `SCOPE\_REMOVE`

\- `FRAME\_PUSH`

\- `FRAME\_UPDATE`

\- `FRAME\_POP`

\- `OUTPUT\_APPEND`

\- `INPUT\_ADVANCE`

\- `ERROR\_SET`

\- `MEMORY\_ALLOCATE`

\- `MEMORY\_WRITE`

\- `MEMORY\_FREE`

\- `QUERY\_RELATION\_SET`

\- `QUERY\_RESULT\_SET`

\- `CURRENT\_LOCATION\_SET`



Domain-specific operations are easier to validate and safer to evolve than

directly patching arbitrary object paths.



\## Normalized Value Model



Values require tagged representations because ordinary JSON cannot accurately

represent every supported runtime value.



Planned value kinds:



\- Null

\- Undefined

\- Boolean

\- Number

\- Big integer

\- String

\- Character

\- Special number

\- Reference

\- Pointer

\- Truncated

\- Unavailable

\- Error value



Special numbers include:



\- Not-a-Number

\- Positive infinity

\- Negative infinity



\## Entity Model



Complex values are stored as entities.



Planned entity kinds:



\- Array

\- List

\- Tuple

\- Dictionary

\- Set

\- Object

\- Stack

\- Queue

\- Memory allocation

\- SQL relation



Bindings reference entities using stable entity IDs.



This supports:



\- Shared references

\- Aliasing

\- Cyclic objects

\- Pointer relationships

\- Efficient state updates

\- Reusable visualizers



\## Value Inspection Limits



Every complex value must support:



\- Maximum depth

\- Maximum child count

\- Maximum string length

\- Maximum total serialized size

\- Truncation indicator

\- Unavailable-value indicator



A truncated value must be labelled explicitly.



\## Event Provenance



Planned provenance values:



\- `RUNTIME\_OBSERVED`

\- `DEBUGGER\_OBSERVED`

\- `INSTRUMENTED`

\- `STATE\_DIFF\_DERIVED`

\- `STATIC\_ANALYSIS\_DERIVED`

\- `EDUCATIONAL\_LOGICAL\_MODEL`



\## Event Fidelity



Planned fidelity values:



\- `EXACT`

\- `BOUNDED`

\- `DERIVED`

\- `MODELED`

\- `UNAVAILABLE`



Examples:



\- Python line event: interpreter-observed and exact

\- Bounded object properties: runtime-observed and bounded

\- Inferred loop iteration: static-analysis derived

\- SQL logical filter stage: educational logical model

\- Unsupported intermediate result: unavailable



\## Capability Manifest



Every trace must include the capabilities that were active for that run.



Examples:



\- Source-line tracking supported

\- Variable values supported

\- Expression detail partial

\- Call stack supported

\- Memory visualization unavailable

\- SQL logical visualization supported

\- Asynchronous execution unsupported



The frontend can use this manifest to:



\- Enable relevant panels

\- Hide irrelevant panels

\- Display limitations

\- Prevent unsupported claims



\## State Transition Rule



Each event represents a transition:



Before State  

\+ Normalized Event  

\+ State Delta  

= After State



The visual engine receives:



\- Before state

\- Active event

\- After state

\- Playback speed

\- Motion preference



This allows animation to represent the actual difference between two verified

states.



\## Determinism Rules



A trace must preserve the event order observed during one run.



Deterministic replay means:



\- Replaying the same trace produces the same reconstructed states.

\- It does not guarantee that rerunning nondeterministic source produces the

&#x20; same trace.

\- Nondeterministic APIs should be restricted or marked.

\- Time, random values and environment-dependent behaviour require explicit

&#x20; policies before support.



\## Trace Limits



Every run must enforce:



\- Maximum event count

\- Maximum visible step count

\- Maximum call-stack depth

\- Maximum value depth

\- Maximum collection elements

\- Maximum SQL rows

\- Maximum console bytes

\- Maximum trace bytes



When a trace limit is reached:



1\. Emit a limit event if safe.

2\. Stop execution.

3\. Mark the trace as truncated.

4\. Preserve the last trustworthy state.

5\. Explain the reason to the user.



\## Trace Validation



Before a trace reaches the frontend:



1\. Validate trace metadata.

2\. Validate schema versions.

3\. Validate sequence ordering.

4\. Validate unique event IDs.

5\. Validate event payloads.

6\. Validate state-delta operations.

7\. Validate source locations.

8\. Validate entity references.

9\. Validate frame and scope references.

10\. Validate checkpoints.

11\. Validate event-count and byte limits.

12\. Reject malformed adapter output.



The frontend must validate the trace again at its trust boundary.



\## Schema Evolution



The initial trace schema version will be:



`0.1.0`



Versioning rules:



\- Patch version: compatible corrections

\- Minor version: backward-compatible additions

\- Major version: incompatible contract changes



Trace migrations may be introduced when persisted execution history is added.



During the MVP, unsupported older major versions may be rejected clearly.



\## Event Model Acceptance Criteria



The generalized event model is acceptable only if it can represent tested

examples from all five initial languages.



\### JavaScript



\- Variable update

\- Condition

\- Loop

\- Function call

\- Array update

\- Stack push

\- Output

\- Runtime error



\### Python



\- Dynamic variable update

\- Loop

\- Function call

\- List update

\- Recursion

\- Output

\- Exception



\### Java



\- Local variable update

\- Method call

\- Array update

\- Stack frame

\- Output

\- Compiler error

\- Exception



\### C



\- Variable update

\- Function call

\- Array update

\- Pointer relationship

\- Heap allocation

\- Memory free

\- Output

\- Runtime failure



\### SQL



\- Source relation

\- Filter

\- Projection

\- Sort

\- Group

\- Aggregate

\- Join

\- Final result

\- SQL error



The schema must be revised during Phase 0 if any required example cannot be

represented without language-specific frontend logic.

