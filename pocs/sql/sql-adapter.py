"""
Controlled SQL logical-query visualization proof of concept.

This adapter uses an isolated in-memory SQLite database.
It supports a deliberately limited SELECT query shape for
Phase 0 technical validation.

It does not expose external databases and does not reproduce
SQLite's internal physical execution plan.
"""

import json
import operator
import re
import sqlite3
import sys
from pathlib import Path


TRACE_SCHEMA_VERSION = "0.1.0"
TRACE_DOMAIN = "QUERY_EXECUTION"
LANGUAGE = "sql"


class TraceRecorder:
    def __init__(self, trace_id, source_file):
        self.trace_id = trace_id
        self.source_file = source_file
        self.events = []

    def record(self, event_type, line, payload=None):
        sequence = len(self.events)

        event = {
            "schemaVersion": TRACE_SCHEMA_VERSION,
            "traceId": self.trace_id,
            "eventId": (
                f"{self.trace_id}:event:{sequence:04d}"
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
            "stateDelta": {},
        }

        self.events.append(event)
        return event

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


def normalize_query(query):
    return re.sub(r"\s+", " ", query).strip().rstrip(";")


def parse_literal(raw_literal):
    raw_literal = raw_literal.strip()

    if (
        raw_literal.startswith("'")
        and raw_literal.endswith("'")
    ):
        return raw_literal[1:-1].replace("''", "'")

    if "." in raw_literal:
        return float(raw_literal)

    return int(raw_literal)


def parse_supported_query(query):
    normalized_query = normalize_query(query)

    pattern = re.compile(
        r"^SELECT\s+"
        r"(?P<select>[A-Za-z_][A-Za-z0-9_]*"
        r"(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)"
        r"\s+FROM\s+"
        r"(?P<table>[A-Za-z_][A-Za-z0-9_]*)"
        r"\s+WHERE\s+"
        r"(?P<where_column>[A-Za-z_][A-Za-z0-9_]*)"
        r"\s*(?P<operator>>=|<=|<>|!=|=|>|<)\s*"
        r"(?P<literal>-?\d+(?:\.\d+)?|'(?:''|[^'])*')"
        r"\s+ORDER\s+BY\s+"
        r"(?P<order_column>[A-Za-z_][A-Za-z0-9_]*)"
        r"(?:\s+(?P<direction>ASC|DESC))?$",
        re.IGNORECASE,
    )

    match = pattern.fullmatch(normalized_query)

    if match is None:
        raise ValueError(
            "Unsupported SQL POC query. Expected SELECT, "
            "FROM, WHERE and ORDER BY."
        )

    selected_columns = [
        column.strip()
        for column in match.group("select").split(",")
    ]

    return {
        "query": normalized_query,
        "selectedColumns": selected_columns,
        "table": match.group("table"),
        "whereColumn": match.group("where_column"),
        "operator": match.group("operator"),
        "literal": parse_literal(
            match.group("literal")
        ),
        "orderColumn": match.group("order_column"),
        "direction": (
            match.group("direction") or "ASC"
        ).upper(),
    }


def evaluate_condition(left_value, operation, right_value):
    operations = {
        ">": operator.gt,
        ">=": operator.ge,
        "<": operator.lt,
        "<=": operator.le,
        "=": operator.eq,
        "!=": operator.ne,
        "<>": operator.ne,
    }

    comparison = operations.get(operation)

    if comparison is None:
        raise ValueError(
            f"Unsupported SQL operator: {operation}"
        )

    return comparison(left_value, right_value)


def find_clause_line(source_lines, keyword):
    uppercase_keyword = keyword.upper()

    for line_number, source_line in enumerate(
        source_lines,
        start=1,
    ):
        if source_line.strip().upper().startswith(
            uppercase_keyword
        ):
            return line_number

    return 1


def rows_to_dictionaries(cursor):
    column_names = [
        description[0]
        for description in cursor.description
    ]

    rows = [
        {
            column_name: row[index]
            for index, column_name
            in enumerate(column_names)
        }
        for row in cursor.fetchall()
    ]

    return column_names, rows


def execute_sql_poc(sql_path):
    sql_path = Path(sql_path).resolve()

    if not sql_path.is_file():
        raise FileNotFoundError(
            f"SQL fixture not found: {sql_path}"
        )

    adapter_directory = Path(__file__).resolve().parent

    try:
        source_file = sql_path.relative_to(
            adapter_directory
        ).as_posix()
    except ValueError:
        source_file = sql_path.name

    sql_text = sql_path.read_text(encoding="utf-8")
    source_lines = sql_text.splitlines()

    statements = [
        statement.strip()
        for statement in sql_text.split(";")
        if statement.strip()
    ]

    if len(statements) < 2:
        raise ValueError(
            "SQL fixture must contain setup statements "
            "and one SELECT query."
        )

    query = statements[-1]
    setup_sql = ";\n".join(statements[:-1]) + ";"

    query_plan = parse_supported_query(query)

    select_line = find_clause_line(
        source_lines,
        "SELECT"
    )

    from_line = find_clause_line(
        source_lines,
        "FROM"
    )

    where_line = find_clause_line(
        source_lines,
        "WHERE"
    )

    order_line = find_clause_line(
        source_lines,
        "ORDER BY"
    )

    recorder = TraceRecorder(
        trace_id="sql-students-query-001",
        source_file=source_file,
    )

    recorder.record(
        "SQL_QUERY_START",
        line=select_line,
        payload={
            "query": query_plan["query"],
            "mode": "educational-logical-query",
            "database": "sqlite-memory",
        },
    )

    connection = sqlite3.connect(":memory:")

    try:
        connection.executescript(setup_sql)

        table_name = query_plan["table"]

        scan_cursor = connection.execute(
            f'SELECT * FROM "{table_name}" ORDER BY rowid'
        )

        scan_columns, scanned_rows = (
            rows_to_dictionaries(scan_cursor)
        )

        recorder.record(
            "SQL_SCAN",
            line=from_line,
            payload={
                "table": table_name,
                "columns": scan_columns,
                "rows": scanned_rows,
                "rowCount": len(scanned_rows),
                "explanation": (
                    "Read the rows required for the "
                    "educational logical query flow."
                ),
            },
        )

        matching_rows = []
        rejected_rows = []

        where_column = query_plan["whereColumn"]
        comparison_operator = query_plan["operator"]
        comparison_value = query_plan["literal"]

        predicate = (
            f"{where_column} "
            f"{comparison_operator} "
            f"{comparison_value}"
        )

        for row_index, row in enumerate(scanned_rows):
            condition_result = evaluate_condition(
                row[where_column],
                comparison_operator,
                comparison_value,
            )

            if condition_result:
                matching_rows.append(row)
            else:
                rejected_rows.append(row)

            recorder.record(
                "SQL_FILTER",
                line=where_line,
                payload={
                    "predicate": predicate,
                    "rowIndex": row_index,
                    "row": row,
                    "leftValue": row[where_column],
                    "operator": comparison_operator,
                    "rightValue": comparison_value,
                    "result": condition_result,
                },
            )

        selected_columns = query_plan[
            "selectedColumns"
        ]

        projected_rows = [
            {
                column: row[column]
                for column in selected_columns
            }
            for row in matching_rows
        ]

        recorder.record(
            "SQL_PROJECT",
            line=select_line,
            payload={
                "columns": selected_columns,
                "inputRows": matching_rows,
                "rows": projected_rows,
                "rowCount": len(projected_rows),
            },
        )

        order_column = query_plan["orderColumn"]
        direction = query_plan["direction"]

        if order_column not in selected_columns:
            raise ValueError(
                "The Phase 0 SQL POC requires the ORDER BY "
                "column to be included in SELECT."
            )

        sorted_rows = sorted(
            projected_rows,
            key=lambda row: (
                row[order_column] is None,
                row[order_column],
            ),
            reverse=direction == "DESC",
        )

        recorder.record(
            "SQL_SORT",
            line=order_line,
            payload={
                "column": order_column,
                "direction": direction,
                "inputRows": projected_rows,
                "rows": sorted_rows,
            },
        )

        actual_cursor = connection.execute(query)

        actual_columns, actual_rows = (
            rows_to_dictionaries(actual_cursor)
        )

        if (
            actual_columns != selected_columns
            or actual_rows != sorted_rows
        ):
            recorder.record(
                "ERROR",
                line=select_line,
                payload={
                    "errorType": (
                        "LogicalQueryVerificationError"
                    ),
                    "message": (
                        "Logical visualization result did "
                        "not match actual SQLite execution."
                    ),
                },
            )

            raise RuntimeError(
                "Logical SQL result verification failed."
            )

        recorder.record(
            "SQL_RESULT",
            line=order_line,
            payload={
                "columns": actual_columns,
                "rows": actual_rows,
                "rowCount": len(actual_rows),
                "status": "completed",
                "verification": "matched-sqlite-result",
            },
        )
    finally:
        connection.close()

    return recorder.get_trace()


def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python sql-adapter.py "
            "<controlled-query.sql>",
            file=sys.stderr,
        )
        return 1

    trace = execute_sql_poc(sys.argv[1])

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
            f"SQL adapter failed: {error}",
            file=sys.stderr,
        )
        exit_code = 1

    raise SystemExit(exit_code)