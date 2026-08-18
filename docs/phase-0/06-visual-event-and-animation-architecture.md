\# CodeFlow Visualizer — Visual Event and Animation Architecture



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Proposed architecture

\- Application language: JavaScript

\- UI framework: React

\- Animation library: Framer Motion

\- Related documents:

&#x20; - 04-execution-event-model.md

&#x20; - 05-state-reconstruction-and-replay.md



\## Purpose



The visual-event system converts verified execution events and reconstructed

states into meaningful visual representations.



Animations in CodeFlow Visualizer are not decorative effects.



Every important transition should help the user understand:



\- What executed

\- What changed

\- Which values were involved

\- Why control moved to the next step

\- Which part of the program state was affected

\- What the resulting state became



\## Core Visual Pipeline



Execution Event  

→ Before State  

→ Visual Intent  

→ Source Highlight  

→ Visual Transition  

→ After State  

→ Settled Timeline Step



\## Primary UI Concept



The main interface will follow an original design direction called:



\*\*Execution Observatory\*\*



The user should feel that they are observing a live execution system rather

than using a generic learning dashboard.



The visual language should communicate flow:



Source code  

→ Active execution signal  

→ State transformation  

→ Timeline checkpoint



\## Design Principles



\### Meaning Before Decoration



Animation should explain state change.



Examples:



\- A pushed value enters the Stack.

\- A popped value leaves the Stack.

\- An updated variable transitions from its old value to its new value.

\- An accessed array element highlights.

\- A function-call frame appears.

\- A returned frame unwinds.

\- SQL rows that fail a predicate visually leave the active relation.



\### Stable State Boundaries



After every animation:



\- The visual state must be stable.

\- The timeline cursor must point to the correct step.

\- Source highlighting must match the active event.

\- Variables must match the reconstructed state.

\- Console output must match the reconstructed state.

\- Call-stack state must match the reconstructed state.



\### Consistent Visual Grammar



The same event type should use the same visual meaning across languages.



For example, `VARIABLE\_UPDATE` should feel consistent whether it originated

from Java, Python, C or JavaScript.



\### Honest Representation



The visual layer must distinguish between:



\- Runtime-observed behaviour

\- Debugger-observed behaviour

\- Derived behaviour

\- Bounded values

\- Educational SQL logical models

\- Unavailable information



\### Accessibility



The interface must remain understandable:



\- Without relying only on colour

\- With reduced motion

\- With keyboard navigation

\- With visible focus indicators

\- With readable contrast

\- At different playback speeds



\## Architecture Boundaries



\### Language Adapter Responsibility



The language adapter determines what happened.



It produces:



\- Normalized execution event

\- Source location

\- State delta

\- Provenance

\- Fidelity



The adapter does not decide:



\- Animation duration

\- Component layout

\- CSS classes

\- Motion direction

\- Visual colour

\- Responsive behaviour



\### State Reconstruction Responsibility



The state engine determines:



\- Before state

\- After state

\- Active event

\- Active source location

\- Current timeline position



It does not directly animate UI elements.



\### Visual Intent Responsibility



The visual-intent mapper determines:



\- Which visualizer is affected

\- Which visual entity is targeted

\- What transition meaning applies

\- Which elements are emphasized

\- Whether the event has a primary or secondary visual effect



\### React Component Responsibility



React components:



\- Render the current visual state

\- Receive visual intents

\- Perform transitions

\- Report when required transitions settle

\- Support reduced-motion alternatives



React components must not reinterpret raw language syntax.



\## Visual Intent Model



A visual intent should conceptually contain:



\- Visual intent ID

\- Related event ID

\- Related step ID

\- Visualizer type

\- Target entity ID

\- Target binding ID where applicable

\- Target frame ID where applicable

\- Source location

\- Transition type

\- Before visual value

\- After visual value

\- Emphasis level

\- Animation priority

\- Animation duration category

\- Required or optional status

\- Accessibility announcement

\- Fidelity label

\- Additional visual metadata



