\# CodeFlow Visualizer — Project Charter



\## Document Information



\- Project: CodeFlow Visualizer

\- Document: Authoritative Project Charter

\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Approved foundation

\- Application stack: MERN with JavaScript

\- Package manager: pnpm

\- Repository structure: Monorepo



\## Project Name



CodeFlow Visualizer



\## Tagline



Run It. Trace It. See It. Understand It.



\## Product Definition



CodeFlow Visualizer is a multi-language interactive program-execution

visualization platform.



It allows users to write code, execute it safely and observe how the program

or query behaves step by step.



The platform does not show only the final output. It captures meaningful

execution events, reconstructs the state at each step and presents synchronized

visual representations, source highlighting, transitions and animations.



\## Primary Product Purpose



The primary purpose of CodeFlow Visualizer is to make normally invisible

runtime behaviour visible and understandable.



The central execution pipeline is:



Source Code

→ Safe Execution

→ Runtime Observation

→ Execution Event

→ State Change

→ Visual Representation

→ Animation or Highlight

→ Next Event



\## Initial Supported Languages



The initial product must support:



1\. Java

2\. Python

3\. SQL

4\. C

5\. JavaScript



All five languages are required before the complete initial MVP can be

declared finished.



The languages will be implemented and tested sequentially rather than

simultaneously.



Recommended implementation order:



1\. JavaScript

2\. Python

3\. Java

4\. C

5\. SQL



\## Application Development Language



The CodeFlow Visualizer web application will be developed using JavaScript.



Main application technologies:



\- React with JavaScript

\- Node.js with JavaScript

\- Express.js with JavaScript

\- MongoDB

\- Mongoose

\- Vite

\- Tailwind CSS



Application source files will use:



\- .js

\- .jsx



TypeScript will not be used.



Runtime safety and maintainability will be supported using:



\- Zod validation

\- JSDoc documentation

\- ESLint

\- Prettier

\- Automated tests

\- Versioned schemas

\- Clear module boundaries



Language-specific runtime helpers may use Java, Python or C where their native

debugging and tracing systems require them. These helpers belong to the

execution subsystem and do not change the JavaScript-based MERN architecture.



\## Core Architectural Principle



CodeFlow Visualizer must not contain a separate hard-coded visualization

system for every programming language.



Each language uses its own adapter:



\- Java Adapter

\- Python Adapter

\- C Adapter

\- JavaScript Adapter

\- SQL Adapter



The adapters convert language-specific runtime observations into standardized

execution or query events.



Shared visualizers then consume those events.



Conceptually:



Language Source

→ Language Adapter

→ Standardized Events

→ State Reconstruction

→ Visual Events

→ Shared Visualization Components



\## Execution Domains



CodeFlow supports two execution domains.



\### Program Execution



Used by:



\- Java

\- Python

\- C

\- JavaScript



This domain covers:



\- Statements

\- Variables

\- Expressions

\- Conditions

\- Branches

\- Loops

\- Functions

\- Call stack

\- Arrays and collections

\- Objects where supported

\- Input and output

\- Errors and exceptions

\- Memory and pointers where applicable



\### Query Execution



Used by:



\- SQL



This domain covers:



\- Source tables

\- Row scanning

\- Filtering

\- Projection

\- Joins

\- Grouping

\- Aggregation

\- Sorting

\- Duplicate removal

\- Result limits

\- Result generation

\- SQL errors



SQL logical visualization must not be incorrectly presented as an exact

database-engine physical execution plan.



\## Execution Source of Truth



The execution engine determines what actually happened.



The visualization layer represents the verified trace.



Future AI features may explain the verified trace, but AI must not determine

or fabricate runtime behaviour.



Execution Engine = Source of Truth



Visualization Engine = Representation of Truth



AI = Explanation Layer



\## Execution and Playback Model



The program or query executes once inside an isolated environment.



The adapter captures ordered execution events.



