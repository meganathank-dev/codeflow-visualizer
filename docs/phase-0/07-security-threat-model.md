\# CodeFlow Visualizer — Security Threat Model



\## Document Information



\- Phase: Phase 0 — Technical Research and Architecture

\- Status: Proposed security architecture

\- Application language: JavaScript

\- Initial languages: Java, Python, SQL, C and JavaScript

\- Security priority: Critical

\- Related document: 03-system-architecture.md



\## Purpose



CodeFlow Visualizer intentionally accepts and executes untrusted user code.



This creates a much higher security risk than an ordinary MERN application.



Security is therefore part of the core architecture and must not be postponed

until deployment.



The primary security rule is:



\*\*User code must never execute directly inside the Express API process or with

unrestricted access to the host system.\*\*



\## Security Objectives



CodeFlow must protect:



\- Host operating system

\- Express API

\- Execution service

\- MongoDB

\- Other users

\- Other execution jobs

\- Source code

\- Saved projects

\- User identity

\- Application secrets

\- Infrastructure credentials

\- Logs

\- Runtime images

\- Network resources

\- Service availability



\## Trust Boundaries



\### Boundary 1 — Browser to Public API



The browser is untrusted.



The API must not trust:



\- Language identifiers

\- Source code

\- SQL

\- Standard input

\- Dataset definitions

\- Requested limits

\- File names

\- Trace IDs

\- Project IDs

\- Client-provided roles

\- Client-provided execution status



\### Boundary 2 — Public API to Execution Service



The public API may submit validated jobs.



The execution service must still validate:



\- Internal request structure

\- Language

\- Source size

\- Input size

\- Dataset size

\- Requested runtime

\- Job identity

\- Allowed limits



The execution service must not assume that every internal request is safe.



\### Boundary 3 — Execution Service to Sandbox



The sandbox contains hostile code.



Anything produced by the sandbox must be treated as untrusted:



\- Standard output

\- Standard error

\- Debugger output

\- Compiler diagnostics

\- Trace messages

\- File names

\- Runtime values

\- Error messages

\- Exit codes

\- SQL results



\### Boundary 4 — Execution Trace to Frontend



A trace must be validated before entering the browser state.



The frontend must safely render:



\- Source code

\- Output

\- Errors

\- Variable names

\- String values

\- SQL values

\- Runtime type names



None of these values should be inserted as unsafe HTML.



\### Boundary 5 — Application to MongoDB



MongoDB is introduced later for persistent user features.



Execution sandboxes must never receive MongoDB credentials or network access to

MongoDB.



\## Threat Actors



Possible threat actors include:



\- Accidental beginner mistakes

\- Users creating infinite loops

\- Users producing excessive output

\- Users allocating excessive memory

\- Users attempting filesystem access

\- Users attempting network access

\- Users attempting process creation

\- Users executing intentionally malicious native C code

\- Users submitting malicious SQL

\- Users attempting container escape

\- Users attempting denial of service

\- Users attempting to access other users’ code

\- Users attempting to inject content into logs or the UI

\- Compromised dependencies or runtime images



The architecture must handle both accidental and intentional abuse.



\## Primary Threat Categories



\### Arbitrary Code Execution



Risk:



User code could execute with the permissions of the API or host.



Mitigation:



\- Never use the Express process as a runtime.

\- Use a separate execution service.

\- Use disposable sandboxes.

\- Run as a non-root user.

\- Remove unnecessary capabilities.

\- Disable host access.

\- Destroy the environment after execution.



\### Denial of Service



Risk:



A program may consume:



\- CPU

\- Memory

\- Processes

\- Disk

\- Output bandwidth

\- Trace storage

\- Queue capacity

\- Database resources



Mitigation:



\- CPU limits

\- Memory limits

\- PID limits

\- Execution timeout

\- Compilation timeout

\- Output limit

\- Trace-event limit

\- Source-size limit

\- Input-size limit

\- SQL row limit

\- Bounded queue

\- Bounded concurrency

\- Per-user rate limits later



\### Sandbox Escape



Risk:



Hostile code may exploit the operating system, runtime, compiler, debugger or

container engine.



Mitigation:



\- Hardened runtime images

\- Minimal installed software

\- Pinned image versions

\- Non-root execution

\- Dropped capabilities

\- Seccomp/AppArmor where available

\- No host socket mounts

\- No Docker socket access from the public API

\- Additional isolation for production

\- Dedicated runner hosts

\- Security updates

\- Runtime-image scanning



