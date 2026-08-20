"""
Controlled Python tracing proof of concept.

This program is for Phase 0 technical validation only.
It must not be treated as a secure sandbox for arbitrary code.
"""

import json
import math
import os
import sys
import types
from pathlib import Path


TRACE_SCHEMA_VERSION = "0.1.0"
TRACE_DOMAIN = "PROGRAM_EXECUTION"
LANGUAGE = "python"


def json_safe(value, depth=0, max_depth=20):
    if depth > max_depth:
        return {
            "$type": type(value).__name__,
            "display": "<maximum depth reached>",
        }

    if value is None:
        return None

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if math.isfinite(value):
            return value

        return {
            "$type": "float",
            "display": repr(value),
        }

    if isinstance(value, str):
        return value

    if isinstance(value, list):
        return [
            json_safe(item, depth + 1, max_depth)
            for item in value
        ]

    if isinstance(value, tuple):
        return {
            "$type": "tuple",
            "items": [
                json_safe(item, depth + 1, max_depth)
                for item in value
            ],
        }

    if isinstance(value, set):
        items = [
            json_safe(item, depth + 1, max_depth)
            for item in value
        ]

        return {
            "$type": "set",
            "items": sorted(
                items,
                key=lambda item: json.dumps(
                    item,
                    sort_keys=True,
                ),
            ),
        }

    if isinstance(value, dict):
        return {
            str(key): json_safe(
                child_value,
                depth + 1,
                max_depth,
            )
            for key, child_value in value.items()
        }

    return {
        "$type": type(value).__name__,
        "display": repr(value),
    }


def get_value_type(value):
    if value is None:
        return "null"

    if isinstance(value, bool):
        return "boolean"

    if isinstance(value, int):
        return "integer"

    if isinstance(value, float):
        return "float"

    if isinstance(value, str):
        return "string"

    if isinstance(value, list):
        return "array"

    if isinstance(value, tuple):
        return "tuple"

    if isinstance(value, dict):
        return "dictionary"

    if isinstance(value, set):
        return "set"

    return type(value).__name__


def should_skip_variable(name, value):
    if name.startswith("__"):
        return True

    if callable(value):
        return True

    if isinstance(value, types.ModuleType):
        return True

    return False


def snapshot_locals(local_variables):
    snapshot = {}

    for name, value in local_variables.items():
        if should_skip_variable(name, value):
            continue

        snapshot[name] = {
            "value": json_safe(value),
            "valueType": get_value_type(value),
        }

    return snapshot


def find_changed_index(previous_values, new_values):
    shared_length = min(
        len(previous_values),
        len(new_values),
    )

    for index in range(shared_length):
        if previous_values[index] != new_values[index]:
            return index

    if len(previous_values) != len(new_values):
        return shared_length

    return None


class TraceRecorder:
    def __init__(self, trace_id, source_file):
        self.trace_id = trace_id
        self.source_file = source_file
        self.events = []
        self.closed = False
        self.last_line = None

    def record(
        self,
        event_type,
        line=None,
        payload=None,
        state_delta=None,
    ):
        if self.closed:
            raise RuntimeError(
                "Cannot record after PROGRAM_END."
            )

        sequence = len(self.events)

        if line is not None:
            self.last_line = line

        event = {
            "schemaVersion": TRACE_SCHEMA_VERSION,
            "traceId": self.trace_id,
            "eventId": (
                f"{self.trace_id}:event:"
                f"{sequence:04d}"
            ),
            "sequence": sequence,
            "domain": TRACE_DOMAIN,
            "language": LANGUAGE,
            "type": event_type,
            "source": {
                "file": self.source_file,
                "line": line,
                "column": None,
                "endLine": None,
                "endColumn": None,
            },
            "payload": payload or {},
            "stateDelta": state_delta or {},
        }

        self.events.append(event)

        if event_type == "PROGRAM_END":
            self.closed = True

        return event

    def start(self):
        self.record(
            "PROGRAM_START",
            line=1,
            payload={
                "message": (
                    "Controlled Python execution started."
                )
            },
        )

    def end(self, status, output):
        self.record(
            "PROGRAM_END",
            line=self.last_line,
            payload={
                "status": status,
                "output": output,
            },
        )

    def get_trace(self):
        return {
            "schemaVersion": TRACE_SCHEMA_VERSION,
            "traceId": self.trace_id,
            "domain": TRACE_DOMAIN,
            "language": LANGUAGE,
            "sourceFile": self.source_file,
            "eventCount": len(self.events),
            "events": self.events,
        }