\## Visual Intent Categories



Planned categories:



\- `SOURCE\_HIGHLIGHT`

\- `VALUE\_TRANSITION`

\- `ENTITY\_TRANSITION`

\- `CONTROL\_FLOW`

\- `CALL\_STACK`

\- `DATA\_STRUCTURE`

\- `MEMORY`

\- `SQL\_RELATION`

\- `INPUT\_OUTPUT`

\- `ERROR`

\- `TIMELINE`

\- `EXPLANATION`



\## Visualizer Registry



The frontend should use a registry that maps event types to visual-intent

builders and appropriate visualizers.



Examples:



\- `VARIABLE\_DECLARE` → Variables visualizer

\- `VARIABLE\_UPDATE` → Variables visualizer

\- `ARRAY\_ACCESS` → Array visualizer

\- `ARRAY\_UPDATE` → Array visualizer

\- `STACK\_PUSH` → Stack visualizer

\- `FUNCTION\_CALL` → Call-stack visualizer

\- `MEMORY\_ALLOCATE` → Memory visualizer

\- `POINTER\_ASSIGN` → Pointer visualizer

\- `SQL\_FILTER` → SQL relation visualizer

\- `SQL\_JOIN` → SQL relation visualizer

\- `OUTPUT\_APPEND` → Console visualizer



The registry allows new visualizers to be added without changing every

language adapter.



\## Visualizer Selection



A timeline step may affect multiple visualizers.



Example:



`result = add(5, 10)`



may affect:



\- Source highlighter

\- Call-stack visualizer

\- Parameter variables

\- Expression visualizer

\- Result variable

\- Timeline



The visual-intent mapper should identify:



\- Primary visualizer

\- Secondary visualizers

\- Required transitions

\- Optional emphasis effects



\## Transition Coordinator



The Transition Coordinator controls the sequence of visual changes.



Responsibilities:



\- Receive before state

\- Receive active event

\- Receive after state

\- Build visual intents

\- Start source highlighting

\- Start required animations

\- Coordinate related visualizers

\- Wait for required transitions

\- Commit the after state

\- Mark the step as settled

\- Notify the playback controller

\- Handle pause, seek and cancellation safely



\## Transition Lifecycle



Each visual step follows this lifecycle:



\### 1. Prepare



\- Confirm the event is valid.

\- Load before state.

\- Load after state.

\- Resolve visual targets.

\- Determine motion preferences.

\- Determine effective playback speed.



\### 2. Focus



\- Highlight the active source location.

\- Focus the related visual panel.

\- Show the current operation.

\- Announce the event where accessibility requires it.



\### 3. Explain the Cause



Where appropriate:



\- Highlight operands.

\- Show the condition.

\- Show the accessed index.

\- Show function arguments.

\- Show SQL input relations.



\### 4. Animate the Change



Examples:



\- Transition value

\- Move an element

\- Add a frame

\- Remove a frame

\- Draw a reference

\- Filter rows

\- Reorder rows



\### 5. Commit



\- Render the complete after state.

\- Update all related panels.

\- Update console output.

\- Update timeline position.

\- Mark the event as completed.



\### 6. Settle



\- Remove temporary emphasis.

\- Preserve current-line highlighting.

\- Report completion to the playback controller.



\## Animation State Machine



Planned animation states:



\- `IDLE`

\- `PREPARING`

\- `FOCUSING`

\- `ANIMATING`

\- `COMMITTING`

\- `SETTLED`

\- `CANCELLED`

\- `ERROR`



\### IDLE



No transition is active.



\### PREPARING



Targets and states are being resolved.



\### FOCUSING



Source and affected elements receive initial emphasis.



\### ANIMATING



Required visual transitions are running.



\### COMMITTING



The after state is applied completely.



\### SETTLED



The UI represents a valid timeline boundary.



\### CANCELLED



The transition was safely interrupted by reset, seek or trace replacement.



\### ERROR



The visual transition failed and the UI must fall back to the after state.



\## Synchronization Invariants