\### Cross-Job Access



Risk:



One execution may read files, processes or data belonging to another job.



Mitigation:



\- Unique sandbox per run

\- Unique temporary workspace

\- No reused writable filesystem

\- Separate process namespace

\- Separate user namespace where available

\- No shared writable volumes

\- Cleanup verification

\- Random internal job identifiers



\### Network Abuse



Risk:



User code may:



\- Scan internal services

\- Access metadata endpoints

\- Send spam

\- download payloads

\- attack external systems

\- access MongoDB or private APIs



Mitigation:



\- Disable sandbox network access.

\- Do not expose internal DNS.

\- Do not provide cloud credentials.

\- Block metadata-service access.

\- Keep the runner on a restricted network.

\- Use an explicit deny-by-default network policy.



\### Filesystem Abuse



Risk:



User code may read or modify:



\- Host files

\- Application files

\- Environment files

\- Other user code

\- Secrets

\- Runtime configuration



Mitigation:



\- Read-only root filesystem

\- Disposable writable temporary area

\- No host project-directory mount

\- No home-directory mount

\- No secret files

\- File-size limits

\- Directory restrictions

\- Cleanup after execution



\### Process Abuse



Risk:



User code may create:



\- Fork bombs

\- Child processes

\- Shells

\- Background processes

\- Debugger escapes



Mitigation:



\- PID limit

\- Process `ulimit`

\- Short execution timeout

\- Kill complete process group

\- Remove unnecessary executables

\- Restrict system calls

\- Verify that all child processes terminate



\## API Security



The Express API must enforce:



\- JSON body-size limit

\- Zod request validation

\- Supported language allowlist

\- Source-code size limit

\- Input-size limit

\- SQL dataset-size limit

\- Safe identifier validation

\- Request timeout

\- Safe error responses

\- CORS policy

\- Security headers

\- Rate limiting before public deployment

\- Authentication later

\- Authorization for saved resources later



The API must ignore client requests to increase server-controlled security

limits.



\## Execution Job Security



Every job should contain server-generated values:



\- Job ID

\- Run ID

\- Allowed language

\- Source hash

\- Effective limits

\- Runtime-image identity

\- Creation time

\- Expiration time



The client must not choose:



\- Container name

\- Host path

\- Runtime image

\- Docker arguments

\- Compiler executable path

\- Debugger executable path

\- Security profile

\- Network mode



\## Command Injection Prevention



The execution service will eventually invoke compilers and runtimes.



Security rules:



\- Do not create shell commands by concatenating user strings.

\- Use process-spawn APIs with explicit argument arrays.

\- Use server-generated filenames.

\- Do not use user input as an executable path.

\- Do not use user input as a container name.

\- Do not pass arbitrary compiler flags.

\- Do not pass arbitrary runtime flags.

\- Maintain an allowlist of fixed command templates.



User source belongs inside a controlled source file or standard input, not

inside a shell command.



\## Path Traversal Prevention



User-provided filenames must not control host paths.



Rules:



\- Generate internal filenames.

\- Remove directory separators from display-only filenames.

\- Reject `..` traversal attempts.

\- Keep workspaces inside a validated temporary root.

\- Resolve and verify paths before use.

\- Do not return host paths to users.

\- Remove workspaces after execution.



\## Sandbox Baseline



Each run should use:



\- Disposable sandbox

\- Pinned runtime image

\- Non-root runtime user

\- Read-only root filesystem

\- Writable temporary filesystem only

\- Network disabled

\- All unnecessary capabilities dropped

\- `no-new-privileges`

\- PID limit

\- CPU quota

\- Memory limit

\- Swap restriction where practical

\- File-size limit

\- Open-file limit

\- Process limit

\- Wall-clock timeout

\- Output-byte limit

\- Trace-event limit

\- Automatic forced cleanup



Exact values require Phase 0 benchmarking.



\## Runtime Image Rules



Each language should have a dedicated or carefully designed runtime image.



Images must:



\- Use pinned versions

\- Use minimal base images

\- Contain only required runtime tools

\- Run as non-root

\- Avoid package managers where unnecessary

\- Avoid shells where unnecessary

\- Avoid network clients where unnecessary

\- Exclude credentials

\- Exclude application source

\- Be reproducibly built

\- Be scanned for vulnerabilities

\- Be updated through controlled review



\## JavaScript Security



Threats include:



\- Infinite loops

\- Memory exhaustion

\- Excessive output

\- Process access

\- Filesystem access