class PythonTraceAdapter:
    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.base_directory = Path(__file__).resolve().parent

        try:
            self.source_file = self.target_path.relative_to(
                self.base_directory
            ).as_posix()
        except ValueError:
            self.source_file = self.target_path.name

        self.recorder = TraceRecorder(
            trace_id="python-basic-flow-001",
            source_file=self.source_file,
        )

        self.frame_states = {}
        self.output_parts = []

    def is_target_frame(self, frame):
        return (
            Path(frame.f_code.co_filename).resolve()
            == self.target_path
        )

    def emit_variable_declare(
        self,
        name,
        variable,
        line,
    ):
        value = variable["value"]
        value_type = variable["valueType"]

        if value_type == "array":
            self.recorder.record(
                "ARRAY_CREATE",
                line=line,
                payload={
                    "name": name,
                    "values": value,
                    "length": len(value),
                },
            )

        self.recorder.record(
            "VARIABLE_DECLARE",
            line=line,
            payload={
                "name": name,
                "value": value,
                "valueType": value_type,
            },
        )

    def emit_variable_update(
        self,
        name,
        previous_variable,
        new_variable,
        line,
    ):
        previous_value = previous_variable["value"]
        new_value = new_variable["value"]
        value_type = new_variable["valueType"]

        if (
            previous_variable["valueType"] == "array"
            and value_type == "array"
        ):
            changed_index = find_changed_index(
                previous_value,
                new_value,
            )

            if changed_index is not None:
                old_item = (
                    previous_value[changed_index]
                    if changed_index
                    < len(previous_value)
                    else None
                )

                new_item = (
                    new_value[changed_index]
                    if changed_index < len(new_value)
                    else None
                )

                self.recorder.record(
                    "ARRAY_UPDATE",
                    line=line,
                    payload={
                        "arrayName": name,
                        "index": changed_index,
                        "previousValue": old_item,
                        "newValue": new_item,
                        "values": new_value,
                    },
                )

        self.recorder.record(
            "VARIABLE_UPDATE",
            line=line,
            payload={
                "name": name,
                "previousValue": previous_value,
                "newValue": new_value,
                "valueType": value_type,
            },
        )

    def flush_variable_changes(self, frame, line):
        frame_id = id(frame)
        frame_state = self.frame_states.get(frame_id)

        if frame_state is None:
            return

        previous_locals = frame_state["locals"]
        current_locals = snapshot_locals(
            frame.f_locals
        )

        for name, current_variable in (
            current_locals.items()
        ):
            previous_variable = previous_locals.get(name)

            if previous_variable is None:
                self.emit_variable_declare(
                    name,
                    current_variable,
                    line,
                )
                continue

            if (
                previous_variable["value"]
                != current_variable["value"]
                or previous_variable["valueType"]
                != current_variable["valueType"]
            ):
                self.emit_variable_update(
                    name,
                    previous_variable,
                    current_variable,
                    line,
                )

        frame_state["locals"] = current_locals

    def trace_function(self, frame, event, argument):
        if not self.is_target_frame(frame):
            return None

        frame_id = id(frame)
        function_name = frame.f_code.co_name

        if event == "call":
            current_locals = snapshot_locals(
                frame.f_locals
            )

            self.frame_states[frame_id] = {
                "locals": current_locals,
                "lastLine": None,
            }

            if function_name != "<module>":
                caller_line = (
                    frame.f_back.f_lineno
                    if frame.f_back is not None
                    else frame.f_code.co_firstlineno
                )

                self.recorder.record(
                    "FUNCTION_CALL",
                    line=caller_line,
                    payload={
                        "functionName": function_name,
                        "arguments": [
                            variable["value"]
                            for variable
                            in current_locals.values()
                        ],
                    },
                )

                self.recorder.record(
                    "FUNCTION_ENTER",
                    line=frame.f_code.co_firstlineno,
                    payload={
                        "functionName": function_name,
                        "parameters": {
                            name: variable["value"]
                            for name, variable
                            in current_locals.items()
                        },
                    },
                )

                for name, variable in (
                    current_locals.items()
                ):
                    self.emit_variable_declare(
                        name,
                        variable,
                        frame.f_code.co_firstlineno,
                    )

            return self.trace_function

        frame_state = self.frame_states.get(frame_id)

        if frame_state is None:
            return self.trace_function

        if event == "line":
            previous_line = frame_state["lastLine"]

            if previous_line is not None:
                self.flush_variable_changes(
                    frame,
                    previous_line,
                )

            self.recorder.record(
                "STATEMENT_EXECUTE",
                line=frame.f_lineno,
                payload={
                    "functionName": function_name,
                    "statementKind": "python-line",
                },
            )

            frame_state["lastLine"] = frame.f_lineno

            return self.trace_function

        if event == "return":
            last_line = (
                frame_state["lastLine"]
                or frame.f_code.co_firstlineno
            )

            self.flush_variable_changes(
                frame,
                last_line,
            )

            if function_name != "<module>":
                self.recorder.record(
                    "FUNCTION_RETURN",
                    line=last_line,
                    payload={
                        "functionName": function_name,
                        "returnValue": json_safe(argument),
                    },
                )

            self.frame_states.pop(frame_id, None)

            return self.trace_function

        return self.trace_function

    def traced_print(
        self,
        *values,
        sep=" ",
        end="\n",
        **_ignored_options,
    ):
        caller_frame = sys._getframe(1)
        rendered_value = sep.join(
            str(value) for value in values
        )

        self.output_parts.append(
            rendered_value + end
        )

        self.recorder.record(
            "OUTPUT",
            line=caller_frame.f_lineno,
            payload={
                "stream": "stdout",
                "value": rendered_value,
                "end": end,
            },
        )

    def find_error_line(self, error):
        traceback = error.__traceback__
        error_line = self.recorder.last_line

        while traceback is not None:
            traceback_path = Path(
                traceback.tb_frame.f_code.co_filename
            ).resolve()

            if traceback_path == self.target_path:
                error_line = traceback.tb_lineno

            traceback = traceback.tb_next

        return error_line

    def run(self):
        if not self.target_path.is_file():
            raise FileNotFoundError(
                f"Python fixture not found: {self.target_path}"
            )

        source_code = self.target_path.read_text(
            encoding="utf-8"
        )

        compiled_code = compile(
            source_code,
            str(self.target_path),
            "exec",
        )

        execution_globals = {
            "__name__": "__main__",
            "__file__": str(self.target_path),
            "print": self.traced_print,
        }

        self.recorder.start()
        status = "completed"

        try:
            sys.settrace(self.trace_function)

            exec(
                compiled_code,
                execution_globals,
                execution_globals,
            )
        except Exception as error:
            status = "error"

            self.recorder.record(
                "ERROR",
                line=self.find_error_line(error),
                payload={
                    "errorType": type(error).__name__,
                    "message": str(error),
                },
            )
        finally:
            sys.settrace(None)

        output = "".join(self.output_parts)

        self.recorder.end(
            status=status,
            output=output,
        )

        return self.recorder.get_trace()


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python python-tracer.py "
            "<controlled-fixture.py>",
            file=sys.stderr,
        )
        return 1

    target_path = Path(sys.argv[1]).resolve()

    adapter = PythonTraceAdapter(target_path)
    trace = adapter.run()

    sys.stdout.write(
        json.dumps(
            trace,
            separators=(",", ":"),
            ensure_ascii=False,
        )
    )

    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
    except Exception as error:
        print(
            f"Python tracer failed: {error}",
            file=sys.stderr,
        )
        exit_code = 1

    raise SystemExit(exit_code)