At every settled step, these must refer to the same event:



1\. Active source location

2\. Active execution event

3\. Reconstructed program or query state

4\. Variables panel

5\. Data-structure visualizers

6\. Call stack

7\. Console/output

8\. Error panel

9\. Timeline cursor

10\. Current-step description



The timeline must not advance before required visual transitions settle.



The UI must always prefer a correct final state over an incomplete animation.



\## Source Highlighting



Monaco Editor decorations will represent source execution.



Planned highlight types:



\- Current statement

\- Current expression

\- Condition expression

\- Selected branch

\- Error location

\- Function call location

\- Function return location

\- SQL clause

\- SQL predicate

\- SQL selected columns



Source highlighting should:



\- Refer to original source locations

\- Support line and column ranges

\- Scroll active code into view when appropriate

\- Avoid unnecessary viewport jumping

\- Remain visible after a transition settles

\- Use more than colour alone where possible



\## Source Execution Signal



The signature CodeFlow interaction may use a subtle visual signal connecting

the editor and visualization workspace.



Conceptually:



Active source line  

→ Trace signal  

→ Affected visualizer  

→ State transition  

→ Timeline checkpoint



This signal should be restrained and performant.



It must not distract from code readability.



\## Variable Visualizations



\### VARIABLE\_DECLARE



Visual behaviour:



\- New binding appears.

\- Variable name and initial value become visible.

\- Scope label appears where useful.

\- The new binding receives temporary emphasis.



\### VARIABLE\_ASSIGN



Visual behaviour:



\- Destination binding highlights.

\- Assigned value moves or fades into the value position.

\- The settled state displays the assigned value.



\### VARIABLE\_UPDATE



Visual behaviour:



\- Previous value remains briefly visible.

\- Transition communicates replacement.

\- New value settles into the variable.

\- Optional change indicator shows old and new values.



\### VARIABLE\_READ



Visual behaviour:



\- Variable receives a short access highlight.

\- Current value is emphasized.

\- Detailed mode may connect the value to an expression.



Variable-read animations should remain subtle because reads can occur

frequently.



\## Expression Visualizations



For supported expression details:



1\. Highlight the expression.

2\. Present available operands.

3\. Substitute resolved values.

4\. Show the operation.

5\. Show the result.

6\. Connect the result to its destination.



Example concept:



`a + b`  

→ `10 + 5`  

→ `15`  

→ `sum = 15`



If intermediate values are unavailable, the UI must show only verified

information.



\## Condition and Branch Visualizations



\### CONDITION\_EVALUATE



Visual behaviour:



\- Highlight the condition.

\- Show resolved operands where available.

\- Display true or false.

\- Use text/icon shape in addition to colour.



\### BRANCH\_ENTER



Visual behaviour:



\- Emphasize the selected path.

\- De-emphasize the unselected path.

\- Move source focus into the selected branch.



The UI should answer:



\- What condition was checked?

\- What did it evaluate to?

\- Which branch was selected?



\## Loop Visualizations



Loop visualization should show:



\- Loop type

\- Current iteration

\- Initialization

\- Condition result

\- Body execution

\- Update operation

\- Exit reason



\### LOOP\_START



\- Create or activate a loop indicator.



\### LOOP\_CONDITION



\- Highlight the condition.

\- Show true or false.



\### LOOP\_ITERATION



\- Advance the iteration indicator.

\- Keep nested loop identities separate.



\### LOOP\_UPDATE



\- Show the loop variable changing.



\### LOOP\_END



\- Show the completed iteration count.

\- Explain whether the loop ended through false condition, break, return or

&#x20; error.



Nested loops must use different stable loop IDs.



\## Function and Call-Stack Visualizations



\### FUNCTION\_CALL



Visual behaviour:



\- Highlight the call expression.

\- Show arguments.

\- Create a pending frame transition.



\### FUNCTION\_ENTER



Visual behaviour:



\- Add the new frame to the call-stack panel.

\- Show parameter bindings.

\- Move source focus to the function body.



