\# CodeFlow Visualizer — State Reconstruction and Replay Architecture



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Proposed architecture

\- Application language: JavaScript

\- Initial state-model version: 0.1.0

\- Related document: 04-execution-event-model.md



\## Purpose



The state reconstruction system converts an ordered execution trace into the

program or query state that should exist at any selected timeline step.



It enables the user to:



\- Move to the first step

\- Move to the previous step

\- Play execution

\- Pause execution

\- Move to the next step

\- Move to the last step

\- Reset execution

\- Seek to any timeline position

\- Change playback speed

\- Inspect past execution states without rerunning the program



\## Core State Rule



Every event represents a state transition.



Before State  

\+ Execution Event  

\+ State Delta  

= After State



The same trace replayed using the same compatible state-model version must

produce the same reconstructed states.



\## Execution versus Replay



CodeFlow separates actual execution from visual playback.



\### Execution Capture



The selected program or SQL query executes once inside an isolated sandbox.



During execution:



\- The language adapter captures runtime observations.

\- Observations become normalized events.

\- Events contain state deltas.

\- Periodic checkpoints may be produced.

\- The completed trace is validated.



\### Trace Replay



After capture:



\- The frontend receives the verified trace.

\- State reconstruction applies trace events.

\- The playback cursor selects the active state.

\- Visualizers display that state.

\- Animations represent the transition between states.



Previous and timeline-seek operations do not rerun the original program.



\## Canonical State Domains



The state model supports two domains:



\- Program execution state

\- Query execution state



A trace activates the state domain that matches its trace domain.



\## Shared State Information



Both domains share:



\- Run ID

\- Trace schema version

\- State-model version

\- Language

\- Source hash

\- Current sequence number

\- Current visible step

\- Current micro-step

\- Current source location

\- Current event ID

\- Current event type

\- Console or result output

\- Active error

\- Completion status

\- Truncation status

\- Capability manifest



\## Program Execution State



The program execution state should contain:



\- Scope hierarchy

\- Variable bindings

\- Entity graph

\- Call-stack frames

\- Current frame

\- Input position

\- Console output

\- Active exception or error

\- Memory state where applicable

\- Language-specific bounded metadata



\### Scope State



Each scope should contain:



\- Scope ID

\- Scope type

\- Parent scope ID

\- Associated frame ID where applicable

\- Active status

\- Binding IDs

\- Source location

\- Entry event ID

\- Exit event ID where completed



Possible scope types:



\- Global

\- Module

\- Function

\- Block

\- Class

\- Loop

\- Catch



\### Variable Binding State



A variable binding is separate from the value or entity it references.



Each binding should contain:



\- Binding ID

\- Variable name

\- Scope ID

\- Frame ID where applicable

\- Declared type where available

\- Runtime type where available

\- Mutability information

\- Current normalized value

\- Declaration source location

\- Last-updated event ID

\- Active or out-of-scope status



Separate binding IDs are necessary because different scopes may contain

variables with the same name.



\### Entity State



Complex values are stored as entities.



Examples:



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



Each entity should contain:



\- Entity ID

\- Entity type

\- Runtime type where available

\- Current bounded content

\- Creation event ID

\- Last-updated event ID

\- Active status

\- Truncation information

\- Language-specific bounded metadata



Bindings refer to entities using stable entity references.



This allows CodeFlow to represent shared references.



Example relationship:



Variable `a` → Array entity `A1`  

Variable `b` → Same Array entity `A1`



Updating the shared entity should be visible through both bindings.



\### Call-Stack State



The call stack is an ordered collection of frames.



Each frame should contain:



\- Frame ID

\- Function or method ID

\- Function or method name

\- Caller frame ID

\- Source location

\- Parameter binding IDs

\- Local scope ID

\- Return destination

\- Current status

\- Entry event ID

\- Return event ID where completed



Frame statuses may include:



\- Active

\- Suspended

\- Returning

\- Completed

\- Failed



The top frame is the currently executing frame.



\### Input State