\- Dynamic imports

\- Native addons

\- Inspector misuse

\- Prototype-related attacks against tracer code



Rules:



\- Do not use `node:vm` as the security boundary.

\- Execute JavaScript inside the isolated runtime container.

\- Do not expose `process` capabilities unnecessarily.

\- Do not allow package installation.

\- Do not allow arbitrary imports.

\- Disable external network.

\- Restrict filesystem access.

\- Capture output through bounded pipes.

\- Keep instrumentation helpers inaccessible where possible.

\- Validate trace messages outside the user runtime.



\## Python Security



Threats include:



\- `os` and system access

\- `subprocess`

\- Network modules

\- Filesystem access

\- Dynamic imports

\- Native extensions

\- Introspection of tracer internals

\- Infinite recursion

\- Excessive object creation



Rules:



\- Execute Python inside an isolated container.

\- Restrict external modules.

\- Do not rely only on removing built-ins.

\- Disable network.

\- Restrict filesystem.

\- Prevent subprocess creation through sandbox controls.

\- Bound recursion and trace depth.

\- Keep tracer communication structured and validated.

\- Do not install user packages.



Language-level restrictions are additional controls, not replacements for

operating-system isolation.



\## Java Security



Threats include:



\- Process execution

\- Filesystem access

\- Network access

\- Reflection

\- Native methods

\- Dynamic class loading

\- Excessive heap allocation

\- Excessive threads

\- Debugger-controller exposure



Rules:



\- Execute JVM inside the sandbox.

\- Compile with fixed server-controlled options.

\- Do not allow external dependencies.

\- Disable external network.

\- Restrict filesystem.

\- Apply JVM heap limits in addition to container limits.

\- Restrict thread/process counts.

\- Keep JDI communication inside the sandbox boundary.

\- Filter debugger events to user classes.

\- Do not expose debugger ports publicly.

\- Reject unsupported native and reflective behaviour where necessary.



\## C Security



C is the highest-risk initial runtime because it produces native executable

code.



Threats include:



\- Segmentation faults

\- Buffer overflows

\- Arbitrary system calls

\- Fork bombs

\- Filesystem access

\- Network access

\- Shell execution

\- Debugger abuse

\- Compiler abuse

\- Undefined behaviour

\- Memory exhaustion

\- Container escape attempts



Rules:



\- Never run C binaries directly on the host.

\- Compile and execute inside a disposable sandbox.

\- Use fixed compiler options.

\- Do not allow arbitrary linker options.

\- Do not allow external libraries.

\- Run GDB inside the same isolated boundary.

\- Apply PID, CPU, memory and time limits.

\- Disable network.

\- Restrict filesystem.

\- Use sanitizers where appropriate.

\- Stop at serious undefined behaviour.

\- Kill the complete process group after timeout.

\- Treat every native-process result as untrusted.



Sanitizers improve detection but do not create a security boundary.



\## SQL Security



Threats include:



\- Access to unintended databases

\- Destructive statements

\- File attachment

\- Extension loading

\- Long-running queries

\- Very large joins

\- Recursive resource exhaustion

\- Excessive result sets

\- Malicious dataset definitions

\- SQL parser inconsistencies



Rules:



\- Use a disposable temporary database.

\- Never connect user SQL to production databases.

\- Use a documented SQL dialect.

\- Parse and validate the supported subset.

\- Apply a statement allowlist.

\- Use a database authorizer where supported.

\- Disable extension loading.

\- Prevent attachment of arbitrary databases.

\- Enforce query timeout.

\- Enforce database-size limit.

\- Enforce row and result-size limits.

\- Restrict dataset schema and data size.

\- Destroy the database after execution.



AST validation and database authorization should both be used.



Neither control should be treated as sufficient alone.



\## Debugger Security



Java, C and JavaScript tracing may use debugger protocols.



Risks:



\- Debugger port exposed outside the sandbox

\- Debugger gaining broad process access

\- Debugger attaching to host processes

\- Untrusted debugger output

\- Debugger commands influenced by user input



Rules:



\- Keep debugger and target inside the same execution boundary where practical.

\- Do not publish debugger ports.

\- Do not allow arbitrary debugger commands.

\- Use fixed command sequences.

\- Limit debugger output.

\- Restrict target process visibility.

\- Validate parsed debugger messages.

\- Terminate both debugger and target during cleanup.



\## Trace Security



The trace is untrusted until validated.



Potential threats:



\- Oversized trace

\- Invalid event order