\### FUNCTION\_RETURN



Visual behaviour:



\- Show the return value.

\- Visually unwind the frame.

\- Restore focus to the caller.

\- Connect the return value to its destination where known.



\### Recursion



Repeated calls should visibly grow the call stack using separate frame IDs.



Returns should unwind frames in the correct order.



\## Array Visualizations



Array visualizers should display:



\- Array name

\- Stable entity identity where useful

\- Element values

\- Index labels

\- Access/update emphasis

\- Truncation indicator when required



\### ARRAY\_CREATE



\- Array cells appear in index order.



\### ARRAY\_ACCESS



\- Target index highlights.

\- Accessed value is emphasized.



\### ARRAY\_UPDATE



\- Target index highlights.

\- Previous value transitions to the new value.



\### ARRAY\_INSERT



\- Existing elements shift where appropriate.

\- New element enters at the correct index.



\### ARRAY\_DELETE



\- Removed element exits.

\- Remaining elements reposition.



\### ARRAY\_SWAP



\- Both indexes highlight.

\- Elements exchange positions.

\- Final order settles before timeline advancement.



\## Stack Visualizations



Stack is one visualization type, not the central architecture.



\### STACK\_CREATE



\- Display the Stack container and initial elements.



\### STACK\_PUSH



\- New element enters from above or an appropriate direction.

\- Existing elements adjust.

\- Top indicator moves to the new element.

\- Final stack state matches the trace.



\### STACK\_POP



\- Top element highlights.

\- Element exits.

\- Top indicator moves to the next element.

\- Popped value may move to its destination where known.



\### STACK\_PEEK



\- Top element highlights without structural movement.



Stack animation must occur only for verified Stack events.



\## Queue Visualizations



Queue is planned for a later phase.



\### QUEUE\_ENQUEUE



\- Element enters at the rear.

\- Rear indicator updates.



\### QUEUE\_DEQUEUE



\- Element leaves from the front.

\- Front indicator updates.



\### QUEUE\_PEEK



\- Front element highlights without removal.



\## Object Visualizations



Object visualizers should use bounded property cards or diagrams.



\### OBJECT\_CREATE



\- New object entity appears.

\- Class/runtime type is shown.

\- Initial properties appear.



\### PROPERTY\_READ



\- Target property highlights.



\### PROPERTY\_WRITE



\- Target property transitions from old value to new value.



Shared references should point to one object entity rather than displaying

incorrect duplicate objects.



\## C Memory and Pointer Visualizations



The memory visualizer should use logical allocation identities.



\### MEMORY\_ALLOCATE



Visual behaviour:



\- New allocation block appears.

\- Logical address label appears.

\- Allocation size and type appear.

\- Associated pointer connects to the allocation.



\### POINTER\_ASSIGN



Visual behaviour:



\- Pointer value updates.

\- Pointer arrow redirects to the new target.

\- Null pointer displays no target arrow.



\### POINTER\_DEREFERENCE



Visual behaviour:



\- Pointer highlights.

\- Target allocation highlights.

\- Offset or element position highlights.

\- Read or write direction is communicated.



\### MEMORY\_WRITE



Visual behaviour:



\- Target memory cell highlights.

\- Previous value transitions to the new value.



\### MEMORY\_FREE



Visual behaviour:



\- Allocation changes to a freed state.

\- Existing pointers become visibly dangling where known.

\- The allocation should not disappear immediately because its lifetime is

&#x20; educationally important.



\### MEMORY\_ERROR



Visual behaviour:



\- Relevant pointer/allocation highlights as invalid.

\- Timeline stops at the last trustworthy state.

\- Error explanation appears.



Raw runtime addresses must not control permanent visual identity.



\## SQL Relation Visualizations



SQL uses tables, rows, columns and relation transformations.



\### SQL\_SOURCE or SQL\_SCAN



\- Display source table.

\- Show bounded rows and columns.

\- Assign stable row identities.



\### SQL\_FILTER



\- Highlight predicate.