Input state should contain:



\- Complete bounded pre-supplied input

\- Current read position

\- Previously consumed values

\- Remaining input summary

\- Last input event ID



The first MVP uses pre-supplied input rather than interactive terminal prompts.



\### Console State



Console state should contain ordered output segments.



Each output segment should contain:



\- Output segment ID

\- Event ID

\- Output stream

\- Appended text

\- Cumulative byte position



The complete console output is reconstructed by applying output segments in

event order.



\### Error State



The active error state may contain:



\- Error category

\- Error type

\- Message

\- Source location

\- Related frame

\- Related event

\- Exit code or signal

\- Trustworthy-state boundary

\- Termination reason



Host paths and internal infrastructure information must not appear in the

public error state.



\## C Memory State



C memory state extends the program execution state.



It should contain:



\- Logical allocations

\- Pointer bindings

\- Pointer targets

\- Allocation lifetime

\- Bounded memory values

\- Memory errors



\### Logical Allocation



Each allocation should contain:



\- Allocation ID

\- Allocation type

\- Logical address label

\- Runtime address available only as bounded metadata

\- Requested size

\- Element type where known

\- Allocation event ID

\- Free event ID where applicable

\- Lifetime status

\- Bounded contents



Allocation types may include:



\- Stack

\- Heap

\- Global



Lifetime statuses may include:



\- Allocated

\- Active

\- Freed

\- Invalid

\- Unknown



Raw runtime addresses must not act as permanent entity IDs.



\### Pointer State



Each pointer representation should contain:



\- Pointer binding ID

\- Target allocation ID where known

\- Offset

\- Null status

\- Dangling status

\- Last assignment event ID

\- Bounded raw-address metadata where permitted



A pointer arrow in the UI is derived from this state.



\### Memory Trust Boundary



If a sanitizer, debugger or operating system reports serious undefined

behaviour:



\- Store the last trustworthy event.

\- Mark later state as unavailable.

\- Stop claiming that subsequent values are correct.

\- Present the detected error clearly.

\- Terminate the run when necessary.



\## Query Execution State



SQL uses a specialized query state.



It should contain:



\- SQL dialect

\- Dataset ID

\- Source tables

\- Current logical operation

\- Current relation

\- Intermediate relations

\- Selected row IDs

\- Rejected row IDs

\- Active groups

\- Current ordering

\- Projected columns

\- Final result

\- SQL errors

\- Logical-model fidelity



\### SQL Relation State



A SQL relation should contain:



\- Relation ID

\- Column definitions

\- Ordered row IDs

\- Bounded row values

\- Source operation

\- Parent relation IDs

\- Creation event ID

\- Truncation information



\### Stable SQL Row Identity



Rows require stable identities during visualization.



A row identity should remain stable while the row moves through:



\- Source scan

\- Join

\- Filter

\- Group

\- Projection

\- Sort

\- Distinct

\- Limit



Joined or aggregated rows may require new derived row identities that retain

references to their source row IDs.



\### SQL Operation State



The active SQL operation may contain:



\- Operation type

\- Input relation IDs

\- Output relation ID

\- SQL source location

\- Predicate or expression

\- Retained row IDs

\- Removed row IDs

\- Group information

\- Sorting information

\- Fidelity label



SQL logical state must remain clearly separated from any optional physical

query-plan information.



\## Initial State



Every trace starts from a validated initial state.



For program execution, the initial state normally contains:



\- Run metadata

\- Empty scope collection

\- Empty binding collection

\- Empty entity collection

\- Empty call stack

\- Initial input

\- Empty console

\- No error

\- No current source location



For SQL, the initial state normally contains:



\- Run metadata

\- Dataset metadata

\- Bounded source-table snapshots

\- No current logical operation

\- No final result

\- No error



\## Pure State Reducer



State reconstruction should use a pure reducer.



A pure reducer:



\- Receives the previous state and one validated event.

\- Does not modify the previous state directly.

\- Does not access the network.

\- Does not read files.