\- Duplicate event IDs

\- Missing entity references

\- Malicious strings

\- Prototype-pollution keys

\- Cyclic serialized data

\- Excessive nesting

\- Invalid source locations

\- Unexpected event types



Mitigation:



\- Zod validation

\- Event-count limit

\- Trace-byte limit

\- Nesting-depth limit

\- String-length limit

\- Entity-count limit

\- Sequence validation

\- Reference validation

\- Safe object creation

\- Rejection of dangerous property names where relevant

\- Version compatibility validation



\## Frontend Rendering Security



User-controlled content includes:



\- Source code

\- Console output

\- Error messages

\- Variable names

\- String values

\- SQL table values

\- Compiler diagnostics



Rules:



\- Render content as text.

\- Do not insert it through unsafe HTML.

\- Do not execute returned source.

\- Do not interpret console output as markup.

\- Escape displayed values.

\- Limit displayed lengths.

\- Use safe downloadable formats later.

\- Keep Monaco language features restricted to editing.



\## Log Security



Logs must not become a source-code or secret leak.



Rules:



\- Do not log complete source code by default.

\- Do not log complete standard input.

\- Do not log credentials or tokens.

\- Do not log MongoDB connection strings.

\- Sanitize control characters.

\- Use structured logs.

\- Record job IDs rather than personal data where possible.

\- Apply log-size and retention limits.

\- Separate security logs from user-visible errors.



\## Secret Management



Sandboxes must never receive:



\- MongoDB credentials

\- JWT secrets

\- AI provider keys

\- Cloud credentials

\- Deployment tokens

\- Email credentials

\- GitHub tokens

\- Internal API secrets



The execution service should receive only the minimum configuration necessary

to perform sandbox orchestration.



\## Output Flooding



User code may produce unlimited output.



Mitigation:



\- Count output bytes while reading.

\- Stop retaining output after the limit.

\- Terminate execution when policy requires it.

\- Emit `EXECUTION\_LIMIT\_REACHED`.

\- Mark output as truncated.

\- Preserve only the bounded output.

\- Do not wait for the process to finish writing unlimited data.



Both standard output and standard error require limits.



\## Trace Flooding



A small program may generate a very large trace through loops.



Mitigation:



\- Count events during capture.

\- Stop at the configured event limit.

\- Terminate the target safely.

\- Preserve the last trustworthy event.

\- Mark the trace as truncated.

\- Explain that the trace limit was reached.



\## Infinite Loop Protection



Timeout alone is not sufficient because trace generation can exhaust memory

before the timeout.



Use:



\- Wall-clock timeout

\- CPU quota

\- Trace-event limit

\- Output limit

\- Memory limit

\- Optional loop-iteration policy for educational modes



\## Compilation Security



Java and C require compilation.



Rules:



\- Use fixed compiler executable paths.

\- Use fixed compiler arguments.

\- Use server-generated source paths.

\- Limit compilation time.

\- Limit compiler memory.

\- Limit compiler output.

\- Compile inside the sandbox.

\- Remove artifacts after the run.

\- Do not allow arbitrary compiler plugins.

\- Do not allow arbitrary linker scripts.

\- Do not cache untrusted binaries without a secure design.



\## Queue Security



The execution queue must enforce:



\- Maximum queued jobs

\- Maximum concurrent jobs

\- Maximum jobs per source/client later

\- Job expiration

\- Cancellation

\- Timeout

\- Cleanup after crash

\- Queue-full rejection



The initial bounded in-memory queue is acceptable for local MVP development.



A durable queue may be added later for production scaling.



\## Cancellation and Cleanup



Every run must have a cleanup path for:



\- Successful completion

\- Compilation failure

\- Runtime failure

\- Timeout

\- User cancellation

\- Trace limit

\- Output limit

\- Execution-service restart

\- Sandbox startup failure



Cleanup should:



\- Kill the complete process group

\- Stop the sandbox

\- Remove temporary files

\- Remove temporary database

\- Release queue capacity

\- Close output streams

\- Close debugger sessions

\- Record cleanup failure securely



\## Development Environment



The project is being developed on Windows.



Language runtimes should eventually execute inside Linux-based containers to

provide consistent behaviour.



Local development rules:



\- Do not test hostile code directly on Windows.

\- Do not run generated C executables directly on the host.

\- Do not expose debugger ports publicly.

\- Do not mount personal directories into execution containers.

\- Do not place secrets in runtime images.

\- Use test programs created specifically for validation.



