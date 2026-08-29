# Phase 4 — Real Java JDI Execution

## Status

Completed.

## Objective

Integrate compiled Java execution and runtime inspection through the Java Debug
Interface while retaining the same language-neutral visualization pipeline.

## Delivered

- Java source inspection and validation.
- Temporary isolated build workspace for every execution.
- `javac` compilation with debugging information enabled.
- Java Debug Interface launcher and debugger process.
- Source-line, local-variable, array, method-entry, method-return, call-stack,
  condition, loop, output, and exception observation.
- Java values converted into trace-safe JSON representations.
- Friendly filtering of debugger/runtime implementation objects.
- Structured compilation and runtime failures with source locations.
- Process-tree termination and bounded compiler/debugger output.
- Java presentation compatibility in the shared React interface.

## Execution Flow

```text
Main.java
→ source policy
→ javac -g
→ JDI debugger
→ target JVM
→ Java adapter normalization
→ common trace and replay states
```

## Java Source Boundary

The educational runtime supports a single main class in the default package
and an approved subset of Java library imports. Filesystem, network, process,
reflection, thread, native, and system-exit access are rejected in the local
execution policy.

## Verification

The reference Java program completed with:

- `numbers = [4, 8, 12]`
- `stack = [4, 8, 12]`
- `total = 24`

Tests also verified compilation diagnostics, JDI trace ordering, method frames,
arrays and collections, Java output, error handling, state reconstruction, and
cross-language conformance.

## Requirements

- A full JDK with both `java` and `javac` available on `PATH`.
- The JDK must include the `jdk.jdi` module.

## Primary Commands

```cmd
java --version
javac --version
pnpm test:execution
pnpm test:pocs
```