\- Does not execute user code.

\- Does not depend on React.

\- Returns the next state.

\- Produces the same result for the same inputs.



Keeping the reducer independent from React makes it easier to test.



\## State Delta Operations



Planned delta operations include:



\- `CURRENT\_LOCATION\_SET`

\- `SCOPE\_CREATE`

\- `SCOPE\_REMOVE`

\- `BINDING\_CREATE`

\- `BINDING\_SET`

\- `BINDING\_REMOVE`

\- `ENTITY\_CREATE`

\- `ENTITY\_UPDATE`

\- `ENTITY\_REMOVE`

\- `FRAME\_PUSH`

\- `FRAME\_UPDATE`

\- `FRAME\_POP`

\- `INPUT\_ADVANCE`

\- `OUTPUT\_APPEND`

\- `ERROR\_SET`

\- `MEMORY\_ALLOCATE`

\- `MEMORY\_WRITE`

\- `MEMORY\_FREE`

\- `QUERY\_RELATION\_SET`

\- `QUERY\_RESULT\_SET`



Each operation must have its own Zod validation schema.



\## Delta Validation Rules



Before a delta is applied:



1\. Validate the operation type.

2\. Validate the payload.

3\. Verify referenced scope IDs.

4\. Verify referenced binding IDs.

5\. Verify referenced entity IDs.

6\. Verify referenced frame IDs.

7\. Verify memory allocation IDs where applicable.

8\. Verify relation IDs where applicable.

9\. Reject impossible state transitions.

10\. Ensure limits are not exceeded.



Examples of invalid transitions:



\- Updating a missing binding

\- Popping an empty call stack

\- Freeing an unknown allocation

\- Updating a relation that was never created

\- Referencing a missing entity

\- Applying events in the wrong order



\## Event Application Order



Events must be applied using their normalized sequence number.



The state engine must not:



\- Sort events using timestamps

\- Apply events based on arrival order without validation

\- Skip unknown required events

\- Apply a later event before an earlier event



If an unsupported required event type is found, replay must stop with a clear

compatibility error.



\## Checkpoint Architecture



Reconstructing every state from event zero can become slow for long traces.



Periodic checkpoints reduce replay work.



A checkpoint should contain:



\- Checkpoint ID

\- Run ID

\- State-model version

\- Event sequence number

\- Visible step number

\- Complete canonical state

\- Checkpoint hash or integrity information

\- Creation reason



Possible checkpoint reasons:



\- Initial state

\- Periodic interval

\- Function boundary

\- Major data-structure change

\- SQL operation boundary

\- Final state



\## Checkpoint Strategy



The exact interval will be benchmarked.



An initial strategy may create:



\- One checkpoint at the initial state

\- One checkpoint after a configurable number of events

\- One checkpoint at the final state

\- Optional checkpoints at important boundaries



Too many checkpoints increase trace size.



Too few checkpoints make seeking slower.



The final policy must balance:



\- Trace size

\- Reconstruction speed

\- Browser memory

\- Device performance

\- Event complexity



\## State Cache



The frontend may keep a bounded cache of recently reconstructed states.



The cache may contain:



\- Current state

\- Previous state

\- Next state

\- Recently visited timeline states

\- Nearby checkpoint reconstructions



The cache must use a size limit and eviction policy.



An LRU-style strategy is appropriate for later implementation.



\## Timeline Cursor



The playback cursor identifies the currently committed trace position.



Recommended cursor model:



\- Cursor `-1`: No event has been applied

\- Cursor `0`: First event has been applied

\- Cursor `N - 1`: Last event has been applied



The visible step cursor may differ from the raw event cursor when multiple

micro-events belong to one timeline step.



The state store should therefore track:



\- Raw event cursor

\- Visible step cursor

\- Micro-step cursor

\- Active event ID

\- Active step ID



\## Playback States



Planned playback statuses:



\- `IDLE`

\- `READY`

\- `PLAYING`

\- `PAUSED`

\- `SEEKING`

\- `ANIMATING`