\- Evaluate rows in a controlled visual sequence or group.

\- Matching rows remain active.

\- Rejected rows fade or move out.

\- Display retained and rejected counts.



\### SQL\_PROJECT



\- Highlight selected columns.

\- Unselected columns de-emphasize.

\- Output relation displays projected columns.



\### SQL\_JOIN



\- Display participating relations.

\- Highlight matching row relationships.

\- Connect or combine matched rows.

\- Create a new output relation.



\### SQL\_GROUP



\- Rows move into visible groups.

\- Grouping keys remain visible.

\- Each group receives a stable identity.



\### SQL\_AGGREGATE



\- Highlight input values.

\- Show the aggregate operation.

\- Display the aggregate result for each group.



\### SQL\_HAVING



\- Evaluate the group predicate.

\- Remove groups that fail.

\- Preserve groups that pass.



\### SQL\_DISTINCT



\- Identify duplicate rows.

\- Remove duplicates.

\- Preserve retained rows.



\### SQL\_SORT



\- Show previous row order.

\- Reposition rows into the new order.

\- Preserve stable row identities.



\### SQL\_LIMIT



\- Retain only the allowed result range.

\- De-emphasize or remove rows outside the limit.



\### SQL\_RESULT



\- Display final verified columns and rows.

\- Show row count.

\- Show truncation information when applicable.



SQL visualizations must identify educational logical operations as logical

models rather than exact physical database-engine actions.



\## Input and Output Visualizations



\### INPUT\_READ



\- Highlight the relevant input operation.

\- Show the consumed input value.

\- Update remaining input state.

\- Connect the value to its destination where known.



\### OUTPUT\_APPEND



\- Append text at the corresponding timeline step.

\- Briefly highlight newly added output.

\- Preserve all output produced before the selected step.

\- Remove later output when navigating backward.



\## Error Visualizations



Errors should display:



\- Error category

\- Error message

\- Source location

\- Last trustworthy step

\- Relevant variable, frame, pointer or query operation

\- Safe recovery action



Error animations should not be excessive.



A clear highlight and stable explanation are more important than decorative

motion.



\## Timeline Visualizations



Each visible timeline point should indicate:



\- Step position

\- Event category

\- Completion status

\- Active status

\- Error or limit status

\- Optional function/loop grouping



The active point must correspond to the currently committed state.



Possible event-group colours may exist, but category icons or shapes should

also be used for accessibility.



\## Playback Speed



Planned speeds:



\- 0.25x

\- 0.5x

\- 1x

\- 1.5x

\- 2x



Playback speed changes:



\- Delays

\- Transition duration

\- Optional emphasis duration



Playback speed must not change:



\- Event order

\- State order

\- Output order

\- Final result

\- Required state transitions



\## Pause Behaviour



When Pause is selected:



\- Stop scheduling later steps.

\- Settle or safely cancel the current transition.

\- Stop at a valid state boundary.

\- Preserve source highlighting.

\- Preserve current timeline position.



\## Seek Behaviour



Timeline seeking prioritizes correctness and speed.



During seek:



\- Long transitions are skipped.

\- State is reconstructed from a checkpoint.

\- The final selected state is rendered.

\- A brief focus transition may be used.

\- The source location updates immediately after reconstruction.



\## Reset Behaviour



Reset should:



\- Cancel active visual transitions

\- Restore the initial state

\- Clear active source highlighting

\- Restore the initial timeline position

\- Keep the trace loaded

\- Allow playback to restart



\## Transition Cancellation



A transition may be cancelled by:



\- Reset

\- Timeline seek

\- New execution

\- Trace replacement

\- Component unmount

\- Fatal visualization error



Cancellation must:



\- Stop pending animation callbacks

\- Prevent outdated state commits

\- Clear temporary visual emphasis

\- Restore or apply a valid stable state

\- Notify the playback controller



\## Reduced-Motion Mode



When reduced motion is enabled:



\- Do not use large travel animations.

\- Avoid unnecessary scaling or rotation.