The frontend replays those verified events.



Playback controls navigate the captured trace without rerunning the program

for every step.



Required controls:



\- First

\- Previous

\- Play

\- Pause

\- Next

\- Last

\- Reset

\- Timeline seeking

\- Speed control



\## Security Principle



Arbitrary user code must never execute directly inside the Express API process.



The required security flow is:



Frontend

→ Express API

→ Execution Service

→ Isolated Sandbox

→ Language Runtime

→ Validated Trace

→ Frontend



The execution environment must enforce:



\- Source-code size limits

\- Input-size limits

\- CPU limits

\- Memory limits

\- Execution timeout

\- Output-size limits

\- Trace-step limits

\- Network restrictions

\- Filesystem restrictions

\- Process limits

\- Runtime error handling

\- Infinite-loop protection

\- Disposable execution environments



\## Initial MVP Visualizations



The initial MVP should include:



\- Current source-line or SQL-clause highlighting

\- Variables and primitive values

\- Selected expressions and operations

\- Conditions and selected branches

\- Loops and iteration count

\- Functions and call stack

\- Arrays or lists

\- Recognized Stack operations

\- Console input and output

\- Errors and exceptions

\- Basic C pointer and memory concepts

\- SQL relational transformations

\- Execution timeline

\- Synchronized visual transitions



\## Product Non-Goals for the First MVP



The first MVP will not attempt:



\- Complete support for every language feature

\- Asynchronous JavaScript

\- Threads or concurrent execution

\- Multi-file projects

\- External user-installed dependencies

\- Arbitrary filesystem access

\- Arbitrary network access

\- Exact CPU-instruction visualization

\- Complete C memory reconstruction

\- Every SQL dialect

\- Stored procedures and triggers

\- Exact database physical-plan reproduction

\- Authentication

\- User dashboard

\- AI features

\- Practice platform

\- Admin panel



These features may be considered after the core five-language execution

pipeline is reliable.



\## UI and UX Direction



CodeFlow Visualizer must feel like a professional developer tool.



The interface will be:



\- Dark-first

\- Modern

\- Minimal

\- Developer-focused

\- Responsive

\- Accessible

\- Keyboard-friendly

\- Visualization-focused

\- Smoothly animated



Animations must communicate execution behaviour.



Animations must not exist only for decoration.



The UI must support reduced-motion preferences.



\## Development Rules



1\. Build one tested milestone at a time.

2\. Do not generate the entire application at once.

3\. Do not move forward when the current step is failing.

4\. Keep execution separate from the API.

5\. Keep language adapters separate from visualizers.

6\. Keep the event contract language-independent where appropriate.

7\. Treat SQL as a specialized query-execution domain.

8\. Treat Stack as one visualizer, not the central architecture.

9\. Add dependencies only when they have a clear purpose.

10\. Document major architectural decisions.

11\. Test every supported language feature.

12\. Never claim that an unimplemented feature is supported.

13\. Treat security as a first-class requirement.

14\. Keep the user interface synchronized with the active trace step.

15\. Maintain JavaScript code quality using validation, documentation and tests.



\## Development Collaboration Method



The development partner will:



\- Explain architectural decisions

\- Provide exact commands

\- Provide exact file paths

\- Provide complete file contents

\- Explain important code

\- Provide verification instructions

\- Diagnose reported errors

\- Provide corrected code



The project owner will:



\- Create folders and files

\- Copy and paste the provided code

\- Install packages

\- Run commands

\- Test features

\- Report complete errors and unexpected behaviour

\- Apply corrections and verify the result



\## MVP Success Definition



The MVP is successful when a user can select Java, Python, SQL, C or

JavaScript, write supported code or queries, execute them safely and understand

their behaviour through synchronized source highlighting, state changes,

visual events, animations and timeline playback.



The most important success condition is:



The user must be able to look at the screen and understand how the code or

query is executing, not merely see its final output.

