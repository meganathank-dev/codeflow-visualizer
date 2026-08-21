"""Local-trusted Python execution worker for CodeFlow Visualizer.

This process is isolated from Express, but it is not a production security
sandbox. Do not expose it to untrusted public code execution.
"""

import ast
import json
import math
import sys
import traceback
import types


SOURCE_FILENAME = "codeflow-user-program.py"
MAXIMUM_INPUT_BYTES = 64 * 1024

FORBIDDEN_NAMES = {
    "__import__",
    "breakpoint",
    "compile",
    "delattr",
    "eval",
    "exec",
    "exit",
    "getattr",
    "globals",
    "help",
    "input",
    "locals",
    "open",
    "quit",
    "setattr",
    "vars",
}

FORBIDDEN_NODE_TYPES = (
    ast.Import,
    ast.ImportFrom,
    ast.Global,
    ast.Nonlocal,
    ast.With,
    ast.AsyncWith,
    ast.AsyncFor,
    ast.AsyncFunctionDef,
    ast.Await,
    ast.Yield,
    ast.YieldFrom,
    ast.Lambda,
    ast.ClassDef,
)


class SourcePolicyError(Exception):
    def __init__(self, message, line=None):
        super().__init__(message)
        self.line = line


class TraceLimitError(Exception):
    pass


class OutputLimitError(Exception):
    pass


def json_safe(value, depth=0, ancestors=None):
    if depth > 12:
        return {"$type": type(value).__name__, "display": "<maximum depth reached>"}

    if value is None or isinstance(value, (bool, int, str)):
        return value

    if isinstance(value, float):
        if math.isfinite(value):
            return value

        return {"$type": "float", "display": repr(value)}

    if ancestors is None:
        ancestors = set()

    if isinstance(value, (list, tuple, dict, set)):
        identity = id(value)

        if identity in ancestors:
            return {"$type": type(value).__name__, "display": "<circular reference>"}

        ancestors.add(identity)

        try:
            if isinstance(value, list):
                return [json_safe(item, depth + 1, ancestors) for item in value]

            if isinstance(value, tuple):
                return {
                    "$type": "tuple",
                    "items": [json_safe(item, depth + 1, ancestors) for item in value],
                }

            if isinstance(value, set):
                items = [json_safe(item, depth + 1, ancestors) for item in value]

                return {
                    "$type": "set",
                    "items": sorted(items, key=lambda item: json.dumps(item, sort_keys=True)),
                }

            return {
                str(key): json_safe(item, depth + 1, ancestors)
                for key, item in value.items()
            }
        finally:
            ancestors.remove(identity)

    return {"$type": type(value).__name__, "display": repr(value)}


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


def snapshot_locals(local_variables):
    snapshot = {}

    for name, value in local_variables.items():
        if name.startswith("_") or callable(value) or isinstance(value, types.ModuleType):
            continue

        snapshot[name] = {
            "value": json_safe(value),
            "valueType": get_value_type(value),
        }

    return snapshot


def validate_source_policy(tree):
    for node in ast.walk(tree):
        line = getattr(node, "lineno", None)

        if isinstance(node, FORBIDDEN_NODE_TYPES):
            raise SourcePolicyError(
                f"{type(node).__name__} is not supported in local Python execution.",
                line,
            )

        if isinstance(node, ast.Name):
            if node.id in FORBIDDEN_NAMES or node.id.startswith("__codeflow_"):
                raise SourcePolicyError(f'Access to "{node.id}" is not permitted.', line)

        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise SourcePolicyError(
                f'Access to attribute "{node.attr}" is not permitted.',
                line,
            )