\## Production Isolation



Strict Docker containers are useful for local development and initial

validation.



For a public multi-user production service, plain Docker must not be considered

the only security boundary.



Production research should compare:



\- gVisor

\- Kata Containers

\- Firecracker microVMs

\- Dedicated runner virtual machines

\- Ephemeral runner hosts



Public API servers and execution runners should use separate infrastructure

security boundaries.



\## Dependency Security



Every dependency introduces supply-chain risk.



Rules:



\- Add only required dependencies.

\- Review package ownership and maintenance.

\- Review package licence.

\- Use lockfiles.

\- Avoid unmaintained packages.

\- Run dependency audits.

\- Pin runtime container images.

\- Review automated dependency updates.

\- Remove unused dependencies.

\- Do not execute untrusted install scripts unnecessarily.



\## Authentication Security



Authentication is not part of the initial core execution MVP.



When introduced later, it should include:



\- Password hashing

\- Secure token handling

\- Short-lived access tokens

\- Refresh-token strategy

\- Role-based authorization

\- Account-rate limits

\- Email-verification policy

\- Password-reset security

\- Session revocation

\- Audit logging



Authentication must not delay proving the core execution architecture.



\## Security Error Responses



User-visible security errors should be clear but not reveal infrastructure.



Examples:



\- Source code exceeds the allowed size.

\- Execution exceeded the time limit.

\- Output exceeded the allowed size.

\- This operation is not supported.

\- Network access is disabled.

\- The SQL statement is not permitted.

\- Execution was stopped after a memory error.

\- The execution service is temporarily unavailable.



Do not expose:



\- Host paths

\- Container IDs

\- Internal IP addresses

\- Stack traces from infrastructure code

\- Secret values

\- Docker configuration

\- Database credentials



\## Security Testing Categories



\### API Abuse Tests



\- Oversized JSON

\- Unsupported language

\- Invalid identifiers

\- Excessively large source

\- Excessively large input

\- Malformed dataset

\- Repeated execution requests



\### Runtime Abuse Tests



\- Infinite loop

\- Infinite recursion

\- Excessive allocation

\- Excessive output

\- Process spawning

\- Filesystem access

\- Network access

\- Background process

\- Runtime crash



\### C-Specific Tests



\- Buffer overflow

\- Out-of-bounds access

\- Use after free

\- Double free

\- Null dereference

\- Segmentation fault

\- Fork attempt

\- Shell execution attempt



\### SQL-Specific Tests



\- Disallowed statement

\- Database attachment attempt

\- Extension-loading attempt

\- Very large join

\- Recursive query attempt

\- Excessive result set

\- Invalid syntax

\- Query timeout



\### Trace Tests



\- Invalid event order

\- Duplicate IDs

\- Missing references

\- Oversized values

\- Excessive nesting

\- Invalid source locations

\- Unsupported schema version

\- Malicious rendered strings



\### Cleanup Tests



\- Cleanup after success

\- Cleanup after compile error

\- Cleanup after runtime error

\- Cleanup after timeout

\- Cleanup after cancellation

\- Cleanup after runner failure



\## Security Acceptance Criteria



The execution architecture is not approved for public use until:



1\. User code never executes in Express.

2\. Every language runs in a disposable isolated environment.

3\. External network access is blocked.

4\. Host filesystem access is blocked.

5\. CPU and memory limits are enforced.

6\. Execution timeout is enforced.

7\. Output limits are enforced.

8\. Trace limits are enforced.

9\. Process limits are enforced.

10\. Compilation occurs inside isolation.

11\. C native execution remains isolated.

12\. SQL cannot access arbitrary databases.

13\. Debugger ports are not public.

14\. Sandbox output is treated as untrusted.

15\. Trace validation occurs before frontend use.

16\. Temporary resources are removed after every result.

17\. Secrets are absent from sandboxes.

18\. Abuse tests pass.

19\. Security limitations are documented.

20\. Production isolation receives a separate security review.



\## Security Decision Status



Phase 0 approves the security boundaries conceptually.



It does not yet approve a final production sandbox technology.



The following require technical proof of concept:



\- Docker resource enforcement on the development system

\- Debugger operation inside restricted containers

\- GDB requirements for C tracing

\- JDI communication inside Java isolation

\- V8 Inspector communication inside JavaScript isolation

\- Python tracer isolation

\- SQLite authorizer and interruption support

\- Complete process-group termination

\- Temporary-resource cleanup

\- Production hardened-runtime compatibility