\- `COMPLETED`

\- `ERROR`



\### IDLE



No valid trace is loaded.



\### READY



A trace is loaded and playback can begin.



\### PLAYING



The cursor advances automatically.



\### PAUSED



The cursor remains at a stable event boundary.



\### SEEKING



The state engine is reconstructing a selected timeline position.



\### ANIMATING



The visual layer is presenting the transition between before-state and

after-state.



\### COMPLETED



The cursor has reached the final event.



\### ERROR



Trace validation or reconstruction failed.



\## First Control



The First control:



1\. Stops automatic playback.

2\. Cancels or settles the active animation safely.

3\. Restores the state at the first visible step.

4\. Updates source highlighting.

5\. Updates the timeline cursor.

6\. Updates all active visualizers.



\## Previous Control



The Previous control:



1\. Stops automatic playback if required.

2\. Identifies the previous visible step.

3\. Uses a cached state when available.

4\. Otherwise uses the nearest earlier checkpoint.

5\. Replays forward from that checkpoint.

6\. Updates the UI to the previous stable state.



It must not reverse-execute the language runtime.



\## Next Control



The Next control:



1\. Identifies the next visible step.

2\. Reconstructs the before-state.

3\. Applies the relevant event group.

4\. Produces the after-state.

5\. Starts the synchronized visual transition.

6\. Commits the after-state.

7\. Updates the cursor.



\## Play Control



The Play control:



1\. Changes playback status to `PLAYING`.

2\. Advances to the next visible step.

3\. Waits for the transition coordinator.

4\. Commits the next state.

5\. Repeats until paused, completed or interrupted.



The timeline must not advance ahead of an unfinished required animation.



\## Pause Control



The Pause control:



1\. Stops scheduling future steps.

2\. Allows the current essential transition to settle or safely cancel.

3\. Keeps the cursor at a valid state boundary.

4\. Changes playback status to `PAUSED`.



\## Last Control



The Last control:



1\. Stops playback.

2\. Finds the final state or final checkpoint.

3\. Reconstructs the final state if necessary.

4\. Updates all panels.

5\. Highlights the final relevant source position.

6\. Sets playback status to `COMPLETED`.



Seeking directly to the last step does not require playing every animation.



\## Reset Control



Reset means returning to the state before the first event.



Reset should:



\- Stop playback

\- Clear active animations

\- Restore the initial state

\- Set the cursor to `-1`

\- Clear active source highlighting

\- Preserve the loaded trace

\- Preserve the source code

\- Allow playback to start again



Reset does not delete the trace.



\## Timeline Seeking



When the user selects a timeline position:



1\. Stop automatic playback.

2\. Mark playback status as `SEEKING`.

3\. Identify the target event or step.

4\. Find the nearest previous checkpoint.

5\. Restore that checkpoint.

6\. Replay required deltas without long animations.

7\. Validate the reconstructed target state.

8\. Update all visualizers.

9\. Set the cursor.

10\. Change playback status to `PAUSED` or `READY`.



Seeking should prioritize speed and correctness over decorative animation.



\## Playback Speed



Planned speed options may include:



\- 0.25x

\- 0.5x

\- 1x

\- 1.5x

\- 2x



Speed affects animation and delay duration.



Speed must not change:



\- Event order

\- State-delta order

\- Reconstructed values

\- Output ordering

\- Error ordering

\- Final state



At high speeds, non-essential transitions may be shortened, but state changes

must never be skipped.



\## Source Synchronization



At every committed step, these values must correspond to the same event:



\- Source location

\- Current event

\- Reconstructed state

\- Visual state

\- Console state

\- Call-stack state

\- Timeline position



For SQL, the query-clause highlight and active relational operation must also

refer to the same step.



\## Trace Invalidation



Every trace stores a source hash.



If the user edits the source after execution:



\- Compare the current source hash with the trace source hash.

\- Mark the trace as stale.

\- Disable misleading source synchronization.

\- Ask the user to run the modified source again.