class SourceInstrumenter(ast.NodeTransformer):
    def __init__(self, source):
        self.source = source

    def expression_text(self, node):
        return ast.get_source_segment(self.source, node) or ast.unparse(node)

    def hook_call(self, hook_name, arguments, original_node):
        call = ast.Call(
            func=ast.Name(id=hook_name, ctx=ast.Load()),
            args=arguments,
            keywords=[],
        )

        return ast.copy_location(call, original_node)

    def hook_statement(self, hook_name, arguments, original_node):
        statement = ast.Expr(value=self.hook_call(hook_name, arguments, original_node))
        return ast.copy_location(statement, original_node)

    def visit_If(self, node):
        original_test = node.test
        expression = self.expression_text(original_test)

        self.generic_visit(node)

        node.test = self.hook_call(
            "__codeflow_condition__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.test],
            original_test,
        )

        node.body.insert(
            0,
            self.hook_statement(
                "__codeflow_branch__",
                [ast.Constant(node.lineno), ast.Constant("if")],
                node,
            ),
        )

        if node.orelse:
            node.orelse.insert(
                0,
                self.hook_statement(
                    "__codeflow_branch__",
                    [ast.Constant(node.lineno), ast.Constant("else")],
                    node,
                ),
            )

        return node

    def visit_For(self, node):
        original_iterator = node.iter
        expression = self.expression_text(original_iterator)

        self.generic_visit(node)

        node.iter = self.hook_call(
            "__codeflow_iterate__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.iter],
            original_iterator,
        )

        return node

    def visit_While(self, node):
        original_test = node.test
        expression = self.expression_text(original_test)

        self.generic_visit(node)

        node.test = self.hook_call(
            "__codeflow_while_condition__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.test],
            original_test,
        )

        node.body.insert(
            0,
            self.hook_statement(
                "__codeflow_loop_iteration__",
                [ast.Constant(node.lineno)],
                node,
            ),
        )

        return [
            self.hook_statement(
                "__codeflow_loop_start__",
                [ast.Constant(node.lineno), ast.Constant("while")],
                node,
            ),
            node,
            self.hook_statement(
                "__codeflow_loop_end__",
                [ast.Constant(node.lineno)],
                node,
            ),
        ]

    def visit_Subscript(self, node):
        self.generic_visit(node)

        if not isinstance(node.ctx, ast.Load) or not isinstance(node.value, ast.Name):
            return node

        return self.hook_call(
            "__codeflow_array_access__",
            [
                ast.Constant(node.value.id),
                node.value,
                node.slice,
                ast.Constant(node.lineno),
            ],
            node,
        )

    def visit_Call(self, node):
        self.generic_visit(node)

        if not isinstance(node.func, ast.Attribute):
            return node

        if not isinstance(node.func.value, ast.Name):
            return node

        if node.func.attr not in {"append", "pop", "insert", "remove", "extend", "clear"}:
            return node

        rewritten = ast.Call(
            func=ast.Name(id="__codeflow_method__", ctx=ast.Load()),
            args=[
                ast.Constant(node.lineno),
                ast.Constant(node.func.value.id),
                node.func.value,
                ast.Constant(node.func.attr),
                *node.args,
            ],
            keywords=node.keywords,
        )

        return ast.copy_location(rewritten, node)