\- Use opacity, outline and instant state transitions.

\- Preserve source highlighting.

\- Preserve old/new value communication.

\- Keep timeline changes understandable.

\- Maintain the same event and state order.



Reduced motion is a first-class mode, not an afterthought.



\## Keyboard Interaction



Planned keyboard actions:



\- Run

\- Play or pause

\- Previous step

\- Next step

\- First step

\- Last step

\- Reset

\- Focus editor

\- Focus visualization

\- Focus timeline



Keyboard shortcuts must not interfere with Monaco Editor typing.



\## Responsive Behaviour



\### Desktop



\- Editor and visualization appear side by side.

\- Panels may be resized.

\- Timeline uses the full available width.

\- Variable, console and call-stack panels remain accessible.



\### Tablet



\- Split view remains where space permits.

\- Secondary panels may collapse into tabs.

\- Playback controls remain visible.



\### Mobile



\- Editor and visualization use switchable views.

\- Panels use tabs or bottom sheets.

\- Playback controls become compact.

\- Timeline supports touch interaction.

\- Important state remains readable without horizontal overflow.



Responsive layouts must not hide essential execution information permanently.



\## Performance Rules



Animations should primarily use:



\- Transform

\- Opacity

\- Controlled layout transitions



Avoid:



\- Animating large expensive shadows repeatedly

\- Re-rendering the complete trace

\- Re-rendering Monaco for every minor visual update

\- Rendering every element of huge collections

\- Creating unbounded animation queues



Performance strategies:



\- Component memoization where measured

\- Bounded visualized collection sizes

\- Virtualized long timelines

\- Cached reconstructed states

\- Stable entity keys

\- Animation cancellation

\- Reduced updates for hidden panels



Optimization should follow measurement rather than guesswork.



\## Visual Fallback



If an animation fails:



1\. Log the visualization error safely.

2\. Cancel the failed transition.

3\. Render the correct after state immediately.

4\. Keep the timeline cursor valid.

5\. Inform the user only when the failure affects understanding.

6\. Do not corrupt reconstructed state.



Correctness is more important than animation completion.



\## Testing Requirements



\### Visual Intent Tests



Verify event-to-intent mapping for:



\- Variables

\- Expressions

\- Conditions

\- Loops

\- Functions

\- Arrays

\- Stack

\- Memory

\- SQL operations

\- Output

\- Errors



\### Transition Tests



Verify:



\- Correct before state

\- Correct after state

\- Required target exists

\- Transition settles

\- Cancellation works

\- Reduced-motion fallback works

\- High-speed playback works



\### Synchronization Tests



At every tested step, verify that:



\- Source location matches event

\- Event matches state

\- State matches visualizer

\- Console matches state

\- Call stack matches state

\- Timeline matches cursor



\### Accessibility Tests



Verify:



\- Keyboard navigation

\- Focus visibility

\- Reduced motion

\- Colour contrast

\- Non-colour status indicators

\- Accessible control labels

\- Important event announcements



\### Responsive Tests



Verify:



\- Desktop layout

\- Tablet layout

\- Mobile layout

\- Timeline usability

\- Monaco resizing

\- Panel switching

\- Playback controls



\## Acceptance Criteria



The visual-event architecture is accepted only when:



1\. Visualizers consume normalized events rather than language syntax.

2\. Every required animation corresponds to an execution event.

3\. Source highlighting matches the active event.

4\. Timeline advancement waits for required transitions.

5\. Seeking displays the correct reconstructed state.

6\. Reset cancels active transitions safely.

7\. Reduced-motion mode preserves meaning.

8\. High playback speed never skips state changes.

9\. Java, Python, C and JavaScript reuse common visualizers.

10\. SQL uses specialized relation visualizers without breaking the common

&#x20;   event architecture.

11\. C pointers use stable logical allocation identities.

12\. Animation failure falls back to the correct state.

13\. The interface remains usable on desktop, tablet and mobile.

14\. UI motion communicates cause and effect rather than decoration.