\- Do not silently attach the old trace to new source.



The user may still inspect the old trace only if the corresponding source

revision is preserved.



\## Partial and Failed Traces



A run may terminate before normal completion.



Examples:



\- Runtime error

\- Exception

\- Segmentation fault

\- SQL error

\- Timeout

\- Trace limit

\- Output limit

\- Memory limit

\- User cancellation



A partial trace may still be replayable up to its last trustworthy event.



The trace must record:



\- Completion status

\- Termination reason

\- Last trustworthy event

\- Whether final state is partial

\- Whether any values are unavailable



\## Truncated Values



When values exceed inspection limits:



\- Store a bounded representation.

\- Mark the value as truncated.

\- Preserve the known length where possible.

\- Do not pretend the complete value was captured.

\- Keep replay deterministic using the bounded representation.



\## Reconstruction Error Handling



If reconstruction fails:



1\. Stop playback.

2\. Preserve the last valid state.

3\. Record the failing event ID.

4\. Record the failing delta operation.

5\. Show a safe internal-trace error.

6\. Prevent further invalid transitions.

7\. Log technical information through the appropriate service.

8\. Do not expose secrets or host paths.



\## Browser Memory Management



Large traces can consume significant browser memory.



The MVP should enforce:



\- Maximum trace bytes

\- Maximum event count

\- Maximum entity size

\- Maximum checkpoint count

\- Maximum cached states

\- Maximum SQL relation rows

\- Maximum console bytes



Future optimizations may include:



\- Trace chunking

\- Compression

\- IndexedDB caching

\- Worker-based reconstruction

\- Lazy checkpoint loading

\- Server-side trace storage



These optimizations should not be introduced until measurement justifies them.



\## Persistence Direction



During the first vertical slice, traces may remain in browser memory.



When execution history is implemented, persisted traces should include:



\- Trace metadata

\- Schema version

\- State-model version

\- Source revision or hash

\- Capability manifest

\- Events

\- Checkpoints

\- Completion status

\- Adapter/runtime versions



Large traces should not be embedded blindly inside MongoDB project documents.



\## Testing Requirements



\### Reducer Unit Tests



Test:



\- Binding creation

\- Binding update

\- Binding removal

\- Scope entry and exit

\- Entity creation and update

\- Frame push and pop

\- Output append

\- Error state

\- Memory allocation and free

\- SQL relation updates



\### Deterministic Replay Tests



For the same trace:



\- Reconstruct the final state multiple times.

\- Verify identical results.

\- Seek to selected steps.

\- Verify identical intermediate states.

\- Navigate backward and forward.

\- Verify the expected state at every step.



\### Checkpoint Tests



Test:



\- Restore from initial checkpoint

\- Restore from middle checkpoint

\- Restore final checkpoint

\- Replay after checkpoint

\- Invalid checkpoint rejection

\- Incompatible version rejection



\### Timeline Tests



Test:



\- First

\- Previous

\- Next

\- Play

\- Pause

\- Last

\- Reset

\- Seek

\- Speed changes

\- Completion

\- Partial trace

\- Failed trace



\### Cross-Language Fixture Tests



Use representative traces for:



\- JavaScript

\- Python

\- Java

\- C

\- SQL



All supported languages must use the same reconstruction engine for common

state operations.



\## Acceptance Criteria



State reconstruction is accepted only when:



1\. The same trace always reconstructs the same state.

2\. Previous navigation restores the correct earlier state.

3\. Next navigation restores the correct later state.

4\. Seeking does not rerun user code.

5\. Source highlighting matches the active event.

6\. Console output matches the selected step.

7\. Call-stack state matches the selected step.

8\. Arrays and entities preserve identity.

9\. Shared references remain correct.

10\. C pointer targets remain connected to logical allocations.

11\. SQL relations maintain stable row identities.

12\. Partial traces stop at the last trustworthy state.

13\. Stale traces are detected after source changes.

14\. Invalid deltas are rejected safely.

15\. Long traces remain within configured resource limits.