class PythonExecutionTracer:
    def __init__(self, maximum_events, maximum_output_bytes):
        self.maximum_events = maximum_events
        self.maximum_output_bytes = maximum_output_bytes
        self.events = []
        self.frame_states = {}
        self.loop_iterations = {}
        self.output_bytes = 0
        self.frame_number = 0
        self.last_line = 1

    def record(self, event_type, line, payload=None, scope_id=None):
        if len(self.events) >= self.maximum_events - 2:
            raise TraceLimitError(
                f"Python execution exceeded the maximum of {self.maximum_events} events."
            )

        normalized_line = line if isinstance(line, int) and line > 0 else self.last_line
        self.last_line = normalized_line

        self.events.append({
            "type": event_type,
            "line": normalized_line,
            "scopeId": scope_id,
            "payload": json_safe(payload or {}),
        })

    def caller_scope(self):
        frame = sys._getframe(1)

        while frame is not None:
            if frame.f_code.co_filename == SOURCE_FILENAME:
                return self.frame_states.get(id(frame), {}).get("scopeId")

            frame = frame.f_back

        return None

    def declare_variable(self, name, variable, line, scope_id):
        value = variable["value"]

        if variable["valueType"] == "array":
            self.record(
                "ARRAY_CREATE",
                line,
                {"name": name, "arrayName": name, "values": value, "length": len(value)},
                scope_id,
            )

        self.record(
            "VARIABLE_DECLARE",
            line,
            {"name": name, "value": value, "valueType": variable["valueType"]},
            scope_id,
        )

        if variable["valueType"] == "array" and "stack" in name.lower():
            self.record("STACK_CREATE", line, {"name": name, "values": value}, scope_id)

        if variable["valueType"] == "array" and "queue" in name.lower():
            self.record("QUEUE_CREATE", line, {"name": name, "values": value}, scope_id)

    def update_variable(self, name, previous, current, line, scope_id):
        previous_value = previous["value"]
        new_value = current["value"]

        if previous["valueType"] == "array" and current["valueType"] == "array":
            if len(previous_value) == len(new_value):
                for index, (old_item, new_item) in enumerate(zip(previous_value, new_value)):
                    if old_item != new_item:
                        self.record(
                            "ARRAY_UPDATE",
                            line,
                            {
                                "name": name,
                                "arrayName": name,
                                "index": index,
                                "previousValue": old_item,
                                "value": new_item,
                                "newValue": new_item,
                                "values": new_value,
                            },
                            scope_id,
                        )

        self.record(
            "VARIABLE_UPDATE",
            line,
            {
                "name": name,
                "previousValue": previous_value,
                "value": new_value,
                "newValue": new_value,
                "valueType": current["valueType"],
            },
            scope_id,
        )

    def flush_variable_changes(self, frame, line):
        frame_state = self.frame_states.get(id(frame))

        if frame_state is None:
            return

        previous_locals = frame_state["locals"]
        current_locals = snapshot_locals(frame.f_locals)
        scope_id = frame_state["scopeId"]

        for name, current_variable in current_locals.items():
            previous_variable = previous_locals.get(name)

            if previous_variable is None:
                self.declare_variable(name, current_variable, line, scope_id)
            elif previous_variable != current_variable:
                self.update_variable(name, previous_variable, current_variable, line, scope_id)

        frame_state["locals"] = current_locals

    def trace_function(self, frame, event, argument):
        if frame.f_code.co_filename != SOURCE_FILENAME:
            return None

        frame_id = id(frame)
        function_name = frame.f_code.co_name

        if event == "call":
            current_locals = snapshot_locals(frame.f_locals)
            scope_id = None

            if function_name != "<module>":
                self.frame_number += 1
                scope_id = f"{function_name}:{self.frame_number}"

            self.frame_states[frame_id] = {
                "locals": current_locals,
                "lastLine": None,
                "scopeId": scope_id,
            }

            if function_name != "<module>":
                caller_line = frame.f_back.f_lineno if frame.f_back else frame.f_code.co_firstlineno

                self.record(
                    "FUNCTION_CALL",
                    caller_line,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "arguments": [item["value"] for item in current_locals.values()],
                    },
                    self.frame_states.get(id(frame.f_back), {}).get("scopeId"),
                )

                parameters = {
                    name: item["value"]
                    for name, item in current_locals.items()
                }

                self.record(
                    "FUNCTION_ENTER",
                    frame.f_code.co_firstlineno,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "frameId": scope_id,
                        "parameters": parameters,
                    },
                    scope_id,
                )

                for name, variable in current_locals.items():
                    self.declare_variable(name, variable, frame.f_code.co_firstlineno, scope_id)

            return self.trace_function

        frame_state = self.frame_states.get(frame_id)

        if frame_state is None:
            return self.trace_function

        scope_id = frame_state["scopeId"]

        if event == "line":
            previous_line = frame_state["lastLine"]

            if previous_line is not None:
                self.flush_variable_changes(frame, previous_line)

            self.record(
                "STATEMENT_EXECUTE",
                frame.f_lineno,
                {"functionName": function_name, "statementKind": "python-line"},
                scope_id,
            )

            frame_state["lastLine"] = frame.f_lineno
            return self.trace_function

        if event == "return":
            last_line = frame_state["lastLine"] or frame.f_code.co_firstlineno
            self.flush_variable_changes(frame, last_line)

            if function_name != "<module>":
                self.record(
                    "FUNCTION_RETURN",
                    last_line,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "value": json_safe(argument),
                        "returnValue": json_safe(argument),
                    },
                    scope_id,
                )

            self.frame_states.pop(frame_id, None)

        return self.trace_function

    def trace_condition(self, line, expression, result):
        self.record(
            "CONDITION_EVALUATE",
            line,
            {"expression": expression, "result": bool(result)},
            self.caller_scope(),
        )

        return result

    def trace_branch(self, line, branch):
        self.record(
            "BRANCH_ENTER",
            line,
            {"branch": branch, "reason": f"{branch} branch selected."},
            self.caller_scope(),
        )

    def start_loop(self, line, loop_type):
        self.loop_iterations[line] = 0

        self.record(
            "LOOP_START",
            line,
            {"loopId": f"line:{line}", "loopType": loop_type},
            self.caller_scope(),
        )

    def record_loop_iteration(self, line):
        iteration = self.loop_iterations.get(line, 0) + 1
        self.loop_iterations[line] = iteration

        self.record(
            "LOOP_ITERATION",
            line,
            {"loopId": f"line:{line}", "iteration": iteration},
            self.caller_scope(),
        )

    def end_loop(self, line):
        iterations = self.loop_iterations.pop(line, 0)

        self.record(
            "LOOP_END",
            line,
            {"loopId": f"line:{line}", "iterations": iterations},
            self.caller_scope(),
        )

    def trace_iterator(self, line, expression, iterable):
        self.start_loop(line, "for")

        for item in iterable:
            self.record(
                "LOOP_CONDITION",
                line,
                {"loopId": f"line:{line}", "expression": expression, "result": True},
                self.caller_scope(),
            )

            self.record_loop_iteration(line)
            yield item

        self.record(
            "LOOP_CONDITION",
            line,
            {"loopId": f"line:{line}", "expression": expression, "result": False},
            self.caller_scope(),
        )

        self.end_loop(line)

    def trace_while_condition(self, line, expression, result):
        self.record(
            "LOOP_CONDITION",
            line,
            {"loopId": f"line:{line}", "expression": expression, "result": bool(result)},
            self.caller_scope(),
        )

        return result

    def trace_array_access(self, name, collection, index, line):
        value = collection[index]

        if isinstance(collection, list):
            self.record(
                "ARRAY_ACCESS",
                line,
                {
                    "name": name,
                    "arrayName": name,
                    "index": json_safe(index),
                    "value": json_safe(value),
                },
                self.caller_scope(),
            )

            if "queue" in name.lower() and index == 0:
                self.record(
                    "QUEUE_PEEK",
                    line,
                    {"name": name, "value": json_safe(value), "values": json_safe(collection)},
                    self.caller_scope(),
                )

        return value

    def trace_method(self, line, name, collection, method_name, *args, **kwargs):
        method = getattr(collection, method_name)

        if not isinstance(collection, list):
            return method(*args, **kwargs)

        before = json_safe(collection)
        result = method(*args, **kwargs)
        after = json_safe(collection)
        scope_id = self.caller_scope()

        if len(after) > len(before):
            if method_name == "insert":
                indexes = [max(0, min(int(args[0]), len(after) - 1))]
            else:
                indexes = list(range(len(before), len(after)))

            for index in indexes:
                value = after[index]

                self.record(
                    "ARRAY_INSERT",
                    line,
                    {"name": name, "arrayName": name, "index": index, "value": value},
                    scope_id,
                )

                if "stack" in name.lower():
                    self.record("STACK_PUSH", line, {"name": name, "value": value}, scope_id)

                if "queue" in name.lower():
                    self.record("QUEUE_ENQUEUE", line, {"name": name, "value": value}, scope_id)

        elif len(after) < len(before):
            if method_name == "pop":
                index = int(args[0]) if args else len(before) - 1

                if index < 0:
                    index += len(before)
            elif method_name == "remove":
                index = before.index(json_safe(args[0]))
            else:
                index = 0

            removed = before[index]

            self.record(
                "ARRAY_DELETE",
                line,
                {"name": name, "arrayName": name, "index": index, "value": removed},
                scope_id,
            )

            if "stack" in name.lower():
                self.record("STACK_POP", line, {"name": name, "value": removed}, scope_id)

            if "queue" in name.lower() and index == 0:
                self.record("QUEUE_DEQUEUE", line, {"name": name, "value": removed}, scope_id)

        return result

    def traced_print(self, *values, sep=" ", end="\n", **kwargs):
        if kwargs:
            raise ValueError("print() file and flush arguments are not supported.")

        rendered = str(sep).join(str(value) for value in values)
        output_bytes = len((rendered + str(end)).encode("utf-8"))

        if self.output_bytes + output_bytes > self.maximum_output_bytes:
            raise OutputLimitError("Python execution exceeded the maximum console output size.")

        self.output_bytes += output_bytes
        caller = sys._getframe(1)

        self.record(
            "OUTPUT",
            caller.f_lineno,
            {"channel": "stdout", "text": rendered, "end": str(end)},
            self.frame_states.get(id(caller), {}).get("scopeId"),
        )

    def safe_builtins(self):
        return {
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "Exception": Exception,
            "float": float,
            "int": int,
            "isinstance": isinstance,
            "len": len,
            "list": list,
            "max": max,
            "min": min,
            "print": self.traced_print,
            "range": range,
            "reversed": reversed,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "TypeError": TypeError,
            "ValueError": ValueError,
            "zip": zip,
        }

    def execution_globals(self):
        return {
            "__name__": "__main__",
            "__builtins__": self.safe_builtins(),
            "__codeflow_condition__": self.trace_condition,
            "__codeflow_branch__": self.trace_branch,
            "__codeflow_iterate__": self.trace_iterator,
            "__codeflow_loop_start__": self.start_loop,
            "__codeflow_loop_iteration__": self.record_loop_iteration,
            "__codeflow_loop_end__": self.end_loop,
            "__codeflow_while_condition__": self.trace_while_condition,
            "__codeflow_array_access__": self.trace_array_access,
            "__codeflow_method__": self.trace_method,
        }

    def find_error_line(self, error):
        if isinstance(error, SyntaxError) and error.lineno:
            return error.lineno

        for frame in reversed(traceback.extract_tb(error.__traceback__)):
            if frame.filename == SOURCE_FILENAME:
                return frame.lineno

        return self.last_line

    def run(self, source):
        try:
            tree = ast.parse(source, filename=SOURCE_FILENAME, mode="exec")
            validate_source_policy(tree)
        except SourcePolicyError:
            raise
        except Exception as error:
            return {
                "status": "ok",
                "executionStatus": "failed",
                "events": [{
                    "type": "ERROR",
                    "line": self.find_error_line(error),
                    "scopeId": None,
                    "payload": {
                        "name": type(error).__name__,
                        "errorType": type(error).__name__,
                        "message": str(error),
                    },
                }],
            }

        instrumented = SourceInstrumenter(source).visit(tree)
        ast.fix_missing_locations(instrumented)
        compiled = compile(instrumented, SOURCE_FILENAME, "exec")
        globals_dictionary = self.execution_globals()

        try:
            sys.settrace(self.trace_function)
            exec(compiled, globals_dictionary, globals_dictionary)
        except Exception as error:
            sys.settrace(None)

            self.events.append({
                "type": "ERROR",
                "line": self.find_error_line(error),
                "scopeId": None,
                "payload": {
                    "name": type(error).__name__,
                    "errorType": type(error).__name__,
                    "message": str(error),
                },
            })

            return {
                "status": "ok",
                "executionStatus": "failed",
                "events": self.events,
            }
        finally:
            sys.settrace(None)

        return {
            "status": "ok",
            "executionStatus": "completed",
            "events": self.events,
        }


def main():
    raw_input = sys.stdin.buffer.read(MAXIMUM_INPUT_BYTES + 1)

    if not raw_input:
        raise ValueError("Python worker did not receive an execution payload.")

    if len(raw_input) > MAXIMUM_INPUT_BYTES:
        raise ValueError("Python worker input exceeded the maximum size.")

    payload = json.loads(raw_input.decode("utf-8"))

    source = payload.get("source")

    if not isinstance(source, str) or not source.strip():
        raise ValueError("Python source must be a non-empty string.")

    tracer = PythonExecutionTracer(
        maximum_events=int(payload.get("maximumTraceEvents", 1000)),
        maximum_output_bytes=int(payload.get("maximumOutputBytes", 16 * 1024)),
    )

    try:
        result = tracer.run(source)
    except SourcePolicyError as error:
        result = {
            "status": "error",
            "error": {
                "code": "SOURCE_POLICY_VIOLATION",
                "name": "SourcePolicyError",
                "message": str(error),
                "line": error.line,
            },
        }

    encoded = json.dumps(result, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(encoded)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        sys.stderr.write(f"Python execution worker failed: {error}\n")
        raise SystemExit(1)
